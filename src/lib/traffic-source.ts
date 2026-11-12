/**
 * Откуда пришёл покупатель. Proxy при заходе на страницу кладёт источник в cookie,
 * оформление заказа переносит его в `Order.trafficSource` / `Order.trafficInfo`.
 *
 * Модель — «последний значимый переход», как в Метрике: прямой заход не затирает
 * ранее известный источник, а новый переход из поиска, ChatGPT или по UTM-метке — затирает.
 * Модуль без зависимостей: он работает и в proxy (edge), и на сервере.
 */

export const TRAFFIC_COOKIE = "rst_src";
export const TRAFFIC_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

export type TrafficInfo = {
  /** Нормализованный ключ: chatgpt, yandex, google, telegram, avito, direct, other… */
  source: string;
  /** organic | cpc | referral | ai | social | direct | utm_medium как есть */
  medium?: string;
  campaign?: string;
  /** Хост внешнего сайта-реферера */
  referrer?: string;
  /** Страница входа, без query */
  landing?: string;
  /** Время перехода, ISO */
  at?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  alice: "Алиса",
  gigachat: "GigaChat",
  deepseek: "DeepSeek",
  claude: "Claude",
  gemini: "Gemini",
  yandex: "Яндекс",
  yandex_market: "Яндекс Маркет",
  google: "Google",
  bing: "Bing",
  mail: "Mail.ru",
  duckduckgo: "DuckDuckGo",
  telegram: "Telegram",
  avito: "Авито",
  vk: "ВКонтакте",
  youtube: "YouTube",
  dzen: "Дзен",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  direct: "Прямой заход",
  other: "Другой сайт",
};

