"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Строка поиска. В режиме live (на странице /search) обновляет результаты по мере ввода.
 * Иначе (в шапке) — переходит на /search по вводу/Enter.
 */
export function SearchBar({
  initialQuery = "",
  live = false,
  autoFocus = false,
  className,
}: {
  initialQuery?: string;
  live?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!live) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim();
      router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false });
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, live]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={submit} className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        inputMode="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск товаров…"
        className={cn(
          "h-11 w-full rounded-full border border-input bg-surface pl-11 pr-10 text-sm",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15 transition-colors"
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Очистить"
          onClick={() => setValue("")}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-2"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
