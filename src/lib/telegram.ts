// Уведомления владельцу в Telegram (например, о новом заказе).
// Активируется переменными окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.
// Без них — тихо ничего не делает (заказ оформляется как обычно).

export function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;
}

/** Экранирование для parse_mode: HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Отправить сообщение владельцу в Telegram. Не бросает исключений — не ломает оформление. */
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("Telegram sendMessage:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("Telegram:", e);
  }
}
