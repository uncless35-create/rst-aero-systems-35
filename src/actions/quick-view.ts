"use server";

import { prisma } from "@/lib/prisma";
import { parseAttributes } from "@/lib/constants";

export type QuickViewData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceKopecks: number;
  oldPriceKopecks: number | null;
  stockQty: number;
  outOfStock: boolean;
  variantLabel: string | null;
  weightGrams: number | null;
  images: { url: string; alt: string | null }[];
  attributes: { name: string; value: string }[];
  variants: { id: string; name: string; priceKopecks: number; stockQty: number }[];
};

/** Данные товара для модалки быстрого просмотра. */
export async function getQuickView(slug: string): Promise<QuickViewData | null> {
  const p = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceKopecks: p.priceKopecks,
    oldPriceKopecks: p.oldPriceKopecks,
    stockQty: p.stockQty,
    outOfStock: p.outOfStock,
    variantLabel: p.variantLabel,
    weightGrams: p.weightGrams,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    attributes: parseAttributes(p.attributes),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceKopecks: v.priceKopecks ?? p.priceKopecks,
      stockQty: v.stockQty,
    })),
  };
}
