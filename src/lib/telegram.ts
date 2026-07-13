import { createHash } from "node:crypto";

// Общение через Telegram-бота: уведомления владельцу (заказы, сообщения с сайта)
// и переписка с покупателем, который написал боту напрямую.
// Активируется переменными окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.
// Без них — тихо ничего не делает (заказ оформляется как обычно).

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

/** Логин бота без «@» — нужен для ссылки t.me на витрине. */
export function getTelegramBotUsername(): string | null {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return username || null;
}

/** Секрет webhook: явный из env либо стабильный хеш токена бота. */
export function getTelegramWebhookSecret(): string | null {
  if (process.env.TELEGRAM_WEBHOOK_SECRET) return process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  return createHash("sha256").update(`rst-aero-telegram-webhook:${token}`).digest("hex");
}

/** Экранирование для parse_mode: HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type TelegramSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

type TelegramSendOptions = {
  replyToMessageId?: string | null;
};

/**
 * Отправить сообщение в произвольный чат бота и вернуть Telegram message_id.
 * Не бросает исключений: сообщение покупателя уже сохранено в БД и не потеряется.
 */
export async function sendTelegramTo(
  chatId: string,
  text: string,
  options: TelegramSendOptions = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { ok: false, error: "Telegram не настроен" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(options.replyToMessageId
          ? {
              reply_parameters: {
                message_id: Number(options.replyToMessageId),
                allow_sending_without_reply: true,
              },
            }
          : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error("Telegram sendMessage:", res.status, details);
      return { ok: false, error: `Telegram API: ${res.status}` };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
    };
    const messageId = data.result?.message_id;
    if (!data.ok || !messageId) return { ok: false, error: "Некорректный ответ Telegram" };
    return { ok: true, messageId: String(messageId) };
  } catch (e) {
    console.error("Telegram:", e);
    return { ok: false, error: "Telegram недоступен" };
  }
}

/** Отправить сообщение владельцу магазина (чат из TELEGRAM_CHAT_ID). */
export async function sendTelegramMessage(
  text: string,
  options: TelegramSendOptions = {},
): Promise<TelegramSendResult> {
  const ownerChatId = process.env.TELEGRAM_CHAT_ID;
  if (!ownerChatId) return { ok: false, error: "Telegram не настроен" };
  return sendTelegramTo(ownerChatId, text, options);
}

/** Совместимый помощник для уведомлений о заказах. */
export async function sendTelegram(text: string): Promise<void> {
  await sendTelegramMessage(text);
}
