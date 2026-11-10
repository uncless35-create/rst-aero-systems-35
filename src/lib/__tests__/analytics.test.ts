import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("аналитика магазина", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRICA_ID", "110583758");
    vi.stubGlobal("window", { localStorage: storage(), sessionStorage: storage(), dispatchEvent: vi.fn(), ym: vi.fn() });
    vi.stubGlobal("document", { title: "Каталог" });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("не отправляет просмотры или цели до согласия и не помечает заказ отправленным", async () => {
    const analytics = await import("@/lib/analytics");
    expect(analytics.trackPageView("https://rst-aero.ru/", "")).toBe(false);
    expect(analytics.trackGoal("order", "ym-order-1001")).toBe(false);
    expect(window.ym).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("ym-order-1001")).toBeNull();

    window.localStorage.setItem(analytics.ANALYTICS_CONSENT_KEY, `${PRIVACY_POLICY_VERSION}:accepted`);
    analytics.trackPageView("https://rst-aero.ru/order/secret/success", "");
    expect(analytics.trackGoal("order", "ym-order-1001")).toBe(true);
    analytics.trackGoal("order", "ym-order-1001");
    expect(vi.mocked(window.ym!).mock.calls.filter((call) => call[1] === "reachGoal")).toHaveLength(1);
  });

  it("считает переходы SPA один раз и сохраняет источник первой страницы", async () => {
    const analytics = await import("@/lib/analytics");
    window.localStorage.setItem(analytics.ANALYTICS_CONSENT_KEY, `${PRIVACY_POLICY_VERSION}:accepted`);
    const landing = "https://rst-aero.ru/?utm_source=telegram&utm_medium=social";
    analytics.trackPageView(landing, "https://www.google.com/");
    analytics.trackPageView(landing, "https://www.google.com/");
    analytics.trackPageView("https://rst-aero.ru/catalog", "https://www.google.com/");
    const calls = vi.mocked(window.ym!).mock.calls;
    expect(calls.filter((call) => call[1] === "init")).toHaveLength(1);
    expect(calls.filter((call) => call[1] === "hit")).toEqual([
      [110583758, "hit", landing, { title: "Каталог", referer: "https://www.google.com/" }],
      [110583758, "hit", "https://rst-aero.ru/catalog", { title: "Каталог", referer: landing }],
    ]);
  });

  it("скрывает секреты заказа, параметры входа и фрагменты", async () => {
    const { analyticsUrl } = await import("@/lib/analytics");
    expect(analyticsUrl("https://rst-aero.ru/order/secret/success?order=secret#token"))
      .toBe("https://rst-aero.ru/order/success");
    expect(analyticsUrl("https://rst-aero.ru/login?callbackUrl=/account&order=secret"))
      .toBe("https://rst-aero.ru/login");
    expect(analyticsUrl("https://rst-aero.ru/account/orders/1001"))
      .toBe("https://rst-aero.ru/account/orders/detail");
  });

  it("не мешает покупкам при недоступном хранилище или неверном счётчике", async () => {
    const analytics = await import("@/lib/analytics");
    window.localStorage.getItem = () => { throw new Error("blocked"); };
    expect(analytics.trackGoal("add_to_cart")).toBe(false);
    expect(analytics.trackPageView("https://rst-aero.ru/", "")).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRICA_ID", "0");
    expect(analytics.trackPageView("https://rst-aero.ru/", "")).toBe(false);
  });
});
