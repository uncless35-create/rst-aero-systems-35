import { z } from "zod";

function isAllowedProductImageUrl(value: string): boolean {
  if (
    !value.includes("..") &&
    /^\/(products|category-covers)\/[A-Za-z0-9_./%-]+$/.test(value)
  ) {
    return true;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname.endsWith(".supabase.co")) return true;
    return url.hostname === "radiomasterrc.com" && url.pathname.startsWith("/cdn/shop/files/");
  } catch {
    return false;
  }
}

export const productImageSchema = z.object({
  url: z
    .string()
    .trim()
    .refine(isAllowedProductImageUrl, "Разрешены локальные изображения и HTTPS-ссылки Supabase"),
  alt: z.string().optional().nullable(),
});

export const productVariantSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(1, "Укажите название варианта").max(200),
  priceKopecks: z.number().int().min(0).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  sku: z.string().trim().max(200).optional().nullable(),
});

export const productAttributeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(1000),
});

export const productSourceSchema = z.object({
  label: z.string().trim().min(2).max(200),
  url: z.string().trim().url().refine((value) => value.startsWith("https://"), "Источник должен использовать HTTPS"),
  type: z.enum(["OFFICIAL_PRODUCT", "OFFICIAL_MANUAL", "DISTRIBUTOR", "OTHER"]),
});

type ListingContent = {
  summary?: string | null;
  exactVariant?: string | null;
  description?: string | null;
  compatibility?: string | null;
  packageContents?: string | null;
  contentStatus: "DRAFT" | "NEEDS_REVIEW" | "VERIFIED";
  contentReviewNote?: string | null;
  priceKopecks: number;
  attributes: { name: string; value: string }[];
  sources: { label: string; url: string; type: string }[];
  images: unknown[];
};

export type ListingContentIssue = { field: string; message: string };

/** Требования к карточке, прежде чем она может появиться на витрине. */
export function getListingContentIssues(product: ListingContent): ListingContentIssue[] {
  const issues: ListingContentIssue[] = [];
  if (product.contentStatus !== "NEEDS_REVIEW" && product.contentStatus !== "VERIFIED") {
    issues.push({ field: "contentStatus", message: "Черновик нельзя публиковать на витрине" });
  }
  if (product.contentStatus === "NEEDS_REVIEW" && !product.contentReviewNote?.trim()) {
    issues.push({ field: "contentReviewNote", message: "Укажите, что именно требуется проверить" });
  }
  const requiredTextFields = [
    ["summary", product.summary],
    ["exactVariant", product.exactVariant],
    ["description", product.description],
    ["compatibility", product.compatibility],
    ["packageContents", product.packageContents],
  ] as const;
  for (const [field, value] of requiredTextFields) {
    if (!value?.trim()) issues.push({ field, message: "Заполните поле перед публикацией" });
  }
  if (product.attributes.length < 3) {
    issues.push({ field: "attributes", message: "Добавьте минимум три характеристики" });
  }
  if (product.sources.length === 0) {
    issues.push({ field: "sources", message: "Добавьте источник характеристик" });
  }
  if (product.images.length === 0) {
    issues.push({ field: "images", message: "Добавьте фотографию товара" });
  }
  if (product.priceKopecks <= 0) {
    issues.push({ field: "priceKopecks", message: "Укажите цену перед публикацией" });
  }
  return issues;
}

export const productSchema = z.object({
  name: z.string().trim().min(2, "Укажите название").max(300),
  slug: z.string().trim().max(300).optional(),
  categoryId: z.string().min(1, "Выберите категорию").max(64),
  description: z.string().trim().max(20_000).optional(),
  summary: z.string().trim().max(1200).optional(),
  exactVariant: z.string().trim().max(500).optional(),
  compatibility: z.string().trim().max(8000).optional(),
  packageContents: z.string().trim().max(8000).optional(),
  contentStatus: z.enum(["DRAFT", "NEEDS_REVIEW", "VERIFIED"]).default("DRAFT"),
  contentReviewNote: z.string().trim().max(4000).optional(),
  sources: z.array(productSourceSchema).max(30).default([]),
  priceKopecks: z.coerce.number().int().min(0, "Цена не может быть отрицательной"),
  oldPriceKopecks: z.number().int().min(0).nullable().optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  weightGrams: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  outOfStock: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  badge: z.string().trim().max(100).optional().nullable(),
  variantLabel: z.string().trim().max(100).optional().nullable(),
  attributes: z.array(productAttributeSchema).max(100).default([]),
  images: z.array(productImageSchema).max(30).default([]),
  variants: z.array(productVariantSchema).max(100).default([]),
}).superRefine((product, ctx) => {
  if (!product.isActive && product.contentStatus === "NEEDS_REVIEW" && !product.contentReviewNote?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["contentReviewNote"],
      message: "Укажите, что именно требуется проверить",
    });
  }

  if (product.isActive) {
    for (const issue of getListingContentIssues(product)) {
      ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
    }
    return;
  }

  // Даже снятую с публикации карточку нельзя пометить проверенной без контента.
  if (product.contentStatus === "VERIFIED") {
    const issues = getListingContentIssues({ ...product, contentStatus: "VERIFIED", priceKopecks: Math.max(1, product.priceKopecks), images: [{}] });
    for (const issue of issues) {
      ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
    }
  }
});

export type ProductInput = z.infer<typeof productSchema>;
