"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Price } from "@/components/storefront/price";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

export type PurchaseVariant = {
  id: string;
  name: string;
  priceKopecks: number;
  stockQty: number;
};

export type PurchaseProduct = {
  id: string;
  slug: string;
  name: string;
  priceKopecks: number;
  oldPriceKopecks: number | null;
  stockQty: number;
  outOfStock: boolean;
  variantLabel: string | null;
  image: string | null;
  weightGrams: number | null;
  variants: PurchaseVariant[];
};

export function ProductPurchasePanel({ product }: { product: PurchaseProduct }) {
  const router = useRouter();
  const add = useCartStore((s) => s.add);
  const hasVariants = product.variants.length > 0;

  const [variantId, setVariantId] = useState<string | null>(
    hasVariants ? (product.variants.find((v) => v.stockQty > 0)?.id ?? null) : null
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedVariant = product.variants.find((v) => v.id === variantId) ?? null;
  const effectivePrice = selectedVariant?.priceKopecks ?? product.priceKopecks;
  const maxStock = hasVariants ? (selectedVariant?.stockQty ?? 0) : product.stockQty;
  const inStock = maxStock > 0;
  const available = inStock && !product.outOfStock; // можно ли купить
  const needsVariant = hasVariants && !selectedVariant;

  function handleAdd() {
    if (product.outOfStock) {
      toast.error("Товара временно нет в наличии");
      return;
    }
    if (needsVariant) {
      toast.error(`Выберите: ${product.variantLabel ?? "вариант"}`);
      return;
    }
    add({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      slug: product.slug,
      name: product.name,
      variantName: selectedVariant?.name ?? null,
      image: product.image,
      priceKopecks: effectivePrice,
      maxStock,
      weightGrams: product.weightGrams,
      quantity: qty,
    });
    setAdded(true);
    toast.success("Добавлено в корзину");
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="space-y-6">
      <Price kopecks={effectivePrice} oldKopecks={product.oldPriceKopecks} size="lg" />

      {hasVariants && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{product.variantLabel ?? "Вариант"}</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const disabled = v.stockQty <= 0;
              const active = v.id === variantId;
              return (
                <button
                  key={v.id}
                  disabled={disabled}
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-surface",
                    disabled && "cursor-not-allowed line-through opacity-40"
                  )}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Количество + наличие */}
      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full bg-surface">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Меньше"
            className="grid size-11 place-items-center rounded-full transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(maxStock || 1, q + 1))}
            disabled={!available || qty >= maxStock}
            aria-label="Больше"
            className="grid size-11 place-items-center rounded-full transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <span className="text-sm text-muted-foreground">
          {product.outOfStock ? (
            <span className="text-amber-600">Временно нет в наличии</span>
          ) : !inStock ? (
            "Нет в наличии"
          ) : maxStock <= 3 ? (
            <span className="font-semibold text-red-600">Осталось мало</span>
          ) : (
            <span className="text-success">В наличии</span>
          )}
        </span>
      </div>

      <div className="flex gap-3">
        <motion.button
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleAdd}
          disabled={!available}
          className={cn(buttonVariants({ size: "lg" }), "flex-1")}
        >
          {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}
          {added
            ? "В корзине"
            : product.outOfStock
              ? "Временно нет"
              : inStock
                ? "В корзину"
                : "Нет в наличии"}
        </motion.button>
        <Button
          size="lg"
          variant="surface"
          onClick={() => {
            handleAdd();
            router.push("/cart");
          }}
          disabled={!available}
        >
          Купить
        </Button>
      </div>
    </div>
  );
}
