import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/money";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/constants";

export const metadata = { title: "Заказ" };

type Params = Promise<{ id: string }>;

export default async function AdminOrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, deliveryMethod: true, user: true },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> К заказам
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Заказ №{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleString("ru-RU")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={order.paymentStatus === "SUCCEEDED" ? "success" : "muted"}>
            Оплата: {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]}
          </Badge>
          <OrderStatusSelect orderId={order.id} status={order.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Покупатель */}
        <div className="rounded-3xl bg-background p-5 text-sm">
          <p className="mb-2 font-semibold">Покупатель</p>
          <div className="space-y-1 text-muted-foreground">
            <p>{order.customerName}</p>
            <p>{order.customerPhone}</p>
            {order.customerEmail && <p>{order.customerEmail}</p>}
            {order.user && <p className="text-xs">Аккаунт: {order.user.email}</p>}
          </div>
        </div>

        {/* Доставка */}
        <div className="rounded-3xl bg-background p-5 text-sm">
          <p className="mb-2 font-semibold">Доставка</p>
          <div className="space-y-1 text-muted-foreground">
            <p>{order.deliveryMethod.name}</p>
            {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
            {order.comment && <p className="italic">«{order.comment}»</p>}
          </div>
        </div>
      </div>

      {/* Позиции */}
      <div className="mt-4 rounded-3xl bg-background p-5">
        <p className="mb-3 font-semibold">Состав заказа</p>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="line-clamp-1">{item.productName}</span>
                <span className="text-muted-foreground">
                  {item.variantName ? `${item.variantName} · ` : ""}{formatRub(item.priceKopecks)} × {item.quantity}
                </span>
              </span>
              <span className="shrink-0 font-medium">{formatRub(item.priceKopecks * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Товары</span>
            <span>{formatRub(order.itemsTotalKopecks)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Доставка</span>
            <span>{order.deliveryPriceKopecks === 0 ? "Бесплатно" : formatRub(order.deliveryPriceKopecks)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Итого</span>
            <span>{formatRub(order.totalKopecks)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
