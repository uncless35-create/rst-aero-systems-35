"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "new", label: "Новые" },
  { value: "price-asc", label: "Дешевле" },
  { value: "price-desc", label: "Дороже" },
];

export function CatalogToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const currentSort = params.get("sort") ?? "new";
  const inStock = params.get("inStock") === "1";

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-full bg-surface p-1">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => update("sort", s.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              currentSort === s.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => update("inStock", inStock ? null : "1")}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
          inStock
            ? "bg-primary text-primary-foreground"
            : "bg-surface text-muted-foreground hover:text-foreground"
        )}
      >
        В наличии
      </button>
    </div>
  );
}
