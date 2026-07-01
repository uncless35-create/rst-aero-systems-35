"use client";

import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useHydrated } from "@/lib/use-hydrated";
import type { FavoriteItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  item,
  className,
}: {
  item: FavoriteItem;
  className?: string;
}) {
  const hydrated = useHydrated();
  const toggle = useFavoritesStore((s) => s.toggle);
  const items = useFavoritesStore((s) => s.items);
  const active = hydrated && items.some((i) => i.id === item.id);

  return (
    <button
      type="button"
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
        toast(active ? "Убрано из избранного" : "Добавлено в избранное");
      }}
      className={cn(
        "grid place-items-center rounded-full bg-background/80 backdrop-blur transition-colors hover:bg-background",
        "size-9 shadow-sm",
        className
      )}
    >
      <motion.span whileTap={{ scale: 0.8 }} className="grid place-items-center">
        <Heart
          className={cn(
            "size-[18px] transition-colors",
            active ? "fill-destructive stroke-destructive" : "stroke-foreground"
          )}
        />
      </motion.span>
    </button>
  );
}
