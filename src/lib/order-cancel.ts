/**
 * Когда покупатель может отменить заказ сам: пока его не передали в СДЭК и не оплатили онлайн.
 * После этого отмена требует действий менеджера (отозвать отправление, вернуть деньги).
 */
export const SELF_CANCEL_STATUSES = ["NEW", "PROCESSING"];

type CancelCheck = {
  status: string;
  paymentStatus: string;
  cdekOrderUuid: string | null;
};

/** Почему покупатель не может отменить заказ сам; null — может. */
export function customerCancelBlockReason(order: CancelCheck): string | null {
  if (order.status === "CANCELLED") return "Заказ уже отменён.";
  if (order.cdekOrderUuid || order.status === "SHIPPED" || order.status === "COMPLETED") {
    return "Заказ уже передан в доставку — напишите нам, и мы поможем с отменой.";
  }
  if (order.paymentStatus === "SUCCEEDED" || order.paymentStatus === "WAITING_FOR_CAPTURE") {
    return "Заказ оплачен — для отмены и возврата денег напишите нам.";
  }
  if (!SELF_CANCEL_STATUSES.includes(order.status)) {
    return "Этот заказ нельзя отменить самостоятельно — напишите нам.";
  }
  return null;
}
