import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Package } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/storefront/status-badge";
import { EmptyState } from "@/components/storefront/empty-state";
import { Button } from "@/components/ui/button";
import { formatRub } from "@/lib/money";

export const metadata: Metadata = { title: "Мои заказы" };

export default async function AccountOrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account/orders");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">Мои заказы</h1>

      <div className="mt-6">
        {orders.length === 0 ? (
          <EmptyState icon={Package} title="Заказов пока нет" description="Оформите первый заказ в каталоге.">
            <Button asChild>
              <Link href="/catalog">В каталог</Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.orderNumber}`}
                className="flex items-center justify-between rounded-3xl border border-border p-5 transition-colors hover:bg-surface"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">Заказ №{order.orderNumber}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {order.items.length} тов. · {formatRub(order.totalKopecks)}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
