import type { Prisma } from "@prisma/client";

export type InventoryItem = {
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
};

export class InventoryUnavailableError extends Error {
  constructor(public readonly productName: string) {
    super(`Недостаточно товара «${productName}» в наличии`);
    this.name = "InventoryUnavailableError";
  }
}

/**
 * Atomically reserves every order item. If one item is unavailable, throwing
 * rolls the surrounding transaction back, including earlier reservations.
 */
export async function reserveOrderInventory(
  tx: Prisma.TransactionClient,
  items: InventoryItem[],
): Promise<void> {
  for (const item of items) {
    const result = item.variantId
      ? await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            productId: item.productId,
            stockQty: { gte: item.quantity },
            product: { isActive: true, outOfStock: false },
          },
          data: { stockQty: { decrement: item.quantity } },
        })
      : await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            outOfStock: false,
            stockQty: { gte: item.quantity },
          },
          data: { stockQty: { decrement: item.quantity } },
        });

    if (result.count !== 1) {
      throw new InventoryUnavailableError(item.productName);
    }
  }
}

/** Returns reserved stock once. The marker and increments share one transaction. */
export async function restoreOrderInventory(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, inventoryRestoredAt: null },
    data: { inventoryRestoredAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, variantId: true, quantity: true },
  });

  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stockQty: { increment: item.quantity } },
      });
    } else if (item.productId) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      });
    }
  }

  return true;
}
