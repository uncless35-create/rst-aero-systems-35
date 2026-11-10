import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

export const ANALYTICS_CONSENT_KEY = "rst-analytics-consent";
export const METRICA_READY_EVENT = "rst:metrica-ready";

type Metrica = {
  (...args: unknown[]): void;
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: Metrica;
  }
}

let initialized = false;
let previousUrl: string | undefined;

export function hasAnalyticsConsent(): boolean {
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === `${PRIVACY_POLICY_VERSION}:accepted`;
  } catch {
    return false;
  }
}

function counterId(): number | null {
  const value = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID ?? "";
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Не передаём секреты гостевых заказов и параметры входа в URL аналитики. */
export function analyticsUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.pathname = url.pathname
    .replace(/^\/order\/[^/]+\/success\/?$/, "/order/success")
    .replace(/^\/account\/orders\/[^/]+\/?$/, "/account/orders/detail");
  for (const key of [...url.searchParams.keys()]) {
    if (!/^(utm_(source|medium|campaign|content|term)|yclid|ysclid|gclid|sort|inStock)$/.test(key)) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

export function trackPageView(value: string, referrer: string): boolean {
  const id = counterId();
  if (!id || !hasAnalyticsConsent()) return false;
  if (!window.ym) {
    const queue: Metrica = (...args) => { (queue.a ??= []).push(args); };
    queue.l = Date.now();
    window.ym = queue;
  }
  if (!initialized) {
    window.ym(id, "init", {
      defer: true,
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
    initialized = true;
  }
  const url = analyticsUrl(value);
  if (url === previousUrl) return false;
  let referer = previousUrl;
  if (!referer && /^https?:\/\//.test(referrer)) referer = analyticsUrl(referrer);
  window.ym(id, "hit", url, { title: document.title, referer });
  previousUrl = url;
  window.dispatchEvent(new Event(METRICA_READY_EVENT));
  return true;
}

export type AnalyticsGoal = "add_to_cart" | "checkout_start" | "order" | "chat_message" | "contact_email" | "contact_phone" | "contact_telegram";

/** События до согласия не копятся и не отправляются задним числом. */
export function trackGoal(goal: AnalyticsGoal, onceKey?: string): boolean {
  const id = counterId();
  if (!id || !initialized || !hasAnalyticsConsent() || !window.ym) return false;
  if (onceKey) {
    try {
      if (window.sessionStorage.getItem(onceKey)) return true;
    } catch { /* События работают и без sessionStorage. */ }
  }
  window.ym(id, "reachGoal", goal);
  if (onceKey) {
    try {
      window.sessionStorage.setItem(onceKey, "1");
    } catch { /* Приватный режим: дедупликация ограничена текущей страницей. */ }
  }
  return true;
}
