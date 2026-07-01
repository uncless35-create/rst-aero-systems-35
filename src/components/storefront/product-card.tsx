"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ImageOff } from "lucide-react";
import { Price } from "@/components/storefront/price";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import type { ProductCardData } from "@/lib/types";

export function ProductCard({ product, index = 0 }: { product: ProductCardData; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="group"
    >
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-surface">
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

          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {product.badge ? <Badge variant="dark">{product.badge}</Badge> : null}
            {!product.inStock ? <Badge variant="muted">Нет в наличии</Badge> : null}
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
        </div>

        <div className="mt-3 space-y-1 px-1">
          {product.categoryName ? (
            <p className="text-xs text-muted-foreground">{product.categoryName}</p>
          ) : null}
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</h3>
          <Price kopecks={product.priceKopecks} oldKopecks={product.oldPriceKopecks} size="sm" />
        </div>
      </Link>
    </motion.div>
  );
}
