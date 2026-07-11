import Link from "next/link";
import { User, Search } from "lucide-react";
import { HeaderActionIcons } from "@/components/storefront/cart-badge-icons";
import { SearchBar } from "@/components/storefront/search-bar";
import { SITE } from "@/lib/constants";

const NAV = [
  { href: "/catalog", label: "Каталог" },
  { href: "/about", label: "О компании" },
  { href: "/delivery-payment", label: "Доставка и оплата" },
  { href: "/contacts", label: "Контакты" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight">RST AERO</span>
          <span className="text-[10px] font-medium tracking-[0.25em] text-muted-foreground">
            SYSTEMS
          </span>
        </Link>

        {/* Поиск — инлайн на десктопе */}
        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar className="max-w-md" />
        </div>

        {/* Навигация — на больших экранах */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/search"
            aria-label="Поиск"
            className="grid size-11 place-items-center rounded-full hover:bg-surface md:hidden"
          >
            <Search className="size-5" />
          </Link>
          <HeaderActionIcons />
          <Link
            href="/account"
            aria-label="Личный кабинет"
            className="hidden size-11 place-items-center rounded-full hover:bg-surface md:grid"
          >
            <User className="size-5" />
          </Link>
        </div>
      </div>
      <span className="sr-only">{SITE.name}</span>
    </header>
  );
}
