"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import { consumeRateLimit } from "@/lib/rate-limit";

export type RegisterResult = { ok: true } | { ok: false; error: string };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте данные" };
  }

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  if (consumeRateLimit(`register:${clientIp}`, 5, 60 * 60_000)) {
    return { ok: false, error: "Слишком много попыток регистрации. Повторите позже." };
  }

  const { name, email, phone, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: false, error: "Пользователь с таким email уже существует" };
  }

  try {
    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: phone || null,
        passwordHash: await bcrypt.hash(password, 10),
        role: "CUSTOMER",
        privacyAcceptedAt: new Date(),
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Пользователь с таким email уже существует" };
    }
    console.error("Ошибка регистрации:", error);
    return { ok: false, error: "Не удалось зарегистрироваться. Повторите попытку." };
  }

  return { ok: true };
}
