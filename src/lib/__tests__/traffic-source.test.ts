import { describe, expect, it } from "vitest";
import {
  detectTrafficSource,
  encodeTrafficInfo,
  parseTrafficInfo,
  trafficSourceLabel,
} from "@/lib/traffic-source";

const own = ["rst-aero.ru"];
const detect = (query: string, referer: string | null = null) =>
  detectTrafficSource(new URLSearchParams(query), referer, own);

describe("detectTrafficSource", () => {
  it("ChatGPT по метке, которую он сам добавляет к ссылкам", () => {
    expect(detect("utm_source=chatgpt.com")).toMatchObject({ source: "chatgpt", medium: "ai" });
  });

  it("поисковики по рефереру", () => {
    expect(detect("", "https://yandex.ru/")).toMatchObject({ source: "yandex", medium: "organic" });
    expect(detect("", "https://ya.ru/")).toMatchObject({ source: "yandex" });
    expect(detect("", "https://www.google.com/")).toMatchObject({ source: "google", medium: "organic" });
    expect(detect("", "https://www.bing.com/search?q=x")).toMatchObject({ source: "bing" });
  });

  it("Маркет и Алиса не путаются с поиском Яндекса", () => {
    expect(detect("", "https://market.yandex.ru/product/1")).toMatchObject({ source: "yandex_market" });
    expect(detect("", "https://alice.yandex.ru/")).toMatchObject({ source: "alice", medium: "ai" });
  });

  it("реклама: yclid/gclid и utm_medium=cpc", () => {
    expect(detect("yclid=123")).toMatchObject({ source: "yandex", medium: "cpc" });
    expect(detect("gclid=abc")).toMatchObject({ source: "google", medium: "cpc" });
    expect(detect("utm_source=yandex&utm_medium=cpc&utm_campaign=Tinywhoop")).toMatchObject({
      source: "yandex",
      medium: "cpc",
      campaign: "tinywhoop",
    });
  });

  it("соцсети и мессенджеры", () => {
    expect(detect("", "https://t.me/")).toMatchObject({ source: "telegram" });
    expect(detect("utm_source=tg")).toMatchObject({ source: "telegram" });
    expect(detect("", "https://vk.com/")).toMatchObject({ source: "vk" });
  });

  it("незнакомый сайт — other с хостом", () => {
    expect(detect("", "https://forum.example.org/t/1")).toEqual({
      source: "other",
      medium: "referral",
      referrer: "forum.example.org",
    });
  });

  it("свой сайт и заход без реферера — не источник", () => {
    expect(detect("", "https://rst-aero.ru/catalog")).toBeNull();
    expect(detect("", "https://www.rst-aero.ru/catalog")).toBeNull();
    expect(detect("")).toBeNull();
  });
});

describe("cookie", () => {
  it("кодируется и читается обратно", () => {
    const info = { source: "chatgpt", medium: "ai", landing: "/product/x", at: "2026-11-12T10:00:00.000Z" };
    expect(parseTrafficInfo(encodeTrafficInfo(info))).toEqual(info);
  });

  it("мусор не ломает оформление", () => {
    expect(parseTrafficInfo("garbage")).toBeNull();
    expect(parseTrafficInfo("%7Bbroken")).toBeNull();
    expect(parseTrafficInfo(JSON.stringify({ medium: "x" }))).toBeNull();
    expect(parseTrafficInfo(undefined)).toBeNull();
  });
});

describe("trafficSourceLabel", () => {
  it("подписи", () => {
    expect(trafficSourceLabel({ source: "chatgpt" })).toBe("ChatGPT");
    expect(trafficSourceLabel({ source: "yandex", medium: "cpc" })).toBe("Яндекс · реклама");
    expect(trafficSourceLabel({ source: "other", referrer: "drones.ru" })).toBe("Другой сайт: drones.ru");
    expect(trafficSourceLabel(null)).toBe("Неизвестно");
  });
});
