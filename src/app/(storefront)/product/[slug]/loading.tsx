import { Skeleton } from "@/components/ui/skeleton";
import { ProductDetailSkeleton } from "@/components/storefront/skeletons";

export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6">
        <ProductDetailSkeleton />
      </div>
    </div>
  );
}
