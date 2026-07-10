import crypto from "node:crypto";

// Интернет-эквайринг Т-Банка (T-Bank / Tinkoff). Карты + СБП.
// Подпись (Token): корневые скалярные поля + Password, сортировка по ключу,
// конкатенация значений, SHA-256. Вложенные объекты (Receipt, DATA) в токен не входят.
//
// Настройка окружения:
//   TBANK_TERMINAL_KEY, TBANK_PASSWORD — из кабинета интернет-эквайринга.
//   TBANK_API_URL — по умолчанию боевой https://securepay.tinkoff.ru/v2
//   TBANK_TAXATION — система налогообложения для чека (напр. usn_income). Пусто = без чека.
//   TBANK_VAT — ставка НДС в чеке (по умолчанию "none").

const API_URL = process.env.TBANK_API_URL?.replace(/\/$/, "") ?? "https://securepay.tinkoff.ru/v2";
const TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY ?? "";
const PASSWORD = process.env.TBANK_PASSWORD ?? "";
const TAXATION = process.env.TBANK_TAXATION ?? "";
const VAT = process.env.TBANK_VAT ?? "none";

export function isTbankConfigured(): boolean {
  return !!TERMINAL_KEY && !!PASSWORD;
}

/** Подпись запроса: только корневые скалярные поля + Password. */
function genToken(root: Record<string, unknown>): string {
  const data: Record<string, string> = { Password: PASSWORD };
  for (const [k, v] of Object.entries(root)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") continue; // вложенные (Receipt/DATA) не участвуют
    if (k === "Token") continue;
    data[k] = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  }
  const concat = Object.keys(data)
    .sort()
    .map((k) => data[k])
    .join("");
  return crypto.createHash("sha256").update(concat, "utf8").digest("hex");
}

export type TbankInitInput = {
  amountKopecks: number;
  orderId: string;
  description: string;
  successUrl: string;
  failUrl: string;
  notificationUrl: string;
  customerEmail?: string | null;
  customerPhone: string;
  items: { name: string; priceKopecks: number; quantity: number }[];
  deliveryKopecks: number;
};

/** Инициализация платежа. Возвращает id и ссылку на оплату. */
export async function createTbankPayment(
  input: TbankInitInput,
): Promise<{ paymentId: string; paymentUrl: string }> {
  const root: Record<string, unknown> = {
    TerminalKey: TERMINAL_KEY,
    Amount: input.amountKopecks,
    OrderId: input.orderId,
    Description: input.description.slice(0, 140),
    SuccessURL: input.successUrl,
    FailURL: input.failUrl,
    NotificationURL: input.notificationUrl,
  };
  const body: Record<string, unknown> = { ...root, Token: genToken(root) };

  // Чек (54-ФЗ) — если задана система налогообложения
  if (TAXATION) {
    const items = input.items.map((i) => ({
      Name: i.name.slice(0, 128),
      Price: i.priceKopecks,
      Quantity: i.quantity,
      Amount: i.priceKopecks * i.quantity,
      Tax: VAT,
      PaymentMethod: "full_prepayment",
      PaymentObject: "commodity",
    }));
    if (input.deliveryKopecks > 0) {
      items.push({
        Name: "Доставка",
        Price: input.deliveryKopecks,
        Quantity: 1,
        Amount: input.deliveryKopecks,
        Tax: VAT,
        PaymentMethod: "full_prepayment",
        PaymentObject: "service",
      });
    }
    body.Receipt = {
      Email: input.customerEmail || undefined,
      Phone: input.customerPhone,
      Taxation: TAXATION,
      Items: items,
    };
  }

  const res = await fetch(`${API_URL}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as {
    Success: boolean;
    PaymentId?: string | number;
    PaymentURL?: string;
    Message?: string;
    Details?: string;
    ErrorCode?: string;
  };
  if (!data.Success || !data.PaymentId || !data.PaymentURL) {
    throw new Error(
      `Т-Банк Init: ${data.Message ?? ""} ${data.Details ?? ""} (код ${data.ErrorCode ?? "?"})`,
    );
  }
  return { paymentId: String(data.PaymentId), paymentUrl: data.PaymentURL };
}

export type TbankStatus =
  | "NEW"
  | "FORM_SHOWED"
  | "AUTHORIZING"
  | "AUTHORIZED"
  | "CONFIRMING"
  | "CONFIRMED"
  | "REVERSED"
  | "REFUNDED"
  | "REJECTED"
  | "CANCELED"
  | string;

/** Статус платежа по id. */
export async function getTbankState(paymentId: string): Promise<TbankStatus | null> {
  const root = { TerminalKey: TERMINAL_KEY, PaymentId: paymentId };
  const body = { ...root, Token: genToken(root) };
  const res = await fetch(`${API_URL}/GetState`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as { Success: boolean; Status?: string };
  return data.Success ? (data.Status ?? null) : null;
}

/** Проверка подписи входящего уведомления (вебхука). */
export function verifyTbankNotification(body: Record<string, unknown>): boolean {
  const received = body.Token;
  if (typeof received !== "string") return false;
  return genToken(body) === received;
}

/** Итоговое ли (успех/провал) состояние платежа. */
export function mapTbankStatus(status: TbankStatus): {
  paymentStatus: string;
  orderStatus?: string;
} {
  switch (status) {
    case "CONFIRMED":
      return { paymentStatus: "SUCCEEDED", orderStatus: "PAID" };
    case "AUTHORIZED":
      return { paymentStatus: "WAITING_FOR_CAPTURE" };
    case "REJECTED":
    case "CANCELED":
    case "REVERSED":
    case "REFUNDED":
      return { paymentStatus: "CANCELLED", orderStatus: "CANCELLED" };
    default:
      return { paymentStatus: "PENDING" };
  }
}
