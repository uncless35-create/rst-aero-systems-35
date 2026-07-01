import { ProductCard } from "@/components/storefront/product-card";
import type { ProductCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductGrid({
  products,
  className,
}: {
  products: ProductCardData[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  );
}
