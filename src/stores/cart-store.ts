"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

type AddInput = Omit<CartItem, "key" | "quantity"> & { quantity?: number };

type CartState = {
  items: CartItem[];
  add: (item: AddInput) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  totalItems: () => number;
  totalKopecks: () => number;
};

const keyOf = (productId: string, variantId: string | null) =>
  variantId ? `${productId}:${variantId}` : productId;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (input) => {
        const key = keyOf(input.productId, input.variantId);
        const qty = input.quantity ?? 1;
        set((state) => {
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            const nextQty = Math.min(existing.quantity + qty, existing.maxStock);
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: nextQty } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...input, key, quantity: Math.min(qty, input.maxStock) },
            ],
          };
        });
      },

      remove: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.key === key
                ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxStock)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),

      clear: () => set({ items: [] }),

      totalItems: () => get().items.reduce((s, i) => s + i.quantity, 0),

      totalKopecks: () =>
        get().items.reduce((s, i) => s + i.priceKopecks * i.quantity, 0),
    }),
    { name: "rst-cart" }
  )
);
