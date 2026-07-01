"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false, error: "Некорректный статус" };
  }
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}
