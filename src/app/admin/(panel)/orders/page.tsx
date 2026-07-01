import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/storefront/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/money";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Заказы" };

type SearchParams = Promise<{ status?: string }>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const { status } = await searchParams;
  const activeStatus = ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined;

  const where: Prisma.OrderWhereInput = activeStatus ? { status: activeStatus } : {};
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { items: true, deliveryMethod: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Заказы" description={`Всего: ${orders.length}`} />

      {/* Фильтр по статусу */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <Link
          href="/admin/orders"
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
            !activeStatus ? "bg-primary text-primary-foreground" : "bg-background hover:bg-surface"
          )}
        >
          Все
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeStatus === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-surface"
            )}
          >
            {ORDER_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="rounded-3xl bg-background p-8 text-center text-sm text-muted-foreground">Заказов нет</p>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-background">
          <div className="divide-y divide-border">
            {orders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">№{o.orderNumber}</p>
                    <StatusBadge status={o.status} />
                    <Badge variant={o.paymentStatus === "SUCCEEDED" ? "success" : "muted"}>
                      {PAYMENT_STATUS_LABELS[o.paymentStatus as PaymentStatus]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {o.customerName} · {o.customerPhone} · {new Date(o.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-semibold">{formatRub(o.totalKopecks)}</p>
                  <p className="text-xs text-muted-foreground">{o.items.length} тов.</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
