import { describe, expect, it } from "vitest";
import { buildProductFeed, type FeedProduct } from "@/lib/product-feed";

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
});
