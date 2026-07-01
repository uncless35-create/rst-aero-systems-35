"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User } from "lucide-react";
import { useFavoritesStore } from "@/stores/favorites-store";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/catalog", label: "Каталог", icon: Search },
  { href: "/favorites", label: "Избранное", icon: Heart },
  { href: "/account", label: "Профиль", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const favCount = useFavoritesStore((s) => s.items.length);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active =
            t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5", active && "fill-foreground/5")} />
                {t.href === "/favorites" && hydrated && favCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                    {favCount}
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
