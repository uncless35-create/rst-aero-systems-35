import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isYookassaConfigured, getPayment, mapPaymentStatus } from "@/lib/yookassa";

/**
 * Вебхук ЮKassa. Безопасность: НЕ доверяем телу запроса — перепроверяем платёж
 * запросом к API по id. Всегда возвращаем 200 на обработанные случаи, чтобы
 * ЮKassa не слала повторы сутки. Обработчик идемпотентен.
 */
export async function POST(req: Request) {
  if (!isYookassaConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let paymentId: string | undefined;
  try {
    const body = await req.json();
    paymentId = body?.object?.id;
  } catch {
    return NextResponse.json({ ok: true }); // некорректное тело — не повторять
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  try {
    // Перепроверяем платёж на стороне ЮKassa
    const payment = await getPayment(paymentId);
    const orderId = payment.metadata?.orderId;

    const order = orderId
      ? await prisma.order.findUnique({ where: { id: orderId } })
      : await prisma.order.findUnique({ where: { yookassaPaymentId: paymentId } });

    if (!order) {
      // Неизвестный заказ — логируем, но не заставляем ЮKassa повторять
      console.warn("Вебхук ЮKassa: заказ не найден", { paymentId, orderId });
      return NextResponse.json({ ok: true });
    }

    const { paymentStatus, orderStatus } = mapPaymentStatus(payment.status);

    // Идемпотентность: обновляем только при изменении статуса
    if (order.paymentStatus !== paymentStatus) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus,
          yookassaPaymentId: paymentId,
          ...(orderStatus ? { status: orderStatus } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Транзиентная ошибка — вернём 500, чтобы ЮKassa повторила позже
    console.error("Ошибка обработки вебхука ЮKassa:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
