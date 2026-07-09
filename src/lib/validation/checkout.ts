import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Укажите имя"),
  customerPhone: z
    .string()
    .trim()
    .min(10, "Укажите телефон")
    .max(20, "Слишком длинный номер"),
  customerEmail: z
    .string()
    .trim()
    .email("Некорректный email")
    .optional()
    .or(z.literal("")),
  deliveryMethodId: z.string().min(1, "Выберите способ доставки"),
  deliveryAddress: z.string().trim().max(500).optional().or(z.literal("")),
  cdek: z
    .object({
      mode: z.enum(["office", "door"]),
      tariffCode: z.number().int(),
      cityCode: z.number().int().nullable(),
      pvzCode: z.string().max(50).nullable(),
      deliverySumKopecks: z.number().int().min(0).max(10_000_000),
    })
    .optional(),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z.array(checkoutItemSchema).min(1, "Корзина пуста"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
