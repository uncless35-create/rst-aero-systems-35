"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Truck,
  ShoppingCart,
  MessagesSquare,
  FileText,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/products", label: "Товары", icon: Package },
  { href: "/admin/categories", label: "Категории", icon: FolderTree },
  { href: "/admin/delivery-methods", label: "Доставка", icon: Truck },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/admin/chats", label: "Чаты", icon: MessagesSquare },
  { href: "/admin/pages", label: "Страницы", icon: FileText },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-row gap-1 overflow-x-auto border-b border-border bg-background p-2 md:h-dvh md:w-60 md:flex-col md:gap-1 md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
      <div className="hidden px-2 py-3 md:block">
        <p className="text-base font-bold tracking-tight">RST AERO</p>
        <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground">
          АДМИН-ПАНЕЛЬ
        </p>
      </div>

      <nav className="flex flex-1 flex-row gap-1 md:flex-col">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
            >
              <Icon className="size-[18px]" />
              <span className="hidden md:inline">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden gap-1 md:mt-auto md:flex md:flex-col">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <ExternalLink className="size-[18px] shrink-0" />
          На сайт
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <LogOut className="size-[18px] shrink-0" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
