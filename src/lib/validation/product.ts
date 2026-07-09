import { z } from "zod";

export const productImageSchema = z.object({
  url: z.string().url("Некорректный URL изображения"),
  alt: z.string().optional().nullable(),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Укажите название варианта"),
  priceKopecks: z.number().int().min(0).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  sku: z.string().trim().optional().nullable(),
});

export const productAttributeSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Укажите название"),
  slug: z.string().trim().optional(),
  categoryId: z.string().min(1, "Выберите категорию"),
  description: z.string().trim().optional(),
  priceKopecks: z.coerce.number().int().min(0, "Цена не может быть отрицательной"),
  oldPriceKopecks: z.number().int().min(0).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  weightGrams: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  badge: z.string().trim().optional().nullable(),
  variantLabel: z.string().trim().optional().nullable(),
  attributes: z.array(productAttributeSchema).default([]),
  images: z.array(productImageSchema).default([]),
  variants: z.array(productVariantSchema).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;
