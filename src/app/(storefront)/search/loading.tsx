import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-4 h-11 w-full max-w-xl rounded-full" />
      <div className="mt-8">
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}
