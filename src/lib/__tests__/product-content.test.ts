import { describe, expect, it } from "vitest";
import { productContent, validateProductContent } from "@/data/product-content";

describe("product content registry", () => {
  it("contains a valid unique record for every current catalog product", () => {
    expect(productContent).toHaveLength(43);
    expect(validateProductContent()).toEqual([]);
    expect(new Set(productContent.map((record) => record.slug)).size).toBe(43);
  });

  it("does not mark unresolved variants as verified", () => {
    const unresolved = productContent.filter((record) => record.status === "NEEDS_REVIEW");
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved.every((record) => record.reviewNote)).toBe(true);
  });

  it("uses secure URLs for sources and replacement product images", () => {
    for (const record of productContent) {
      expect(record.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
      if (record.primaryImageUrl) expect(record.primaryImageUrl.startsWith("https://")).toBe(true);
    }
  });
});
