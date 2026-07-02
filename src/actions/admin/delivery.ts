"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin";

const schema = z.object({
  name: z.string().trim().min(2, "Укажите название"),
  description: z.string().trim().optional(),
  priceKopecks: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  requiresAddress: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidateTag("delivery");
  revalidatePath("/admin/delivery-methods");
  revalidatePath("/checkout");
}

export async function createDeliveryMethod(input: z.input<typeof schema>): Promise<ActionResult> {
  await assertAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await prisma.deliveryMethod.create({ data: parsed.data });
  revalidate();
  return { ok: true };
}

export async function updateDeliveryMethod(
  id: string,
  input: z.input<typeof schema>
): Promise<ActionResult> {
  await assertAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await prisma.deliveryMethod.update({ where: { id }, data: parsed.data });
  revalidate();
  return { ok: true };
}

export async function deleteDeliveryMethod(id: string): Promise<ActionResult> {
  await assertAdmin();
  const count = await prisma.order.count({ where: { deliveryMethodId: id } });
  if (count > 0) {
    return { ok: false, error: `Нельзя удалить: способ используется в ${count} заказах` };
  }
  await prisma.deliveryMethod.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
