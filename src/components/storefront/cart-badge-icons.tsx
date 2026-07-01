"use client";

import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { useCartStore } from "@/stores/cart-store";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useHydrated } from "@/lib/use-hydrated";

function Counter({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <motion.span
      key={value}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-foreground"
    >
      {value}
    </motion.span>
  );
}

/** Иконки избранного и корзины со счётчиками — для десктопной шапки. */
export function HeaderActionIcons() {
  const hydrated = useHydrated();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const favCount = useFavoritesStore((s) => s.items.length);

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/favorites"
        aria-label="Избранное"
        className="relative grid size-11 place-items-center rounded-full hover:bg-surface"
      >
        <Heart className="size-5" />
        {hydrated && <Counter value={favCount} />}
      </Link>
      <Link
        href="/cart"
        aria-label="Корзина"
        className="relative grid size-11 place-items-center rounded-full hover:bg-surface"
      >
        <ShoppingBag className="size-5" />
        {hydrated && <Counter value={cartCount} />}
      </Link>
    </div>
  );
}
