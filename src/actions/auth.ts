"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export type RegisterResult = { ok: true } | { ok: false; error: string };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте данные" };
  }
  const { name, email, phone, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: false, error: "Пользователь с таким email уже существует" };
  }

  await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      phone: phone || null,
      passwordHash: await bcrypt.hash(password, 10),
      role: "CUSTOMER",
    },
  });

  return { ok: true };
}
