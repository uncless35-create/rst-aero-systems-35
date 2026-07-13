import { describe, expect, it } from "vitest";
import { isAllowedCdekTariff } from "@/lib/cdek-options";
import { checkoutSchema } from "@/lib/validation/checkout";

const baseCheckout = {
  customerName: "Иван",
  customerPhone: "+79000000000",
  customerEmail: "",
  privacyAccepted: true,
  deliveryMethodId: "delivery-1",
  deliveryAddress: "Москва, ПВЗ",
  items: [{ productId: "product-1", variantId: null, quantity: 1 }],
};

describe("CDEK checkout validation", () => {
  it("requires explicit privacy consent", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, privacyAccepted: false }).success).toBe(false);
  });

  it("rejects invalid phones and a filled spam honeypot", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, customerPhone: "abcdefghij" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...baseCheckout, website: "spam.example" }).success).toBe(false);
  });

  it("limits field lengths and the number of order lines", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, customerName: "И".repeat(101) }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({
        ...baseCheckout,
        items: Array.from({ length: 51 }, (_, index) => ({
          productId: `product-${index}`,
          variantId: null,
          quantity: 1,
        })),
      }).success,
    ).toBe(false);
  });

  it("accepts only tariffs assigned to the selected mode", () => {
    expect(isAllowedCdekTariff("office", 136)).toBe(true);
    expect(isAllowedCdekTariff("office", 137)).toBe(false);
    expect(isAllowedCdekTariff("door", 137)).toBe(true);
  });

  it("rejects an arbitrary tariff", () => {
    const result = checkoutSchema.safeParse({
      ...baseCheckout,
      cdek: {
        mode: "office",
        tariffCode: 1,
        cityCode: 44,
        pvzCode: "MSK1",
        deliverySumKopecks: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it("requires a pickup point for office delivery", () => {
    const result = checkoutSchema.safeParse({
      ...baseCheckout,
      cdek: {
        mode: "office",
        tariffCode: 136,
        cityCode: 44,
        pvzCode: null,
        deliverySumKopecks: 35_000,
      },
    });
    expect(result.success).toBe(false);
  });
});
