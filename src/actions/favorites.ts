"use server";

import { prisma } from "@/lib/prisma";
import { toCardData } from "@/lib/queries";
import type { ProductCardData } from "@/lib/types";

const MAX_FAVORITES = 100;

/** Возвращает только актуальные активные товары, сохраняя порядок избранного. */
export async function getFavoriteProducts(ids: string[]): Promise<ProductCardData[]> {
  const safeIds = [...new Set(ids)]
    .filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
    .slice(0, MAX_FAVORITES);

  if (safeIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: safeIds }, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      category: true,
      variants: true,
    },
  });
  const byId = new Map(products.map((product) => [product.id, toCardData(product)]));

  return safeIds.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}
