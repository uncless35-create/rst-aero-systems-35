import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/storefront/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/money";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/constants";

type Params = Promise<{ orderNumber: string }>;

export const metadata: Metadata = { title: "Заказ" };

export default async function AccountOrderDetailPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  const num = Number(orderNumber);
  if (!Number.isInteger(num)) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const order = await prisma.order.findUnique({
    where: { orderNumber: num },
    include: { items: true, deliveryMethod: true },
  });
  if (!order || order.userId !== session.user.id) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> К заказам
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Заказ №{order.orderNumber}</h1>
        <div className="flex gap-2">
          <StatusBadge status={order.status} />
          <Badge variant={order.paymentStatus === "SUCCEEDED" ? "success" : "muted"}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]}
          </Badge>
        </div>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {new Date(order.createdAt).toLocaleString("ru-RU")}
      </p>

      <div className="mt-6 rounded-3xl border border-border p-5">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="line-clamp-1">{item.productName}</span>
                <span className="text-muted-foreground">
                  {item.variantName ? `${item.variantName} · ` : ""}{item.quantity} шт
                </span>
              </span>
              <span className="shrink-0 font-medium">{formatRub(item.priceKopecks * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Товары</span>
            <span>{formatRub(order.itemsTotalKopecks)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Доставка · {order.deliveryMethod.name}</span>
            <span>{order.deliveryPriceKopecks === 0 ? "Бесплатно" : formatRub(order.deliveryPriceKopecks)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Итого</span>
            <span>{formatRub(order.totalKopecks)}</span>
          </div>
        </div>
      </div>

      {order.cdekTrackNumber && (
        <div className="mt-4 rounded-3xl border border-border p-5 text-sm">
          <p className="font-medium">Отслеживание СДЭК</p>
          <p className="mt-2 text-muted-foreground">
            Номер накладной:{" "}
            <span className="font-semibold text-foreground">{order.cdekTrackNumber}</span>
          </p>
          <a
            href={`https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(order.cdekTrackNumber)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
          >
            Отследить посылку →
          </a>
        </div>
      )}

      <div className="mt-4 rounded-3xl bg-surface p-5 text-sm">
        <p className="font-medium">Данные получателя</p>
        <div className="mt-2 space-y-1 text-muted-foreground">
          <p>{order.customerName}</p>
          <p>{order.customerPhone}</p>
          {order.customerEmail && <p>{order.customerEmail}</p>}
          {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
          {order.comment && <p className="italic">«{order.comment}»</p>}
        </div>
      </div>
    </div>
  );
}
