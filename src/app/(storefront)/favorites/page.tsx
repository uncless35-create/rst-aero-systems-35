"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductGrid } from "@/components/storefront/product-grid";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useHydrated } from "@/lib/use-hydrated";
import type { ProductCardData } from "@/lib/types";

export default function FavoritesPage() {
  const hydrated = useHydrated();
  const items = useFavoritesStore((s) => s.items);

  const products: ProductCardData[] = items.map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    priceKopecks: f.priceKopecks,
    oldPriceKopecks: f.oldPriceKopecks,
    badge: f.badge,
    image: f.image,
    inStock: f.inStock,
    hasVariants: f.hasVariants,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Избранное</h1>

      <div className="mt-8">
        {!hydrated ? null : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState
            icon={Heart}
            title="В избранном пока пусто"
            description="Нажимайте на сердечко на карточках товаров, чтобы сохранить их здесь."
          >
            <Button asChild>
              <Link href="/catalog">Перейти в каталог</Link>
            </Button>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
