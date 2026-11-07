"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { customerCancelBlockReason, SELF_CANCEL_STATUSES } from "@/lib/order-cancel";
import { restoreOrderInventory } from "@/lib/order-inventory";
import { escapeHtml, sendTelegram } from "@/lib/telegram";
import { formatRub } from "@/lib/money";

export type ClaimOrderResult = { ok: true } | { ok: false; error: string };

/**
 * Привязывает гостевой заказ к аккаунту вошедшего покупателя.
 * Право на заказ подтверждает секретный accessToken из ссылки на страницу заказа —
 * по email/телефону не привязываем: email не подтверждается, чужие заказы увели бы чужие адреса.
 */
export async function claimGuestOrder(accessToken: string): Promise<ClaimOrderResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session.user.role !== "CUSTOMER") {
    return { ok: false, error: "Войдите в аккаунт покупателя" };
  }
  if (typeof accessToken !== "string" || accessToken.length === 0 || accessToken.length > 128) {
    return { ok: false, error: "Заказ не найден" };
  }
  if (consumeRateLimit(`claim-order:${userId}`, 20, 15 * 60_000)) {
    return { ok: false, error: "Слишком много попыток. Повторите позже." };
  }

  const order = await prisma.order.findUnique({
    where: { accessToken },
    select: { id: true, userId: true },
  });
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.userId === userId) return { ok: true };
  if (order.userId) return { ok: false, error: "Заказ уже привязан к другому аккаунту" };

  // Условие userId: null защищает от гонки двух одновременных привязок.
  const { count } = await prisma.order.updateMany({
    where: { id: order.id, userId: null },
    data: { userId },
  });
  if (count === 0) return { ok: false, error: "Заказ уже привязан к другому аккаунту" };

  return { ok: true };
}

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

/**
 * Покупатель отменяет свой заказ из личного кабинета, пока его не передали в СДЭК
 * и не оплатили онлайн. Товары возвращаются на остаток, владельцу уходит сообщение в Telegram.
 */
export async function cancelMyOrder(orderNumber: number): Promise<CancelOrderResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Войдите в аккаунт" };
  if (!Number.isInteger(orderNumber)) return { ok: false, error: "Заказ не найден" };

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
    if (!order || order.userId !== userId) return { kind: "missing" as const };
    const blocked = customerCancelBlockReason(order);
    if (blocked) return { kind: "blocked" as const, error: blocked };

    // Условия повторяются в updateMany: защита от гонки с менеджером, который как раз отправляет заказ.
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: { in: SELF_CANCEL_STATUSES }, cdekOrderUuid: null },
      data: { status: "CANCELLED" },
    });
    if (count === 0) {
      return { kind: "blocked" as const, error: "Статус заказа изменился — обновите страницу." };
    }
    await restoreOrderInventory(tx, order.id);
    return { kind: "cancelled" as const, order };
  });

  if (result.kind === "missing") return { ok: false, error: "Заказ не найден" };
  if (result.kind === "blocked") return { ok: false, error: result.error };

  const { order } = result;
  const itemsList = order.items
    .map((i) => `• ${escapeHtml(i.productName)}${i.variantName ? ` (${escapeHtml(i.variantName)})` : ""} × ${i.quantity}`)
    .join("\n");
  await sendTelegram(
    `❌ <b>Покупатель отменил заказ №${order.orderNumber}</b>\n\n` +
      `👤 ${escapeHtml(order.customerName)}\n📞 ${escapeHtml(order.customerPhone)}\n` +
      `\n📦 ${itemsList}\n\n💰 ${formatRub(order.totalKopecks)}\n\n` +
      `<i>Товары вернулись на остаток сайта. Если уменьшали остаток на Авито — верните его.</i>`,
  );

  revalidateTag("products", "max");
  revalidatePath("/account/orders");
  revalidatePath(`/account/orders/${order.orderNumber}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  return { ok: true };
}
