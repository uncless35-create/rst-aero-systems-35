import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

const validRegistration = {
  name: "Иван",
  email: "ivan@example.com",
  phone: "+7 900 000-00-00",
  password: "secure-password",
  privacyAccepted: true,
  website: "",
};

describe("auth validation", () => {
  it("accepts a normal registration", () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it("rejects weak credentials and spam honeypot", () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, phone: "---()---()" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, website: "spam.example" }).success).toBe(false);
  });

  it("bounds login input", () => {
    expect(loginSchema.safeParse({ email: `${"a".repeat(250)}@example.com`, password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ivan@example.com", password: "x".repeat(129) }).success).toBe(false);
  });
});
