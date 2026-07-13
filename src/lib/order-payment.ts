import { prisma } from "@/lib/prisma";
import { restoreOrderInventory } from "@/lib/order-inventory";

type ApplyPaymentStateInput = {
  orderId: string;
  paymentStatus: string;
  orderStatus?: string;
  tbankPaymentId?: string;
  yookassaPaymentId?: string;
};

export type AppliedPaymentState = {
  paymentStatus: string;
  orderStatus: string;
  inventoryRestored: boolean;
};

/** Applies a verified provider state and releases inventory on final cancellation. */
export async function applyOrderPaymentState(
  input: ApplyPaymentStateInput,
): Promise<AppliedPaymentState | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        inventoryRestoredAt: true,
      },
    });
    if (!order) return null;

    // Provider notifications can arrive out of order. Never regress a final state.
    if (
      (order.inventoryRestoredAt && input.paymentStatus !== "CANCELLED") ||
      (order.paymentStatus === "SUCCEEDED" &&
        input.paymentStatus !== "SUCCEEDED" &&
        input.paymentStatus !== "CANCELLED") ||
      (order.paymentStatus === "CANCELLED" && input.paymentStatus !== "CANCELLED")
    ) {
      return {
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        inventoryRestored: false,
      };
    }

    const orderStatus = input.orderStatus ?? order.status;
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: input.paymentStatus,
        ...(input.orderStatus ? { status: input.orderStatus } : {}),
        ...(input.tbankPaymentId ? { tbankPaymentId: input.tbankPaymentId } : {}),
        ...(input.yookassaPaymentId ? { yookassaPaymentId: input.yookassaPaymentId } : {}),
      },
    });

    const inventoryRestored =
      orderStatus === "CANCELLED"
        ? await restoreOrderInventory(tx, order.id)
        : false;

    return { paymentStatus: input.paymentStatus, orderStatus, inventoryRestored };
  });
}
