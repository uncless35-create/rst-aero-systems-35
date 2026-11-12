// Как статус отправления СДЭК двигает статус заказа на сайте. Без БД и сети — для тестов.
//
//   Принят / Создан (накладная оформлена)            → статус не меняем (заказ «В обработке»)
//   Принят на склад отправителя и весь путь дальше   → SHIPPED «Отправлен»
//   Принят в ПВЗ до востребования / заложен в постамат → READY_FOR_PICKUP «В пункте выдачи»
//   Вручён / получен из постамата                    → COMPLETED «Завершён» (+ наложенный платёж «Оплачен»)
//   Не вручён, возврат, удалён, некорректный          → статус не меняем, предупреждаем владельца
//
// Статус двигается только вперёд: ручную правку в админке назад не откатываем,
// отменённые заказы не трогаем.

import type { CdekStatusEvent } from "@/lib/cdek";
import type { OrderStatus } from "@/lib/constants";

const NOT_HANDED_OVER = new Set(["ACCEPTED", "CREATED"]);
const AT_PICKUP_POINT = new Set(["ACCEPTED_AT_PICK_UP_POINT", "POSTOMAT_POSTED"]);
const DELIVERED = new Set(["DELIVERED", "POSTOMAT_RECEIVED"]);
const PROBLEMS = new Set(["NOT_DELIVERED", "INVALID", "REMOVED", "POSTOMAT_SEIZED", "SENT_TO_SENDER_CITY"]);

const PROGRESS: Partial<Record<OrderStatus, number>> = {
  NEW: 0,
  PAID: 1,
  PROCESSING: 2,
  SHIPPED: 3,
  READY_FOR_PICKUP: 4,
  COMPLETED: 5,
};

/** Посылка не дошла до покупателя: возврат, отказ, удаление накладной. */
export function isCdekProblemStatus(code: string): boolean {
  return PROBLEMS.has(code) || code.includes("RETURN");
}

export function isCdekDeliveredStatus(code: string): boolean {
  return DELIVERED.has(code);
}

/** Статус заказа на сайте, соответствующий статусу СДЭК; null — не влияет. */
export function orderStatusForCdek(code: string): OrderStatus | null {
  if (NOT_HANDED_OVER.has(code) || isCdekProblemStatus(code)) return null;
  if (DELIVERED.has(code)) return "COMPLETED";
  if (AT_PICKUP_POINT.has(code)) return "READY_FOR_PICKUP";
  return "SHIPPED";
}

/** «2026-11-10T16:46:07+0000» → мс. Смещение без двоеточия парсится не везде. */
export function parseCdekDate(value: string): number {
  return Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
}

/**
 * Последнее событие по времени. При равном времени берём то, что СДЭК перечислил раньше:
 * в ответе новые события идут первыми.
 */
export function latestCdekStatus(statuses: CdekStatusEvent[]): CdekStatusEvent | null {
  let latest: CdekStatusEvent | null = null;
  let latestAt = -Infinity;
  for (const event of statuses) {
    const at = parseCdekDate(event.dateTime);
    if (Number.isNaN(at)) continue;
    if (at > latestAt) {
      latest = event;
      latestAt = at;
    }
  }
  return latest;
}

export type CdekOrderPlan = {
  /** Новый статус заказа, если его нужно сдвинуть вперёд. */
  status: OrderStatus | null;
  /** Посылку вручили с наложенным платежом — деньги покупатель отдал СДЭК. */
  markPaid: boolean;
  problem: boolean;
};

export function planOrderUpdate(
  order: { status: string; paymentStatus: string },
  cdekCode: string | null,
): CdekOrderPlan {
  const none: CdekOrderPlan = { status: null, markPaid: false, problem: false };
  if (!cdekCode || order.status === "CANCELLED") return none;

  const problem = isCdekProblemStatus(cdekCode);
  const target = orderStatusForCdek(cdekCode);
  const current = PROGRESS[order.status as OrderStatus];
  const status =
    target && current !== undefined && PROGRESS[target]! > current ? target : null;
  const markPaid = DELIVERED.has(cdekCode) && order.paymentStatus === "PENDING";
  return { status, markPaid, problem };
}

/** «Принят на склад до востребования · Москва · 10 ноября, 10:18» для карточек заказа. */
export function describeCdekStatus(order: {
  cdekStatusName: string | null;
  cdekStatusCity: string | null;
  cdekStatusAt: Date | null;
}): string | null {
  if (!order.cdekStatusName) return null;
  const parts = [order.cdekStatusName];
  if (order.cdekStatusCity) parts.push(order.cdekStatusCity);
  if (order.cdekStatusAt) {
    parts.push(
      order.cdekStatusAt.toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }),
    );
  }
  return parts.join(" · ");
}
