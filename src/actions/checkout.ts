"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isYookassaConfigured, createPayment } from "@/lib/yookassa";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";

export type CreateOrderResult =
  | { ok: true; orderNumber: number; confirmationUrl?: string }
  | { ok: false; error: string };

/**
 * Создаёт заказ. Цены и остатки берутся из БД — данным клиента НЕ доверяем.
 * (Оплата ЮKassa будет подключена на следующем этапе.)
 */
export async function createOrder(input: CheckoutInput): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте данные" };
  }
  const data = parsed.data;

  // Способ доставки
  const delivery = await prisma.deliveryMethod.findFirst({
    where: { id: data.deliveryMethodId, isActive: true },
  });
  if (!delivery) return { ok: false, error: "Способ доставки недоступен" };
  if (delivery.requiresAddress && !data.deliveryAddress?.trim()) {
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

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) return { ok: false, error: "Товар недоступен" };

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

  const deliveryPriceKopecks = delivery.priceKopecks;
  const totalKopecks = itemsTotalKopecks + deliveryPriceKopecks;

  // Привязка к пользователю, если он авторизован
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Создание заказа + списание остатков в транзакции
  const order = await prisma.$transaction(async (tx) => {
    const last = await tx.order.findFirst({
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? 1000) + 1;

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        deliveryMethodId: delivery.id,
        deliveryAddress: data.deliveryAddress || null,
        comment: data.comment || null,
        itemsTotalKopecks,
        deliveryPriceKopecks,
        totalKopecks,
        status: "NEW",
        paymentStatus: "PENDING",
        items: { create: orderItems },
      },
    });

    // Уменьшаем остатки
    for (const item of orderItems) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { decrement: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }
    }

    return created;
  });

  // Оплата ЮKassa (если настроена). Иначе — заказ без онлайн-оплаты.
  if (isYookassaConfigured()) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const payment = await createPayment({
        amountKopecks: totalKopecks,
        description: `Заказ №${order.orderNumber}`,
        orderId: order.id,
        returnUrl: `${siteUrl}/order/${order.orderNumber}/success`,
        idempotenceKey: order.id,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { yookassaPaymentId: payment.id },
      });
      const confirmationUrl = payment.confirmation?.confirmation_url;
      return { ok: true, orderNumber: order.orderNumber, confirmationUrl };
    } catch (e) {
      console.error("Ошибка создания платежа ЮKassa:", e);
      // Заказ уже создан — покажем страницу заказа, оплату подтвердим вручную.
      return { ok: true, orderNumber: order.orderNumber };
    }
  }

  return { ok: true, orderNumber: order.orderNumber };
}
