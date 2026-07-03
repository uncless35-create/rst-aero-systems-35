import { Skeleton } from "@/components/ui/skeleton";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-3xl" />
          <div className="space-y-2 px-1">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <Skeleton className="aspect-square w-full rounded-[2rem]" />
      <div className="space-y-5">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-10 w-40" />
        <div className="space-y-2 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
    </div>
  );
}
