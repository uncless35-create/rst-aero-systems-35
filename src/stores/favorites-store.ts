"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FavoriteItem } from "@/lib/types";

type FavoritesState = {
  items: FavoriteItem[];
  toggle: (item: FavoriteItem) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  count: () => number;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (item) =>
        set((state) => {
          const exists = state.items.some((i) => i.id === item.id);
          return {
            items: exists
              ? state.items.filter((i) => i.id !== item.id)
              : [item, ...state.items],
          };
        }),

      remove: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      has: (id) => get().items.some((i) => i.id === id),

      count: () => get().items.length,
    }),
    { name: "rst-favorites" }
  )
);
