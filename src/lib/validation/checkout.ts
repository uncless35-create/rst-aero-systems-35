import { z } from "zod";
import { isAllowedCdekTariff } from "@/lib/cdek-options";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1).max(64),
  variantId: z.string().min(1).max(64).nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Укажите имя").max(100, "Слишком длинное имя"),
  customerPhone: z
    .string()
    .trim()
    .min(10, "Укажите телефон")
    .max(20, "Слишком длинный номер")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, "Некорректный номер телефона"),
  customerEmail: z
    .string()
    .trim()
    .max(254, "Слишком длинный email")
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
  privacyAccepted: z.boolean().refine((accepted) => accepted, "Подтвердите согласие с политикой конфиденциальности"),
  deliveryMethodId: z.string().min(1, "Выберите способ доставки").max(64),
  deliveryAddress: z.string().trim().max(500).optional().or(z.literal("")),
  cdek: z
    .object({
      mode: z.enum(["office", "door"]),
      tariffCode: z.number().int().positive(),
      cityCode: z.number().int().positive().nullable(),
      pvzCode: z.string().trim().max(50).nullable(),
      deliverySumKopecks: z.number().int().min(0).max(10_000_000),
    })
    .superRefine((selection, ctx) => {
      if (!isAllowedCdekTariff(selection.mode, selection.tariffCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["tariffCode"],
          message: "Недоступный тариф СДЭК",
        });
      }
      if (selection.mode === "office" && !selection.pvzCode) {
        ctx.addIssue({
          code: "custom",
          path: ["pvzCode"],
          message: "Выберите пункт выдачи СДЭК",
        });
      }
    })
    .optional(),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  website: z.string().max(0).optional(), // honeypot: обычный покупатель поле не видит
  items: z.array(checkoutItemSchema).min(1, "Корзина пуста").max(50, "Слишком много позиций в заказе"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
