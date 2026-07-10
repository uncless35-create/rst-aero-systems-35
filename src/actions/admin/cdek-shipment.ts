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
  if (order.cdekOrderUuid) {
    return { ok: false, error: "Отправление уже создано" };
  }
  if (order.cdekTariffCode == null || order.cdekCityCode == null) {
    return { ok: false, error: "В заказе нет данных тарифа/города СДЭК" };
  }

  const items = order.items.map((it) => ({
    name: it.variantName ? `${it.productName} (${it.variantName})` : it.productName,
    wareKey: it.product?.sku || it.productId || it.id,
    costRub: Math.round(it.priceKopecks / 100),
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

/** Обновить номер накладной, если он ещё не пришёл. */
export async function refreshShipmentNumber(orderId: string): Promise<ShipmentResult> {
  await assertAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.cdekOrderUuid) return { ok: false, error: "Отправление не создано" };
  try {
    const info = await getCdekOrderInfo(order.cdekOrderUuid);
    if (info.cdekNumber && info.cdekNumber !== order.cdekTrackNumber) {
      await prisma.order.update({
        where: { id: orderId },
        data: { cdekTrackNumber: info.cdekNumber },
      });
    }
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true, uuid: order.cdekOrderUuid, trackNumber: info.cdekNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка обновления" };
  }
}
