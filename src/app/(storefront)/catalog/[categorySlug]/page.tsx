import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryPills } from "@/components/storefront/category-pills";
import { CatalogToolbar } from "@/components/storefront/catalog-toolbar";
import { ProductGrid } from "@/components/storefront/product-grid";
import { EmptyState } from "@/components/storefront/empty-state";
import { getVisibleCategories, getCatalogProducts, type CatalogFilters } from "@/lib/queries";

type Params = Promise<{ categorySlug: string }>;
type SearchParams = Promise<{ sort?: string; inStock?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  return { title: category?.name ?? "Каталог" };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { categorySlug } = await params;
  const sp = await searchParams;

  const category = await prisma.category.findFirst({
    where: { slug: categorySlug, isVisible: true },
  });
  if (!category) notFound();

  const filters: CatalogFilters = {
    categorySlug,
    sort: (sp.sort as CatalogFilters["sort"]) ?? "new",
    inStockOnly: sp.inStock === "1",
  };

  const [categories, products] = await Promise.all([
    getVisibleCategories(),
    getCatalogProducts(filters),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
      {category.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
      ) : null}

      <div className="mt-5 space-y-4">
        <CategoryPills categories={categories} />
        <CatalogToolbar />
      </div>

      <div className="mt-8">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState title="В этой категории пока пусто" description="Скоро здесь появятся товары." />
        )}
      </div>
    </div>
  );
}
