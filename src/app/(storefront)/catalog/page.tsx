import type { Metadata } from "next";
import { CategoryPills } from "@/components/storefront/category-pills";
import { CatalogToolbar } from "@/components/storefront/catalog-toolbar";
import { ProductGrid } from "@/components/storefront/product-grid";
import { EmptyState } from "@/components/storefront/empty-state";
import { getVisibleCategories, getCatalogProducts, type CatalogFilters } from "@/lib/queries";

export const metadata: Metadata = { title: "Каталог" };

type SearchParams = Promise<{ sort?: string; inStock?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters: CatalogFilters = {
    sort: (sp.sort as CatalogFilters["sort"]) ?? "new",
    inStockOnly: sp.inStock === "1",
  };

  const [categories, products] = await Promise.all([
    getVisibleCategories(),
    getCatalogProducts(filters),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Каталог</h1>

      <div className="mt-5 space-y-4">
        <CategoryPills categories={categories} />
        <CatalogToolbar />
      </div>

      <div className="mt-8">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState title="Ничего не найдено" description="Попробуйте изменить фильтры." />
        )}
      </div>
    </div>
  );
}
