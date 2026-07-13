import { describe, expect, it } from "vitest";
import { productImageSchema, productSchema } from "@/lib/validation/product";

const baseProduct = {
  name: "Тестовый товар",
  slug: "test-product",
  categoryId: "category-1",
  description: "Полное описание товара",
  summary: "Краткое описание",
  exactVariant: "ELRS 2.4 ГГц",
  compatibility: "Совместимость указана",
  packageContents: "Товар и инструкция",
  contentStatus: "VERIFIED" as const,
  contentReviewNote: "",
  sources: [{ label: "Производитель", url: "https://example.com/product", type: "OFFICIAL_PRODUCT" as const }],
  priceKopecks: 100_000,
  stockQty: 0,
  isActive: true,
  outOfStock: false,
  isFeatured: false,
  attributes: [
    { name: "Версия", value: "1" },
    { name: "Масса", value: "10 г" },
    { name: "Питание", value: "5 В" },
  ],
  images: [{ url: "/products/test-product.jpg", alt: "Тестовый товар" }],
  variants: [],
};

describe("product admin validation", () => {
  it("accepts a complete verified product", () => {
    expect(productSchema.safeParse(baseProduct).success).toBe(true);
  });

  it("does not allow an incomplete product to be marked verified", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      exactVariant: "",
      sources: [],
      attributes: [{ name: "Версия", value: "1" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("does not allow an incomplete draft onto the storefront", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      contentStatus: "DRAFT",
      summary: "",
      description: "",
      sources: [],
      attributes: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("allows an incomplete draft only while it remains inactive", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      isActive: false,
      contentStatus: "DRAFT",
      summary: "",
      exactVariant: "",
      description: "",
      compatibility: "",
      packageContents: "",
      sources: [],
      attributes: [],
      images: [],
      priceKopecks: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a reason for review status", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      contentStatus: "NEEDS_REVIEW",
      contentReviewNote: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("allows only configured remote product image hosts", () => {
    expect(productImageSchema.safeParse({
      url: "https://radiomasterrc.com/cdn/shop/files/TX15MAX.jpg",
      alt: "TX15 MAX",
    }).success).toBe(true);
    expect(productImageSchema.safeParse({ url: "https://example.com/image.jpg" }).success).toBe(false);
  });
});
