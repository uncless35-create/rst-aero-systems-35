"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Cat = { id: string; name: string; slug: string };

export function CategoryPills({
  categories,
  showAll = true,
}: {
  categories: Cat[];
  showAll?: boolean;
}) {
  const pathname = usePathname();

  const pill = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface text-foreground hover:bg-surface-2"
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {showAll && pill("/catalog", "Все", pathname === "/catalog")}
      {categories.map((c) =>
        pill(`/catalog/${c.slug}`, c.name, pathname === `/catalog/${c.slug}`)
      )}
    </div>
  );
}
