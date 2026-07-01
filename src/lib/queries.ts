import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ProductCardData } from "@/lib/types";

const productCardInclude = {
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
  category: true,
  variants: true,
} satisfies Prisma.ProductInclude;

type ProductWithCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export function toCardData(p: ProductWithCard): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    priceKopecks: p.priceKopecks,
    oldPriceKopecks: p.oldPriceKopecks,
    badge: p.badge,
    image: p.images[0]?.url ?? null,
    categoryName: p.category?.name,
    inStock: p.stockQty > 0 || p.variants.some((v) => v.stockQty > 0),
    hasVariants: p.variants.length > 0,
  };
}

export async function getVisibleCategories() {
  return prisma.category.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getFeaturedProducts(limit = 8) {
  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    include: productCardInclude,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return products.map(toCardData);
}

export async function getNewProducts(limit = 8) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: productCardInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(toCardData);
}

export type CatalogFilters = {
  categorySlug?: string;
  sort?: "new" | "price-asc" | "price-desc";
  inStockOnly?: boolean;
};

export async function getCatalogProducts(filters: CatalogFilters = {}) {
  const where: Prisma.ProductWhereInput = { isActive: true };
  if (filters.categorySlug) {
    where.category = { slug: filters.categorySlug };
  }
  if (filters.inStockOnly) {
    where.stockQty = { gt: 0 };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    filters.sort === "price-asc"
      ? { priceKopecks: "asc" }
      : filters.sort === "price-desc"
        ? { priceKopecks: "desc" }
        : { createdAt: "desc" };

  const products = await prisma.product.findMany({
    where,
    include: productCardInclude,
    orderBy,
  });
  return products.map(toCardData);
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });
}

export async function getActiveDeliveryMethods() {
  return prisma.deliveryMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSiteContent(key: string) {
  return prisma.siteContent.findUnique({ where: { key } });
}
