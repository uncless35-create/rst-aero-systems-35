"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import {
  createCdekShipment,
  getCdekOrderInfo,
  isCdekShipmentConfigured,
  CDEK_DEFAULT_WEIGHT_GRAMS,
} from "@/lib/cdek";
import { syncCdekOrder } from "@/lib/cdek-sync";

export type ShipmentResult =
  | { ok: true; uuid: string; trackNumber: string | null }
  | { ok: false; error: string };

/** Создать накладную СДЭК для заказа (кнопка в админке). */
export async function createShipmentForOrder(orderId: string): Promise<ShipmentResult> {
  await assertAdmin();

  if (!isCdekShipmentConfigured()) {
    return {
      ok: false,
      error: "Отправитель СДЭК не настроен (нужны имя, телефон и пункт отправки).",
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      deliveryMethod: true,
      items: { include: { product: { select: { weightGrams: true, sku: true } } } },
    },
  });
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.deliveryMethod.provider !== "CDEK") {
    return { ok: false, error: "У заказа доставка не СДЭК" };
  }
  if (
    order.paymentStatus !== "SUCCEEDED" &&
    order.status !== "PAID" &&
    order.status !== "PROCESSING"
  ) {
    return {
      ok: false,
      error: "Перед созданием отправления подтвердите заказ: переведите его в статус «В обработке» (или «Оплачен»).",
    };
  }
  if (order.cdekOrderUuid) {
    return { ok: false, error: "Отправление уже создано" };
  }
  if (order.cdekTariffCode == null || order.cdekCityCode == null) {
    return { ok: false, error: "В заказе нет данных тарифа/города СДЭК" };
  }

  // Не оплачен онлайн — отправляем наложенным платежом: СДЭК берёт с покупателя
  // стоимость товаров и доставки при получении.
  const cashOnDelivery = order.paymentStatus !== "SUCCEEDED";
  const items = order.items.map((it) => ({
    name: it.variantName ? `${it.productName} (${it.variantName})` : it.productName,
    wareKey: it.product?.sku || it.productId || it.id,
    costRub: Math.round(it.priceKopecks / 100),
    paymentRub: cashOnDelivery ? it.priceKopecks / 100 : 0,
    weightGrams: it.product?.weightGrams ?? CDEK_DEFAULT_WEIGHT_GRAMS,
    amount: it.quantity,
  }));

  try {
    const { uuid } = await createCdekShipment({
      tariffCode: order.cdekTariffCode,
      toCityCode: order.cdekCityCode,
      pvzCode: order.cdekPvzCode,
      toAddress: order.deliveryAddress,
      recipientName: order.customerName,
      recipientPhone: order.customerPhone,
      items,
      deliveryRecipientCostRub: cashOnDelivery ? order.deliveryPriceKopecks / 100 : 0,
    });

    // Пробуем сразу получить номер накладной (может быть ещё не готов)
    let trackNumber: string | null = null;
    try {
      const info = await getCdekOrderInfo(uuid);
      trackNumber = info.cdekNumber;
    } catch {
      // номер появится позже — не критично
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { cdekOrderUuid: uuid, cdekTrackNumber: trackNumber },
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, uuid, trackNumber };
  } catch (e) {
    console.error("СДЭК создание отправления:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка создания отправления" };
  }
}

export type ShipmentSyncResult =
  | { ok: true; trackNumber: string | null; status: string; cdekStatusName: string | null }
  | { ok: false; error: string };

/** Перечитать отправление в СДЭК: номер накладной, статус доставки и статус заказа. */
export async function syncShipmentFromCdek(orderId: string): Promise<ShipmentSyncResult> {
  await assertAdmin();
  try {
    const r = await syncCdekOrder(orderId);
    if (!r) return { ok: false, error: "СДЭК не нашёл отправление этого заказа" };
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, trackNumber: r.trackNumber, status: r.status, cdekStatusName: r.cdekStatusName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка обновления" };
  }
}
