"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { getFavoriteProducts } from "@/actions/favorites";
import { ProductGrid } from "@/components/storefront/product-grid";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useHydrated } from "@/lib/use-hydrated";
import type { ProductCardData } from "@/lib/types";

export default function FavoritesPage() {
  const hydrated = useHydrated();
  const items = useFavoritesStore((s) => s.items);
  const favoriteIds = useMemo(() => items.map((item) => item.id), [items]);
  const favoriteIdsKey = favoriteIds.join(",");
  const [products, setProducts] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    getFavoriteProducts(favoriteIdsKey ? favoriteIdsKey.split(",") : [])
      .then((currentProducts) => {
        if (!cancelled) setProducts(currentProducts);
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          toast.error("Не удалось обновить избранное");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [favoriteIdsKey, hydrated]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Избранное</h1>

      <div className="mt-8">
        {!hydrated || (items.length > 0 && products === null) ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Обновляем цены и наличие…
          </div>
        ) : products && products.length > 0 ? (
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
