"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isYookassaConfigured, createPayment } from "@/lib/yookassa";
import { isTbankConfigured, createTbankPayment } from "@/lib/tbank";
import { calculateTariff, CDEK_DEFAULT_WEIGHT_GRAMS, getCdekDeliveryPoint } from "@/lib/cdek";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import { formatRub } from "@/lib/money";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import {
  InventoryUnavailableError,
  reserveOrderInventory,
} from "@/lib/order-inventory";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import { consumeRateLimit } from "@/lib/rate-limit";

export type CreateOrderResult =
  | { ok: true; orderNumber: number; accessToken: string; confirmationUrl?: string }
  | { ok: false; error: string };

/**
 * Создаёт заказ. Цены и остатки берутся из БД — данным клиента НЕ доверяем.
 * Если эквайринг не настроен, заказ сохраняется без платёжной ссылки и
 * менеджер согласовывает оплату с покупателем.
 */
export async function createOrder(input: CheckoutInput): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте данные" };
  }
  const data = parsed.data;

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  if (consumeRateLimit(`checkout:${clientIp}`, 6, 15 * 60_000)) {
    return {
      ok: false,
      error: "Слишком много попыток оформления. Повторите через 15 минут или напишите менеджеру.",
    };
  }

  // Способ доставки
  const delivery = await prisma.deliveryMethod.findFirst({
    where: { id: data.deliveryMethodId, isActive: true },
  });
  if (!delivery) return { ok: false, error: "Способ доставки недоступен" };

  // СДЭК-виджет применяется, только если клиент прислал выбор ПВЗ.
  // Иначе (нет ключа карт / виджет недоступен) метод работает как обычный: адрес + фикс. цена.
  const useCdek = delivery.provider === "CDEK" && !!data.cdek;
  let deliveryAddress = data.deliveryAddress?.trim() || null;
  if (useCdek) {
    if (data.cdek!.cityCode == null) {
      return { ok: false, error: "Не удалось определить город доставки, выберите пункт заново" };
    }
    if (!deliveryAddress) {
      return { ok: false, error: "Не удалось определить адрес доставки, выберите пункт заново" };
    }
  } else if (delivery.requiresAddress && !deliveryAddress) {
    return { ok: false, error: "Укажите адрес доставки" };
  }

  // Сборка позиций с проверкой цен и остатков
  const productIds = [...new Set(data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { variants: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems: {
    productId: string;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    priceKopecks: number;
    quantity: number;
  }[] = [];
  let itemsTotalKopecks = 0;
  let totalWeightGrams = 0;

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) return { ok: false, error: "Товар недоступен" };
    if (product.contentStatus !== "VERIFIED") {
      return {
        ok: false,
        error: `Точную версию товара «${product.name}» нужно подтвердить с менеджером перед заказом`,
      };
    }
    if (product.outOfStock) {
      return { ok: false, error: `Товара «${product.name}» временно нет в наличии` };
    }

    totalWeightGrams += (product.weightGrams ?? CDEK_DEFAULT_WEIGHT_GRAMS) * item.quantity;

    let priceKopecks = product.priceKopecks;
    let variantName: string | null = null;
    let stock = product.stockQty;

    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) return { ok: false, error: `Вариант товара «${product.name}» недоступен` };
      priceKopecks = variant.priceKopecks ?? product.priceKopecks;
      variantName = variant.name;
      stock = variant.stockQty;
    } else if (product.variants.length > 0) {
      return { ok: false, error: `Выберите вариант товара «${product.name}»` };
    }

    if (stock < item.quantity) {
      return { ok: false, error: `Недостаточно товара «${product.name}» в наличии` };
    }

    itemsTotalKopecks += priceKopecks * item.quantity;
    orderItems.push({
      productId: product.id,
      variantId: item.variantId ?? null,
      productName: product.name,
      variantName,
      priceKopecks,
      quantity: item.quantity,
    });
  }

  // Стоимость доставки. Для СДЭК пересчитываем на сервере — клиентской сумме не доверяем.
  let deliveryPriceKopecks = delivery.priceKopecks;
  let cdekPvzCode: string | null = null;
  let cdekCityCode: number | null = null;
  let cdekTariffCode: number | null = null;

  if (useCdek && data.cdek) {
    const toCityCode = data.cdek.cityCode as number; // проверено выше на null
    cdekCityCode = toCityCode;
    cdekTariffCode = data.cdek.tariffCode;
    cdekPvzCode = data.cdek.pvzCode;
    try {
      if (data.cdek.mode === "office" && data.cdek.pvzCode) {
        const point = await getCdekDeliveryPoint(data.cdek.pvzCode);
        if (!point || point.cityCode !== toCityCode) {
          return {
            ok: false,
            error: "Пункт выдачи СДЭК не соответствует выбранному городу. Выберите его заново.",
          };
        }
        deliveryAddress = `${point.address} (ПВЗ ${point.code})`;
      }
      const tariff = await calculateTariff({
        tariffCode: data.cdek.tariffCode,
        toCityCode,
        weightGrams: totalWeightGrams,
      });
      deliveryPriceKopecks = tariff.deliverySumKopecks;
    } catch (e) {
      // Клиентской сумме не доверяем: лучше попросить повторить расчёт, чем создать
      // заказ с подменённой или нулевой стоимостью доставки.
      console.error("СДЭК: пересчёт стоимости не удался:", e);
      return {
        ok: false,
        error: "Не удалось проверить стоимость доставки СДЭК. Повторите попытку позже.",
      };
    }
  }

  const totalKopecks = itemsTotalKopecks + deliveryPriceKopecks;

  // Привязка к пользователю, если он авторизован
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Создание заказа + списание остатков в транзакции
  let order: { id: string; orderNumber: number; accessToken: string };
  try {
    order = await prisma.$transaction(async (tx) => {
      // Условные updateMany не позволят параллельным заказам увести остаток в минус.
      await reserveOrderInventory(tx, orderItems);

      const created = await tx.order.create({
        data: {
          userId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail || null,
          deliveryMethodId: delivery.id,
          deliveryAddress,
          cdekPvzCode,
          cdekCityCode,
          cdekTariffCode,
          comment: data.comment || null,
          itemsTotalKopecks,
          deliveryPriceKopecks,
          totalKopecks,
          status: "NEW",
          paymentStatus: "PENDING",
          privacyAcceptedAt: new Date(),
          privacyPolicyVersion: PRIVACY_POLICY_VERSION,
          items: { create: orderItems },
        },
        select: { id: true, orderNumber: true, accessToken: true },
      });
      if (!created.accessToken) throw new Error("Не создан токен доступа к заказу");
      return { ...created, accessToken: created.accessToken };
    });
  } catch (e) {
    if (e instanceof InventoryUnavailableError) {
      return { ok: false, error: e.message };
    }
    console.error("Ошибка создания заказа:", e);
    return { ok: false, error: "Не удалось оформить заказ. Повторите попытку." };
  }

  // Остатки изменились — сбрасываем кеш витрины
  revalidateTag("products", "max");

  // Уведомление владельцу в Telegram (если настроено) — не блокирует оформление
  const itemsList = orderItems
    .map(
      (i) =>
        `• ${escapeHtml(i.productName)}${i.variantName ? ` (${escapeHtml(i.variantName)})` : ""} × ${i.quantity} — ${formatRub(i.priceKopecks * i.quantity)}`,
    )
    .join("\n");
  const tgMessage =
    `🛒 <b>Новый заказ №${order.orderNumber}</b>\n\n` +
    `👤 ${escapeHtml(data.customerName)}\n` +
    `📞 ${escapeHtml(data.customerPhone)}\n` +
    (data.customerEmail ? `✉️ ${escapeHtml(data.customerEmail)}\n` : "") +
    `\n📦 <b>Состав:</b>\n${itemsList}\n` +
    `\n🚚 <b>${escapeHtml(delivery.name)}</b>` +
    (deliveryAddress ? `\n📍 ${escapeHtml(deliveryAddress)}` : "") +
    ` — ${deliveryPriceKopecks === 0 ? "бесплатно" : formatRub(deliveryPriceKopecks)}\n` +
    `\n💰 <b>Итого: ${formatRub(totalKopecks)}</b>` +
    (data.comment ? `\n\n💬 ${escapeHtml(data.comment)}` : "");
  await sendTelegram(tgMessage);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const returnUrl = `${siteUrl}/order/${encodeURIComponent(order.accessToken)}/success`;

  // Оплата Т-Банком (приоритетно, если настроен интернет-эквайринг).
  if (isTbankConfigured()) {
    try {
      const { paymentId, paymentUrl } = await createTbankPayment({
        amountKopecks: totalKopecks,
        orderId: order.id,
        description: `Заказ №${order.orderNumber}`,
        successUrl: returnUrl,
        failUrl: returnUrl,
        notificationUrl: `${siteUrl}/api/webhooks/tbank`,
        customerEmail: data.customerEmail || null,
        customerPhone: data.customerPhone,
        items: orderItems.map((i) => ({
          name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName,
          priceKopecks: i.priceKopecks,
          quantity: i.quantity,
        })),
        deliveryKopecks: deliveryPriceKopecks,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { tbankPaymentId: paymentId },
      });
      return {
        ok: true,
        orderNumber: order.orderNumber,
        accessToken: order.accessToken,
        confirmationUrl: paymentUrl,
      };
    } catch (e) {
      console.error("Ошибка создания платежа Т-Банк:", e);
      return { ok: true, orderNumber: order.orderNumber, accessToken: order.accessToken };
    }
  }

  // Оплата ЮKassa (если настроена). Иначе — заказ без онлайн-оплаты.
  if (isYookassaConfigured()) {
    try {
      const payment = await createPayment({
        amountKopecks: totalKopecks,
        description: `Заказ №${order.orderNumber}`,
        orderId: order.id,
        returnUrl,
        idempotenceKey: order.id,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { yookassaPaymentId: payment.id },
      });
      const confirmationUrl = payment.confirmation?.confirmation_url;
      return {
        ok: true,
        orderNumber: order.orderNumber,
        accessToken: order.accessToken,
        confirmationUrl,
      };
    } catch (e) {
      console.error("Ошибка создания платежа ЮKassa:", e);
      // Заказ уже создан — покажем страницу заказа, оплату подтвердим вручную.
      return { ok: true, orderNumber: order.orderNumber, accessToken: order.accessToken };
    }
  }

  return { ok: true, orderNumber: order.orderNumber, accessToken: order.accessToken };
}
