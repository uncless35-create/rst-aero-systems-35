import { describe, expect, it } from "vitest";
import { buildProductFeed, detectVendor, feedLinkParams, type FeedProduct } from "@/lib/product-feed";

const product: FeedProduct = {
  id: "product-1", slug: "fpv-drone", name: 'Дрон & "пульт"', summary: "<FPV>\u0000", description: null,
  priceKopecks: 123456, oldPriceKopecks: 150000, stockQty: 5, outOfStock: false,
  isActive: true, contentStatus: "VERIFIED",
  category: { id: "category-1", name: "Дроны & аппаратура", isVisible: true },
  images: [{ url: "/products/drone.jpg" }], variants: [],
};

describe("товарный YML-фид", () => {
  it("публикует цены в рублях, абсолютные ссылки и корректно экранирует XML", () => {
    const feed = buildProductFeed([product], "https://rst-aero.ru", new Date("2026-11-10T12:34:00Z"));
    expect(feed).toContain('<yml_catalog date="2026-11-10 12:34">');
    expect(feed).toContain('<offer id="product-1" available="true">');
    expect(feed).toContain("<price>1234.56</price>");
    expect(feed).toContain("<oldprice>1500.00</oldprice>");
    expect(feed).toContain("https://rst-aero.ru/products/drone.jpg");
    expect(feed).toContain("Дрон &amp; &quot;пульт&quot;");
    expect(feed).toContain("<description>&lt;FPV&gt;</description>");
  });

  it("не рекламирует скрытые, непроверенные товары, товары без фото или цены", () => {
    for (const change of [
      { isActive: false }, { contentStatus: "NEEDS_REVIEW" }, { images: [] },
      { category: { ...product.category, isVisible: false } }, { priceKopecks: 0 },
      { images: [{ url: "javascript:alert(1)" }] },
    ]) {
      expect(buildProductFeed([{ ...product, ...change }], "https://rst-aero.ru")).not.toContain("<offer id=");
    }
  });

  it("передаёт цену и наличие каждого варианта, не подменяя их остатком родителя", () => {
    const feed = buildProductFeed([{ ...product, variants: [
      { id: "black", name: "Чёрный", priceKopecks: 234567, stockQty: 0 },
      { id: "white", name: "Белый", priceKopecks: null, stockQty: 2 },
    ] }], "https://rst-aero.ru");
    expect(feed).toContain('<offer id="product-1:black" available="false">');
    expect(feed).toContain("<price>2345.67</price>");
    expect(feed).toContain('<offer id="product-1:white" available="true">');
    expect(feed).toContain("<price>1234.56</price>");
    const blackOffer = feed.split('<offer id="product-1:black"')[1].split("</offer>")[0];
    expect(blackOffer).not.toContain("<oldprice>");
  });

  it("уважает принудительную отметку отсутствия товара", () => {
    expect(buildProductFeed([{ ...product, outOfStock: true }], "https://rst-aero.ru"))
      .toContain('<offer id="product-1" available="false">');
  });

  it("ставит бренд по названию, а в сборных комплектах — нет", () => {
    expect(detectVendor("Тинивуп BetaFPV Air65 II (Racing)")).toBe("BETAFPV");
    expect(detectVendor("Cinewhoop BETAFPV Pavo20 Pro (O4 Pro PNP, ELRS)")).toBe("BETAFPV");
    expect(detectVendor("FPV-дрон GEPRC Vapor X5 (DJI O4 Pro, ELRS)")).toBe("GEPRC");
    expect(detectVendor("FPV-дрон GEPRC Vapor X5 (аналог, ELRS)")).toBe("GEPRC");
    expect(detectVendor("Тинивуп HappyModel Mobula7 1S (ELRS)")).toBe("HappyModel");
    expect(detectVendor("Аппаратура RadioMaster Pocket (ELRS)")).toBe("RadioMaster");
    expect(detectVendor("FPV-комплект «Цифра DJI O4» под ключ: Meteor75 Pro O4, Pocket и Goggles N3")).toBeNull();
    expect(detectVendor("Готовый FPV-комплект для новичка: дрон, очки, пульт")).toBeNull();
    const feed = buildProductFeed([{ ...product, name: "Стек SpeedyBee F405 V4 (60A)" }], "https://rst-aero.ru");
    expect(feed).toContain("<vendor>SpeedyBee</vendor>");
  });

  it("добавляет к ссылкам UTM-метки площадки и отбрасывает мусор", () => {
    const params = feedLinkParams(new URLSearchParams("utm_source=yandex&utm_medium=products&utm_campaign=<x>&foo=1"));
    expect(params).toEqual({ utm_source: "yandex", utm_medium: "products" });
    const feed = buildProductFeed([product], "https://rst-aero.ru", new Date(), params);
    expect(feed).toContain("<url>https://rst-aero.ru/product/fpv-drone?utm_source=yandex&amp;utm_medium=products</url>");
  });
});
