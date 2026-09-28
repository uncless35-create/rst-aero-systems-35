"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

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
