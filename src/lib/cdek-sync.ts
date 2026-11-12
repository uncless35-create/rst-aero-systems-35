// Синхронизация статусов заказов со СДЭК. Два входа:
//   • вебхук СДЭК /api/webhooks/cdek — сразу после смены статуса;
//   • опрос активных отправлений раз в 30 минут (instrumentation.ts) — если вебхук потерялся.
// Оба только называют заказ: статус всегда перечитывается из API СДЭК по uuid.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCdekOrderInfo } from "@/lib/cdek";
import { latestCdekStatus, parseCdekDate, planOrderUpdate } from "@/lib/cdek-status";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { escapeHtml, sendTelegramMessage } from "@/lib/telegram";

export type CdekSyncResult = {
  orderId: string;
  status: string;
  cdekStatusName: string | null;
  trackNumber: string | null;
  changed: boolean;
};

const ORDER_FIELDS = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  cdekOrderUuid: true,
  cdekTrackNumber: true,
  cdekStatusCode: true,
  cdekStatusName: true,
  cdekStatusAt: true,
} as const;

/** Перечитать отправление в СДЭК и обновить заказ. null — у заказа нет отправления или СДЭК его не знает. */
export async function syncCdekOrder(orderId: string): Promise<CdekSyncResult | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: ORDER_FIELDS });
  if (!order?.cdekOrderUuid) return null;

  const info = await getCdekOrderInfo(order.cdekOrderUuid);
  if (!info.found) return null;

  const latest = latestCdekStatus(info.statuses);
  const latestAt = latest ? new Date(parseCdekDate(latest.dateTime)) : null;
  const plan = planOrderUpdate(order, latest?.code ?? null);

  const data: {
    cdekTrackNumber?: string;
    cdekStatusCode?: string;
    cdekStatusName?: string;
    cdekStatusCity?: string | null;
    cdekStatusAt?: Date;
    status?: OrderStatus;
    paymentStatus?: string;
  } = {};
  if (info.cdekNumber && info.cdekNumber !== order.cdekTrackNumber) {
    data.cdekTrackNumber = info.cdekNumber;
  }
  const cdekStatusChanged =
    !!latest &&
    (latest.code !== order.cdekStatusCode ||
      latestAt?.getTime() !== order.cdekStatusAt?.getTime());
  if (latest && cdekStatusChanged) {
    data.cdekStatusCode = latest.code;
    data.cdekStatusName = latest.name;
    data.cdekStatusCity = latest.city;
    data.cdekStatusAt = latestAt!;
  }
  if (plan.status) data.status = plan.status;
  if (plan.markPaid) data.paymentStatus = "SUCCEEDED";

  const result: CdekSyncResult = {
    orderId: order.id,
    status: plan.status ?? order.status,
    cdekStatusName: latest?.name ?? order.cdekStatusName,
    trackNumber: info.cdekNumber ?? order.cdekTrackNumber,
    changed: false,
  };
  if (Object.keys(data).length === 0) return result;

  // Вебхук и опрос могут прийти одновременно: пишем, только если заказ не изменился с момента
  // чтения. Так уведомление владельцу уходит один раз, а ручную правку статуса не перетираем.
  const updated = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      cdekStatusCode: order.cdekStatusCode,
      cdekStatusAt: order.cdekStatusAt,
    },
    data,
  });
  if (updated.count !== 1) return { ...result, status: order.status };
  result.changed = true;

  if (data.status || data.paymentStatus) revalidateOrderPages(order.id);

  const where = latest?.city ? `, ${escapeHtml(latest.city)}` : "";
  if (plan.status === "COMPLETED") {
    await sendTelegramMessage(
      `✅ Заказ №${order.orderNumber} вручён покупателю${where}.` +
        (plan.markPaid ? "\nНаложенный платёж принят СДЭК — отметил заказ оплаченным." : "") +
        adminLink(order.id),
    );
  } else if (plan.problem && cdekStatusChanged) {
    await sendTelegramMessage(
      `⚠️ Заказ №${order.orderNumber}: СДЭК — «${escapeHtml(latest!.name)}»${where}.\n` +
        `Статус на сайте оставил «${ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}», ` +
        `разберитесь с заказом вручную.` +
        adminLink(order.id),
    );
  }
  return result;
}

/** Заказы, по которым СДЭК ещё может прислать новости. */
export async function syncActiveCdekOrders(): Promise<{ checked: number; changed: number }> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      cdekOrderUuid: { not: null },
      createdAt: { gte: since },
      OR: [
        { status: { notIn: ["CANCELLED", "COMPLETED"] } },
        // Завершён вручную до появления синхронизации — подтянуть вручение и оплату один раз.
        { status: "COMPLETED", cdekStatusCode: null },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let changed = 0;
  for (const { id } of orders) {
    try {
      const r = await syncCdekOrder(id);
      if (r?.changed) changed++;
    } catch (e) {
      console.error(`СДЭК: синхронизация заказа ${id} не удалась:`, e);
    }
  }
  return { checked: orders.length, changed };
}

const POLL_INTERVAL_MS = 30 * 60 * 1000;
let polling = false;

/** Опрос СДЭК в фоне процесса сайта: через минуту после старта, затем каждые 30 минут. */
export function startCdekStatusPolling(): void {
  if (polling) return;
  polling = true;
  const run = async () => {
    try {
      const { checked, changed } = await syncActiveCdekOrders();
      if (changed > 0) console.log(`СДЭК: проверено отправлений ${checked}, обновлено ${changed}`);
    } catch (e) {
      console.error("СДЭК: опрос статусов не удался:", e);
    }
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, POLL_INTERVAL_MS).unref();
}

function adminLink(orderId: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return site ? `\n${new URL(`/admin/orders/${orderId}`, site)}` : "";
}

/** Вне запроса (фоновый опрос) revalidatePath недоступен — страницы заказов и так динамические. */
function revalidateOrderPages(orderId: string): void {
  try {
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/account/orders", "layout");
  } catch {
    // нет контекста запроса
  }
}
