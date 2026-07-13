import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(100, "Слишком длинное имя"),
  email: z.string().trim().max(254, "Слишком длинный email").email("Некорректный email"),
  phone: z
    .string()
    .trim()
    .max(20, "Слишком длинный номер")
    .refine((value) => {
      if (!value || !/^\+?[\d\s()-]+$/.test(value)) return !value;
      const digitCount = value.replace(/\D/g, "").length;
      return digitCount >= 10 && digitCount <= 15;
    }, "Некорректный номер телефона")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Минимум 8 символов").max(128, "Слишком длинный пароль"),
  privacyAccepted: z.boolean().refine((accepted) => accepted, "Подтвердите согласие с политикой конфиденциальности"),
  website: z.string().max(0).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().max(254).email("Некорректный email"),
  password: z.string().min(1, "Введите пароль").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
