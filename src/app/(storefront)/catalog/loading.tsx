import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export default function CatalogLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <Skeleton className="h-8 w-40" />
      <div className="mt-5 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-8">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
