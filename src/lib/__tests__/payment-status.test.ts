import { describe, expect, it } from "vitest";
import { mapTbankStatus } from "@/lib/tbank";
import { mapPaymentStatus } from "@/lib/yookassa";

describe("payment status mapping", () => {
  it("marks confirmed T-Bank payments as paid", () => {
    expect(mapTbankStatus("CONFIRMED")).toEqual({
      paymentStatus: "SUCCEEDED",
      orderStatus: "PAID",
    });
  });

  it("marks cancelled YooKassa payments as cancelled", () => {
    expect(mapPaymentStatus("canceled")).toEqual({
      paymentStatus: "CANCELLED",
      orderStatus: "CANCELLED",
    });
  });
});
