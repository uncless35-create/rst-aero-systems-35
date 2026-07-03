import type { Metadata } from "next";
import { Search } from "lucide-react";
import { SearchBar } from "@/components/storefront/search-bar";
import { ProductGrid } from "@/components/storefront/product-grid";
import { EmptyState } from "@/components/storefront/empty-state";
import { searchProducts } from "@/lib/queries";

export const metadata: Metadata = { title: "Поиск" };

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const products = query.length >= 2 ? await searchProducts(query) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Поиск</h1>

      <div className="mt-4 max-w-xl">
        <SearchBar initialQuery={query} live autoFocus />
      </div>

      <div className="mt-8">
        {query.length < 2 ? (
          <EmptyState
            icon={Search}
            title="Введите запрос"
            description="Начните вводить название товара — например «дрон», «аккумулятор», «Radiomaster»."
          />
        ) : products.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Найдено: {products.length} по запросу «{query}»
            </p>
            <ProductGrid products={products} />
          </>
        ) : (
          <EmptyState
            icon={Search}
            title="Ничего не найдено"
            description={`По запросу «${query}» товаров нет. Попробуйте другое название.`}
          />
        )}
      </div>
    </div>
  );
}
