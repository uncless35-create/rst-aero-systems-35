"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { restoreOrderInventory } from "@/lib/order-inventory";

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        paymentStatus: true,
        tbankPaymentId: true,
        yookassaPaymentId: true,
        inventoryRestoredAt: true,
      },
    });
    if (!order) return { kind: "missing" as const, restored: false };
    if (order.inventoryRestoredAt && status !== "CANCELLED") {
      return { kind: "released" as const, restored: false };
    }
    if (
      status === "CANCELLED" &&
      (order.tbankPaymentId || order.yookassaPaymentId) &&
      order.paymentStatus !== "CANCELLED"
    ) {
      return { kind: "payment_active" as const, restored: false };
    }

    await tx.order.update({ where: { id }, data: { status } });
    const restored =
      status === "CANCELLED" ? await restoreOrderInventory(tx, id) : false;
    return { kind: "updated" as const, restored };
  });

  if (result.kind === "missing") return { ok: false, error: "Заказ не найден" };
  if (result.kind === "released") {
    return {
      ok: false,
      error: "Отменённый заказ нельзя вернуть в работу: его остатки уже освобождены",
    };
  }
  if (result.kind === "payment_active") {
    return {
      ok: false,
      error: "Сначала отмените или верните платёж у провайдера и дождитесь обновления статуса",
    };
  }
  if (result.restored) revalidateTag("products", "max");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/account/orders");
  return { ok: true };
}
