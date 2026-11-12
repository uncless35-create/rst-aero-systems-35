import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCdekWebhookSecret } from "@/lib/cdek";
import { syncCdekOrder } from "@/lib/cdek-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Вебхук СДЭК ORDER_STATUS (регистрация: pnpm cdek:webhook). СДЭК не подписывает запросы,
 * поэтому в адресе секрет, а телу не доверяем: по uuid перечитываем отправление из API СДЭК.
 * На всё, что обработано или не наше, отвечаем 200, чтобы СДЭК не повторял.
 */
type CdekWebhook = {
  type?: string;
  uuid?: string;
  attributes?: { cdek_number?: string | number };
};

const ok = () => NextResponse.json({ ok: true });

function secretsMatch(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (!secretsMatch(request.nextUrl.searchParams.get("secret"), getCdekWebhookSecret())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as CdekWebhook | null;
  if (body?.type !== "ORDER_STATUS") return ok();

  const uuid = typeof body.uuid === "string" ? body.uuid : null;
  const number = body.attributes?.cdek_number ? String(body.attributes.cdek_number) : null;
  if (!uuid && !number) return ok();

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        ...(uuid ? [{ cdekOrderUuid: uuid }] : []),
        ...(number ? [{ cdekTrackNumber: number }] : []),
      ],
    },
    select: { id: true },
  });
  if (!order) return ok();

  try {
    await syncCdekOrder(order.id);
    return ok();
  } catch (e) {
    // СДЭК недоступен — пусть повторит; к тому же статус подтянет фоновый опрос.
    console.error("Вебхук СДЭК:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
