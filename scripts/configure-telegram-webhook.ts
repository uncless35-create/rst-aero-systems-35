import "dotenv/config";
import { getTelegramWebhookSecret } from "../src/lib/telegram";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = getTelegramWebhookSecret();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!token || !secret) throw new Error("Не настроен TELEGRAM_BOT_TOKEN");
  if (!siteUrl) throw new Error("Не настроен NEXT_PUBLIC_SITE_URL");

  const url = new URL("/api/webhooks/telegram", siteUrl);
  if (url.protocol !== "https:") {
    throw new Error("Telegram webhook можно зарегистрировать только на боевом HTTPS-адресе");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.toString(),
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API: ${response.status}`);
  }
  console.log(`Webhook зарегистрирован: ${url.origin}/api/webhooks/telegram`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
