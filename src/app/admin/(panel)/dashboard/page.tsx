import Link from "next/link";
import { Package, ShoppingCart, AlertTriangle, Boxes } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/storefront/status-badge";
import { formatRub } from "@/lib/money";

export const metadata = { title: "Дашборд" };

export default async function AdminDashboard() {
  const [productsCount, categoriesCount, newOrders, lowStock, recentOrders] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count({ where: { status: "NEW" } }),
      prisma.product.findMany({
        where: { isActive: true, stockQty: { lte: 3 } },
        orderBy: { stockQty: "asc" },
        take: 5,
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { items: true },
      }),
    ]);

  const stats = [
    { label: "Товары", value: productsCount, icon: Package, href: "/admin/products" },
    { label: "Категории", value: categoriesCount, icon: Boxes, href: "/admin/categories" },
    { label: "Новые заказы", value: newOrders, icon: ShoppingCart, href: "/admin/orders" },
    { label: "Заканчиваются", value: lowStock.length, icon: AlertTriangle, href: "/admin/products" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-3xl bg-background p-5 transition-colors hover:bg-background/70"
            >
              <Icon className="size-5 text-muted-foreground" />
              <p className="mt-3 text-3xl font-bold tracking-tight">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Последние заказы */}
        <div className="rounded-3xl bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Последние заказы</h2>
            <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
              Все
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Заказов пока нет</p>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface"
                >
                  <div>
                    <p className="text-sm font-medium">№{o.orderNumber} · {o.customerName}</p>
                    <p className="text-xs text-muted-foreground">{o.items.length} тов. · {formatRub(o.totalKopecks)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Заканчивающиеся товары */}
        <div className="rounded-3xl bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Заканчиваются</h2>
            <Link href="/admin/products" className="text-sm text-muted-foreground hover:text-foreground">
              Товары
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Всё в достатке</p>
          ) : (
            <div className="space-y-1">
              {lowStock.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}/edit`}
                  className="flex items-center justify-between rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface"
                >
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <span className="shrink-0 text-sm font-semibold text-destructive">{p.stockQty} шт</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
