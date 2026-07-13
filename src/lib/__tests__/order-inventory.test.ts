import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  InventoryUnavailableError,
  reserveOrderInventory,
  restoreOrderInventory,
} from "@/lib/order-inventory";

function transactionMock() {
  return {
    product: { updateMany: vi.fn() },
    productVariant: { updateMany: vi.fn() },
    order: { updateMany: vi.fn() },
    orderItem: { findMany: vi.fn() },
  } as unknown as Prisma.TransactionClient;
}

describe("order inventory", () => {
  it("reserves base and variant stock with conditional updates", async () => {
    const tx = transactionMock();
    vi.mocked(tx.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(tx.productVariant.updateMany).mockResolvedValue({ count: 1 });

    await reserveOrderInventory(tx, [
      { productId: "p1", variantId: null, productName: "Base", quantity: 2 },
      { productId: "p2", variantId: "v2", productName: "Variant", quantity: 1 },
    ]);

    expect(tx.product.updateMany).toHaveBeenCalledOnce();
    expect(tx.productVariant.updateMany).toHaveBeenCalledOnce();
  });

  it("aborts when a conditional reservation did not update a row", async () => {
    const tx = transactionMock();
    vi.mocked(tx.product.updateMany).mockResolvedValue({ count: 0 });

    await expect(
      reserveOrderInventory(tx, [
        { productId: "p1", variantId: null, productName: "Товар", quantity: 5 },
      ]),
    ).rejects.toBeInstanceOf(InventoryUnavailableError);
  });

  it("restores an order only after claiming its idempotency marker", async () => {
    const tx = transactionMock();
    vi.mocked(tx.order.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(tx.orderItem.findMany).mockResolvedValue([
      {
        id: "i1",
        orderId: "order-1",
        productId: "p1",
        variantId: null,
        productName: "Base",
        variantName: null,
        priceKopecks: 100,
        quantity: 2,
      },
      {
        id: "i2",
        orderId: "order-1",
        productId: "p2",
        variantId: "v2",
        productName: "Variant",
        variantName: "V2",
        priceKopecks: 200,
        quantity: 1,
      },
    ]);
    vi.mocked(tx.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(tx.productVariant.updateMany).mockResolvedValue({ count: 1 });

    await expect(restoreOrderInventory(tx, "order-1")).resolves.toBe(true);
    expect(tx.product.updateMany).toHaveBeenCalledOnce();
    expect(tx.productVariant.updateMany).toHaveBeenCalledOnce();
  });

  it("does nothing when inventory was already restored", async () => {
    const tx = transactionMock();
    vi.mocked(tx.order.updateMany).mockResolvedValue({ count: 0 });

    await expect(restoreOrderInventory(tx, "order-1")).resolves.toBe(false);
    expect(tx.orderItem.findMany).not.toHaveBeenCalled();
  });
});
