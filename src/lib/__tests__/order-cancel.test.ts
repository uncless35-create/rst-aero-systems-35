import { describe, expect, it } from "vitest";
import { customerCancelBlockReason } from "@/lib/order-cancel";
import { normalizeRuPhone } from "@/lib/phone";

const fresh = { status: "NEW", paymentStatus: "PENDING", cdekOrderUuid: null };

describe("отмена заказа покупателем", () => {
  it("разрешена, пока заказ новый или в обработке и не отправлен", () => {
    expect(customerCancelBlockReason(fresh)).toBeNull();
    expect(customerCancelBlockReason({ ...fresh, status: "PROCESSING" })).toBeNull();
  });

  it("запрещена после передачи в СДЭК, отправки, оплаты и повторной отмены", () => {
    expect(customerCancelBlockReason({ ...fresh, cdekOrderUuid: "uuid" })).not.toBeNull();
    expect(customerCancelBlockReason({ ...fresh, status: "SHIPPED" })).not.toBeNull();
    expect(customerCancelBlockReason({ ...fresh, status: "COMPLETED" })).not.toBeNull();
    expect(customerCancelBlockReason({ ...fresh, paymentStatus: "SUCCEEDED" })).not.toBeNull();
    expect(customerCancelBlockReason({ ...fresh, status: "PAID" })).not.toBeNull();
    expect(customerCancelBlockReason({ ...fresh, status: "CANCELLED" })).toBe("Заказ уже отменён.");
  });
});

describe("normalizeRuPhone", () => {
  it("приводит российские номера к виду 7XXXXXXXXXX", () => {
    expect(normalizeRuPhone("+7 (988) 652-22-52")).toBe("79886522252");
    expect(normalizeRuPhone("89886522252")).toBe("79886522252");
    expect(normalizeRuPhone("988 652 22 52")).toBe("79886522252");
  });

  it("не придумывает номер из мусора", () => {
    expect(normalizeRuPhone("12345")).toBeNull();
    expect(normalizeRuPhone("+1 415 555 0100 22")).toBeNull();
  });
});