/** Правила по хосту реферера (или по значению utm_source, если оно похоже на домен). */
const HOST_RULES: Array<[RegExp, string, string]> = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, "chatgpt", "ai"],
  [/(^|\.)perplexity\.ai$/, "perplexity", "ai"],
  [/(^|\.)alice\.yandex\.ru$/, "alice", "ai"],
  [/(^|\.)giga\.chat$|(^|\.)gigachat\./, "gigachat", "ai"],
  [/(^|\.)deepseek\.com$/, "deepseek", "ai"],
  [/(^|\.)claude\.ai$/, "claude", "ai"],
  [/(^|\.)gemini\.google\.com$/, "gemini", "ai"],
  [/(^|\.)market\.yandex\.(ru|com)$/, "yandex_market", "referral"],
  [/(^|\.)(yandex\.[a-z.]+|ya\.ru)$/, "yandex", "organic"],
  [/(^|\.)google\.[a-z.]+$/, "google", "organic"],
  [/(^|\.)bing\.com$/, "bing", "organic"],
  [/(^|\.)(go\.mail\.ru|mail\.ru)$/, "mail", "organic"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo", "organic"],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me|web\.telegram\.org)$/, "telegram", "social"],
  [/(^|\.)avito\.ru$/, "avito", "referral"],
  [/(^|\.)(vk\.com|vk\.ru|m\.vk\.com)$/, "vk", "social"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube", "social"],
  [/(^|\.)dzen\.ru$/, "dzen", "social"],
  [/(^|\.)instagram\.com$/, "instagram", "social"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp", "social"],
];

/** Короткие значения utm_source, которые пишут вручную в ссылках. */
const UTM_ALIASES: Record<string, string> = {
  chatgpt: "chatgpt",
  openai: "chatgpt",
  yandex: "yandex",
  ya: "yandex",
  yandex_direct: "yandex",
  yandex_products: "yandex",
  yandex_market: "yandex_market",
  market: "yandex_market",
  google: "google",
  google_merchant: "google",
  bing: "bing",
  telegram: "telegram",
  tg: "telegram",
  avito: "avito",
  vk: "vk",
  youtube: "youtube",
  dzen: "dzen",
  instagram: "instagram",
  whatsapp: "whatsapp",
};

function clean(value: string | null | undefined, max = 80): string | undefined {
  const v = value?.trim().toLowerCase();
  return v ? v.slice(0, max) : undefined;
}

function hostOf(value: string): string | undefined {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function matchHost(host: string): { source: string; medium: string } | undefined {
  for (const [re, source, medium] of HOST_RULES) {
    if (re.test(host)) return { source, medium };
  }
  return undefined;
}

/**
 * Источник из параметров ссылки и заголовка Referer.
 * `null` — переход внутри сайта или без признаков источника (прямой заход
 * решает вызывающий код: он записывается, только если источника ещё нет).
 */
export function detectTrafficSource(
  searchParams: URLSearchParams,
  referer: string | null,
  ownHosts: string[],
): Omit<TrafficInfo, "landing" | "at"> | null {
  const utmSource = clean(searchParams.get("utm_source"));
  const utmMedium = clean(searchParams.get("utm_medium"), 40);
  const utmCampaign = clean(searchParams.get("utm_campaign"), 120);
  const refHost = referer ? hostOf(referer) : undefined;
  const own = new Set(ownHosts.map((h) => h.toLowerCase().replace(/^www\./, "")));
  const externalRef = refHost && !own.has(refHost) ? refHost : undefined;

  if (utmSource) {
    const byAlias = UTM_ALIASES[utmSource];
    const byHost = matchHost(utmSource.replace(/^www\./, ""));
    const source = byAlias ?? byHost?.source ?? utmSource.replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
    return {
      source: source || "other",
      medium: utmMedium ?? byHost?.medium ?? "referral",
      campaign: utmCampaign,
      referrer: externalRef,
    };
  }
  // Клики по рекламе без UTM-меток
  if (searchParams.has("yclid")) {
    return { source: "yandex", medium: "cpc", campaign: utmCampaign, referrer: externalRef };
  }
  if (searchParams.has("gclid")) {
    return { source: "google", medium: "cpc", campaign: utmCampaign, referrer: externalRef };
  }
  if (externalRef) {
    const byHost = matchHost(externalRef);
    return byHost
      ? { ...byHost, referrer: externalRef }
      : { source: "other", medium: "referral", referrer: externalRef };
  }
  return null;
}

/** Next сам кодирует значение cookie, поэтому здесь — чистый JSON. */
export function encodeTrafficInfo(info: TrafficInfo): string {
  return JSON.stringify(info);
}

/** Разбор cookie/JSON из БД. Мусор и подделки → null. */
export function parseTrafficInfo(raw: string | null | undefined): TrafficInfo | null {
  if (!raw) return null;
  try {
    const text = raw.startsWith("%7B") || raw.startsWith("%7b") ? decodeURIComponent(raw) : raw;
    const v = JSON.parse(text) as Record<string, unknown>;
    if (!v || typeof v !== "object" || typeof v.source !== "string" || !v.source) return null;
    const str = (x: unknown, max: number) => (typeof x === "string" && x ? x.slice(0, max) : undefined);
    return {
      source: v.source.slice(0, 40),
      medium: str(v.medium, 40),
      campaign: str(v.campaign, 120),
      referrer: str(v.referrer, 120),
      landing: str(v.landing, 200),
      at: str(v.at, 40),
    };
  } catch {
    return null;
  }
}

/** «ChatGPT», «Яндекс · реклама», «Другой сайт: drones.ru» */
export function trafficSourceLabel(info: Pick<TrafficInfo, "source" | "medium" | "referrer"> | null): string {
  if (!info) return "Неизвестно";
  const base = SOURCE_LABELS[info.source] ?? info.source;
  if (info.source === "other" && info.referrer) return `${base}: ${info.referrer}`;
  if (info.medium === "cpc" || info.medium === "ppc" || info.medium === "paid") return `${base} · реклама`;
  return base;
}

/** Подпись по одному ключу (для группировки в отчётах). */
export function trafficSourceName(source: string | null | undefined): string {
  if (!source) return "Неизвестно";
  return SOURCE_LABELS[source] ?? source;
}
