import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentPoller } from "@/components/storefront/payment-poller";
import { getTbankState, mapTbankStatus } from "@/lib/tbank";
import { formatRub } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/constants";

export const metadata: Metadata = { title: "Заказ оформлен" };

// Всегда свежие данные (статус оплаты меняется), без кеша
export const revalidate = 0;

type Params = Promise<{ orderNumber: string }>;

export default async function OrderSuccessPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  const num = Number(orderNumber);
  if (!Number.isInteger(num)) notFound();

  const order = await prisma.order.findUnique({
    where: { orderNumber: num },
    include: { items: true, deliveryMethod: true },
  });
  if (!order) notFound();

  // Подстраховка: перепроверяем статус напрямую у Т-Банка (на случай, если вебхук не дошёл)
  if (
    order.tbankPaymentId &&
    order.paymentStatus !== "SUCCEEDED" &&
    order.paymentStatus !== "CANCELLED"
  ) {
    try {
      const status = await getTbankState(order.tbankPaymentId);
      if (status) {
        const mapped = mapTbankStatus(status);
        if (mapped.paymentStatus !== order.paymentStatus) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: mapped.paymentStatus,
              ...(mapped.orderStatus ? { status: mapped.orderStatus } : {}),
            },
          });
          order.paymentStatus = mapped.paymentStatus;
          if (mapped.orderStatus) order.status = mapped.orderStatus;
        }
      }
    } catch {
      // не критично — статус подтянется вебхуком или при следующем обновлении
    }
  }

  const paid = order.paymentStatus === "SUCCEEDED";
  const pollable =
    Boolean(order.yookassaPaymentId || order.tbankPaymentId) &&
    order.paymentStatus !== "SUCCEEDED" &&
    order.paymentStatus !== "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <PaymentPoller pollable={pollable} />
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-success/10">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Заказ №{order.orderNumber} оформлен
        </h1>
        <p className="mt-2 text-muted-foreground">
          {paid
            ? "Оплата получена. Мы свяжемся с вами для уточнения деталей."
            : "Мы приняли ваш заказ и свяжемся с вами для подтверждения и оплаты."}
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Статус</span>
          <div className="flex gap-2">
            <Badge variant="muted">{ORDER_STATUS_LABELS[order.status as OrderStatus]}</Badge>
            <Badge variant={paid ? "success" : "default"}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus]}
            </Badge>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-border pt-5">
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

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="surface">
          <Link href="/catalog">Продолжить покупки</Link>
        </Button>
        <Button asChild>
          <Link href="/account/orders">Мои заказы</Link>
        </Button>
      </div>
    </div>
  );
}
