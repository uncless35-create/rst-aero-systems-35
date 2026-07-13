import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/telegram";
import { chatHistoryQuerySchema, customerChatMessageSchema } from "@/lib/validation/chat";
import { registerSchema } from "@/lib/validation/auth";

describe("manager chat", () => {
  it("accepts a normal customer message and trims it", () => {
    const result = customerChatMessageSchema.safeParse({ message: "  Нужна помощь  ", privacyAccepted: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.message).toBe("Нужна помощь");
  });

  it("rejects spam honeypot and invalid conversation tokens", () => {
    expect(customerChatMessageSchema.safeParse({ message: "Тест", privacyAccepted: true, website: "spam" }).success).toBe(false);
    expect(chatHistoryQuerySchema.safeParse({ token: "predictable-id" }).success).toBe(false);
  });

  it("requires explicit privacy consent", () => {
    expect(customerChatMessageSchema.safeParse({ message: "Тест" }).success).toBe(false);
    expect(customerChatMessageSchema.safeParse({ message: "Тест", privacyAccepted: false }).success).toBe(false);
  });

  it("requires privacy consent during registration", () => {
    const registration = {
      name: "Иван",
      email: "ivan@example.com",
      phone: "+79000000000",
      password: "strong-password",
    };
    expect(registerSchema.safeParse(registration).success).toBe(false);
    expect(registerSchema.safeParse({ ...registration, privacyAccepted: true }).success).toBe(true);
  });

  it("escapes customer text before Telegram HTML formatting", () => {
    expect(escapeHtml("<b>A&B</b>")).toBe("&lt;b&gt;A&amp;B&lt;/b&gt;");
  });
});
