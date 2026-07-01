"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag, ImageOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { formatRub } from "@/lib/money";

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const total = items.reduce((s, i) => s + i.priceKopecks * i.quantity, 0);

  if (!hydrated) return <div className="mx-auto max-w-3xl px-4 pt-6" />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <h1 className="text-2xl font-bold tracking-tight">Корзина</h1>
        <div className="mt-8">
          <EmptyState
            icon={ShoppingBag}
            title="Корзина пуста"
            description="Добавьте товары из каталога, чтобы оформить заказ."
          >
            <Button asChild>
              <Link href="/catalog">В каталог</Link>
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">Корзина</h1>

      <div className="mt-6 space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="flex gap-4 rounded-3xl bg-surface p-3"
            >
              <Link
                href={`/product/${item.slug}`}
                className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-background"
              >
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill sizes="96px" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <ImageOff className="size-6" />
                  </div>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">
                      {item.name}
                    </Link>
                    {item.variantName ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.variantName}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => remove(item.key)}
                    aria-label="Удалить"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-full bg-background">
                    <button
                      onClick={() => setQuantity(item.key, item.quantity - 1)}
                      aria-label="Меньше"
                      className="grid size-9 place-items-center rounded-full transition-colors hover:bg-surface-2"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => setQuantity(item.key, item.quantity + 1)}
                      disabled={item.quantity >= item.maxStock}
                      aria-label="Больше"
                      className="grid size-9 place-items-center rounded-full transition-colors hover:bg-surface-2 disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatRub(item.priceKopecks * item.quantity)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Итог */}
      <div className="mt-6 rounded-3xl border border-border p-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Итого</span>
          <span className="text-2xl font-bold tracking-tight">{formatRub(total)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Стоимость доставки рассчитывается при оформлении.
        </p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link href="/checkout">Оформить заказ</Link>
        </Button>
      </div>
    </div>
  );
}
