/**
 * IndexNow — сообщаем Bing (на нём держится поиск ChatGPT) и Яндексу, что страница
 * появилась или изменилась, чтобы они переобошли её сразу, а не через дни.
 * Ключ публичный по протоколу: поисковик проверяет файл public/<ключ>.txt.
 */

export const INDEXNOW_KEY = "38f24755ca2484412ba82bca75980788";
const ENDPOINT = "https://api.indexnow.org/indexnow";

function siteBase(): URL | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return null;
  try {
    const url = new URL(site);
    // Локальная разработка и стенды не должны слать адреса в поисковики.
    return url.protocol === "https:" && url.hostname !== "localhost" ? url : null;
  } catch {
    return null;
  }
}

/** Пути (`/product/x`) или абсолютные ссылки этого сайта. Ошибки только логируются. */
export async function submitToIndexNow(paths: string[]): Promise<{ ok: boolean; status?: number; count: number }> {
  const base = siteBase();
  if (!base || paths.length === 0) return { ok: false, count: 0 };
  const urlList = [...new Set(paths.map((p) => new URL(p, base).toString()))]
    .filter((u) => new URL(u).host === base.host)
    .slice(0, 10_000);
  if (urlList.length === 0) return { ok: false, count: 0 };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: base.host,
        key: INDEXNOW_KEY,
        keyLocation: new URL(`/${INDEXNOW_KEY}.txt`, base).toString(),
        urlList,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 — принято, 202 — принято, ключ ещё проверяется
    if (res.status !== 200 && res.status !== 202) {
      console.error("IndexNow:", res.status, (await res.text()).slice(0, 300));
    }
    return { ok: res.status === 200 || res.status === 202, status: res.status, count: urlList.length };
  } catch (e) {
    console.error("IndexNow: запрос не прошёл", e);
    return { ok: false, count: urlList.length };
  }
}
