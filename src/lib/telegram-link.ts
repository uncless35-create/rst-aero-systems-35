import { SITE } from "@/lib/constants";

/**
 * Ссылка на бота магазина для витрины (работает и на сервере, и в браузере).
 * startPayload — publicToken начатого на сайте диалога: бот привяжет к нему
 * Telegram-чат покупателя, и переписка не разорвётся.
 */
export function telegramBotUrl(startPayload?: string | null): string | null {
  const username = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || SITE.telegramBot)
    .trim()
    .replace(/^@/, "");
  if (!username) return null;

  // Telegram допускает в start только [A-Za-z0-9_-], не длиннее 64 символов.
  const payload = startPayload?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return `https://t.me/${username}${payload ? `?start=${payload}` : ""}`;
}
