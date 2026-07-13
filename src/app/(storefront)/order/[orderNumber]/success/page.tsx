import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentPoller } from "@/components/storefront/payment-poller";
import { OrderGoal } from "@/components/analytics/order-goal";
import { getTbankState, mapTbankStatus } from "@/lib/tbank";
import { getPayment, mapPaymentStatus } from "@/lib/yookassa";
import { applyOrderPaymentState } from "@/lib/order-payment";
import { formatRub } from "@/lib/money";
import { auth } from "@/lib/auth";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Заказ оформлен",
  robots: { index: false, follow: false },
};

// Всегда свежие данные (статус оплаты меняется), без кеша
export const revalidate = 0;

type Params = Promise<{ orderNumber: string }>;

export default async function OrderSuccessPage({ params }: { params: Params }) {
  // Новые гостевые ссылки используют непредсказуемый accessToken. Исторические
  // ссылки с порядковым номером разрешены только вошедшему владельцу заказа.
  const { orderNumber: orderRef } = await params;
  if (!orderRef || orderRef.length > 128) notFound();
  const session = await auth();
  const legacyOrderNumber = /^\d+$/.test(orderRef) ? Number(orderRef) : null;

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { accessToken: orderRef },
        ...(legacyOrderNumber !== null && session?.user?.id
          ? [{ orderNumber: legacyOrderNumber, userId: session.user.id }]
          : []),
      ],
    },
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
          const applied = await applyOrderPaymentState({
            orderId: order.id,
            paymentStatus: mapped.paymentStatus,
            orderStatus: mapped.orderStatus,
          });
          if (applied) {
            order.paymentStatus = applied.paymentStatus;
            order.status = applied.orderStatus;
          }
        }
      }
    } catch {
      // не критично — статус подтянется вебхуком или при следующем обновлении
    }
  }

  // Та же подстраховка для ЮKassa: подтверждённый статус берём только из API.
  if (
    order.yookassaPaymentId &&
    order.paymentStatus !== "SUCCEEDED" &&
    order.paymentStatus !== "CANCELLED"
  ) {
    try {
      const payment = await getPayment(order.yookassaPaymentId);
      if (!payment.metadata?.orderId || payment.metadata.orderId === order.id) {
        const mapped = mapPaymentStatus(payment.status);
        if (mapped.paymentStatus !== order.paymentStatus) {
          const applied = await applyOrderPaymentState({
            orderId: order.id,
            yookassaPaymentId: payment.id,
            paymentStatus: mapped.paymentStatus,
            orderStatus: mapped.orderStatus,
          });
          if (applied) {
            order.paymentStatus = applied.paymentStatus;
            order.status = applied.orderStatus;
          }
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
      <OrderGoal orderNumber={order.orderNumber} />
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
