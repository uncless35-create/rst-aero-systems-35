import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя"),
  email: z.string().trim().email("Некорректный email"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
