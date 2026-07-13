import { prisma } from "@/lib/prisma";
import {
  isTbankConfigured,
  verifyTbankNotification,
  getTbankState,
  mapTbankStatus,
} from "@/lib/tbank";
import { revalidateTag } from "next/cache";
import { applyOrderPaymentState } from "@/lib/order-payment";

// Вебхук Т-Банка. Безопасность: проверяем подпись уведомления, затем ПЕРЕПРОВЕРЯЕМ
// статус запросом GetState (не доверяем телу). Идемпотентен. Ответ — «OK» (обязательно).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok() {
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(req: Request) {
  if (!isTbankConfigured()) return ok();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return ok();
  }

  // Проверка подписи
  if (!verifyTbankNotification(body)) {
    console.error("Т-Банк вебхук: неверная подпись");
    return ok(); // не повторять
  }

  const paymentId = body.PaymentId ? String(body.PaymentId) : null;
  const orderId = body.OrderId ? String(body.OrderId) : null;
  if (!paymentId || !orderId) return ok();

  try {
    // Перепроверяем статус на стороне Т-Банка
    const status = (await getTbankState(paymentId)) ?? String(body.Status ?? "");
    const mapped = mapTbankStatus(status);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tbankPaymentId: true },
    });
    if (!order) return ok();
    if (order.tbankPaymentId && order.tbankPaymentId !== paymentId) {
      console.error("Т-Банк вебхук: PaymentId не совпадает с заказом");
      return ok();
    }

    const applied = await applyOrderPaymentState({
      orderId,
      tbankPaymentId: paymentId,
      paymentStatus: mapped.paymentStatus,
      orderStatus: mapped.orderStatus,
    });
    if (applied?.inventoryRestored) revalidateTag("products", "max");
  } catch (e) {
    console.error("Т-Банк вебхук:", e);
    // Вернём OK, чтобы не зациклить повторы; статус подтянется поллингом/следующим уведомлением
  }

  return ok();
}
