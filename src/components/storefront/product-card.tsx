"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, ShoppingBag, Eye, Check } from "lucide-react";
import { toast } from "sonner";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { QuickView } from "@/components/storefront/quick-view";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/lib/types";

export function ProductCard({ product, index = 0 }: { product: ProductCardData; index?: number }) {
  const add = useCartStore((s) => s.add);
  const [quickOpen, setQuickOpen] = useState(false);
  const [added, setAdded] = useState(false);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Для товаров с вариантами нужен выбор — открываем быстрый просмотр
    if (product.hasVariants) {
      setQuickOpen(true);
      return;
    }
    add({
      productId: product.id,
      variantId: null,
      slug: product.slug,
      name: product.name,
      variantName: null,
      image: product.image,
      priceKopecks: product.priceKopecks,
      maxStock: product.stockQty,
      weightGrams: product.weightGrams,
      quantity: 1,
    });
    setAdded(true);
    toast.success("Добавлено в корзину");
    setTimeout(() => setAdded(false), 1500);
  }

  const buyLabel = added
    ? "В корзине"
    : product.outOfStock
      ? "Временно нет"
      : !product.inStock
        ? "Нет в наличии"
        : product.hasVariants
          ? "Выбрать вариант"
          : "В корзину";

  return (
    <div
      className="group animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 0.03, 0.2)}s` }}
    >
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-surface">
        <Link href={`/product/${product.slug}`} className="block h-full w-full">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <ImageOff className="size-8" />
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          {product.badge ? <Badge variant="dark">{product.badge}</Badge> : null}
          {product.outOfStock ? (
            <Badge variant="muted">Временно нет в наличии</Badge>
          ) : !product.inStock ? (
            <Badge variant="muted">Нет в наличии</Badge>
          ) : null}
        </div>

        <div className="absolute right-3 top-3">
          <FavoriteButton
            item={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              priceKopecks: product.priceKopecks,
              oldPriceKopecks: product.oldPriceKopecks,
              badge: product.badge,
              image: product.image,
              inStock: product.inStock,
              hasVariants: product.hasVariants,
            }}
          />
        </div>

        {/* Быстрый просмотр */}
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Eye className="size-3.5" /> Быстрый просмотр
        </button>
      </div>

      <Link href={`/product/${product.slug}`} className="mt-3 block space-y-1 px-1">
        {product.categoryName ? (
          <p className="text-xs text-muted-foreground">{product.categoryName}</p>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</h3>
        <Price kopecks={product.priceKopecks} oldKopecks={product.oldPriceKopecks} size="sm" />
      </Link>

      <div className="mt-2 px-1">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!product.inStock}
          className={cn(buttonVariants({ size: "sm" }), "w-full gap-1.5")}
        >
          {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
          {buyLabel}
        </button>
      </div>

      <QuickView slug={product.slug} open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
