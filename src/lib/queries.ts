import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ProductCardData } from "@/lib/types";

/**
 * Чтения каталога кешируются (Next Data Cache) и помечаются тегами.
 * Админские мутации вызывают revalidateTag(...) — данные обновляются сразу.
 * Теги: "categories", "products", "delivery", "content".
 */

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

export const getVisibleCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: "asc" },
    }),
  ["visible-categories"],
  { tags: ["categories"], revalidate: 300 }
);

const _getFeatured = unstable_cache(
  async (limit: number) => {
    const products = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: productCardInclude,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return products.map(toCardData);
  },
  ["featured-products"],
  { tags: ["products"], revalidate: 300 }
);
export function getFeaturedProducts(limit = 8) {
  return _getFeatured(limit);
}

const _getNew = unstable_cache(
  async (limit: number) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: productCardInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return products.map(toCardData);
  },
  ["new-products"],
  { tags: ["products"], revalidate: 300 }
);
export function getNewProducts(limit = 8) {
  return _getNew(limit);
}

export type CatalogFilters = {
  categorySlug?: string;
  sort?: "new" | "price-asc" | "price-desc";
  inStockOnly?: boolean;
};

const _getCatalog = unstable_cache(
  async (filters: CatalogFilters) => {
    const where: Prisma.ProductWhereInput = { isActive: true };
    if (filters.categorySlug) where.category = { slug: filters.categorySlug };
    if (filters.inStockOnly) where.stockQty = { gt: 0 };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      filters.sort === "price-asc"
        ? { priceKopecks: "asc" }
        : filters.sort === "price-desc"
          ? { priceKopecks: "desc" }
          : { createdAt: "desc" };

    const products = await prisma.product.findMany({ where, include: productCardInclude, orderBy });
    return products.map(toCardData);
  },
  ["catalog-products"],
  { tags: ["products"], revalidate: 120 }
);
export function getCatalogProducts(filters: CatalogFilters = {}) {
  return _getCatalog(filters);
}

const _getProductBySlug = unstable_cache(
  async (slug: string) =>
    prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        category: true,
      },
    }),
  ["product-by-slug"],
  { tags: ["products"], revalidate: 120 }
);
export function getProductBySlug(slug: string) {
  return _getProductBySlug(slug);
}

export const getActiveDeliveryMethods = unstable_cache(
  async () =>
    prisma.deliveryMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ["active-delivery-methods"],
  { tags: ["delivery"], revalidate: 300 }
);

const _getSiteContent = unstable_cache(
  async (key: string) => prisma.siteContent.findUnique({ where: { key } }),
  ["site-content"],
  { tags: ["content"], revalidate: 300 }
);
export function getSiteContent(key: string) {
  return _getSiteContent(key);
}
