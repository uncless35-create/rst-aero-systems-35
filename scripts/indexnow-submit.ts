// Отправить все адреса из карты сайта в IndexNow (Bing → ChatGPT, Яндекс).
// Запускать на сервере после крупных правок каталога: pnpm indexnow
// Отдельные товары отправляются сами при сохранении в админке.
import "dotenv/config";
import { submitToIndexNow } from "../src/lib/indexnow";

async function main() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new Error("Не настроен NEXT_PUBLIC_SITE_URL");
  const res = await fetch(new URL("/sitemap.xml", site));
  if (!res.ok) throw new Error(`sitemap.xml: ${res.status}`);
  const urls = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const result = await submitToIndexNow(urls);
  console.log(result.ok ? `Отправлено адресов: ${result.count} (ответ ${result.status})` : `Не отправлено: ${JSON.stringify(result)}`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
