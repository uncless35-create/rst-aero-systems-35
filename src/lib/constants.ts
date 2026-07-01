// Статусы заказа и оплаты + русские подписи. Значения совпадают со строками в БД.

export const ORDER_STATUSES = [
  "NEW",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Новый",
  PAID: "Оплачен",
  PROCESSING: "В обработке",
  SHIPPED: "Отправлен",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-surface text-foreground",
  PAID: "bg-success/10 text-success",
  PROCESSING: "bg-accent text-accent-foreground",
  SHIPPED: "bg-primary text-primary-foreground",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export const PAYMENT_STATUSES = [
  "PENDING",
  "WAITING_FOR_CAPTURE",
  "SUCCEEDED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Ожидает оплаты",
  WAITING_FOR_CAPTURE: "Ожидает подтверждения",
  SUCCEEDED: "Оплачен",
  CANCELLED: "Отменён",
};

export const SITE = {
  name: "RST AERO SYSTEMS",
  tagline: "FPV-дроны, тинивупы и комплектующие",
  phone: "+7 (900) 000-00-00",
  email: "info@rst-aero.ru",
};

/** Характеристика товара (хранится в Product.attributes как JSON). */
export type ProductAttribute = { name: string; value: string };

export function parseAttributes(json: string | null | undefined): ProductAttribute[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.filter((a) => a?.name && a?.value);
    return [];
  } catch {
    return [];
  }
}
