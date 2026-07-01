/**
 * Клиент ЮKassa (YooKassa) REST API v3.
 * Если ключи не заданы (dev без ЮKassa) — isYookassaConfigured() === false,
 * и оформление заказа проходит без онлайн-оплаты.
 */

const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const API_URL = "https://api.yookassa.ru/v3";

export function isYookassaConfigured(): boolean {
  return Boolean(SHOP_ID && SECRET_KEY);
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64");
}

export type YooPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
};

/** Создаёт платёж и возвращает объект с confirmation_url для редиректа покупателя. */
export async function createPayment(args: {
  amountKopecks: number;
  description: string;
  orderId: string;
  returnUrl: string;
  idempotenceKey: string;
}): Promise<YooPayment> {
  const res = await fetch(`${API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": args.idempotenceKey,
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: {
        value: (args.amountKopecks / 100).toFixed(2),
        currency: "RUB",
      },
      capture: true,
      confirmation: { type: "redirect", return_url: args.returnUrl },
      description: args.description,
      metadata: { orderId: args.orderId },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ЮKassa: не удалось создать платёж (${res.status}): ${text}`);
  }
  return (await res.json()) as YooPayment;
}

/** Получает платёж по id (для проверки статуса из вебхука — не доверяем телу запроса). */
export async function getPayment(id: string): Promise<YooPayment> {
  const res = await fetch(`${API_URL}/payments/${id}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ЮKassa: не удалось получить платёж (${res.status}): ${text}`);
  }
  return (await res.json()) as YooPayment;
}

/** Маппинг статуса ЮKassa → внутренние статусы заказа/оплаты. */
export function mapPaymentStatus(status: YooPayment["status"]): {
  paymentStatus: string;
  orderStatus?: string;
} {
  switch (status) {
    case "succeeded":
      return { paymentStatus: "SUCCEEDED", orderStatus: "PAID" };
    case "waiting_for_capture":
      return { paymentStatus: "WAITING_FOR_CAPTURE" };
    case "canceled":
      return { paymentStatus: "CANCELLED", orderStatus: "CANCELLED" };
    default:
      return { paymentStatus: "PENDING" };
  }
}
