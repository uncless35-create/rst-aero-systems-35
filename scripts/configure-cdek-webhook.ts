// Подписать сайт на смену статусов отправлений СДЭК (вебхук ORDER_STATUS).
// Запускать на сервере после смены домена или ключей СДЭК: pnpm cdek:webhook
import "dotenv/config";
import {
  createCdekWebhook,
  deleteCdekWebhook,
  getCdekWebhookSecret,
  listCdekWebhooks,
} from "../src/lib/cdek";

const PATH = "/api/webhooks/cdek";

async function main() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("Не настроен NEXT_PUBLIC_SITE_URL");
  const url = new URL(PATH, siteUrl);
  if (url.protocol !== "https:") throw new Error("Вебхук СДЭК регистрируем только на боевом HTTPS-адресе");
  url.searchParams.set("secret", getCdekWebhookSecret());
  const target = url.toString();

  const existing = (await listCdekWebhooks()).filter((w) => w.type === "ORDER_STATUS");
  let present = false;
  for (const hook of existing) {
    if (hook.url === target) {
      present = true;
    } else if (hook.url.includes(PATH)) {
      // Наш же вебхук со старым доменом или секретом.
      await deleteCdekWebhook(hook.uuid);
      console.log(`Удалён устаревший вебхук ${hook.uuid}`);
    }
  }
  if (!present) await createCdekWebhook("ORDER_STATUS", target);
  console.log(`Вебхук СДЭК ${present ? "уже был" : "зарегистрирован"}: ${url.origin}${PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
