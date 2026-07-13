import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cdekFetch } from "@/lib/cdek";
import { consumeRateLimit } from "@/lib/rate-limit";

// Бэкенд-«сервис» для виджета СДЭК. Виджет обращается сюда с ?action=offices|calculate,
// а мы проксируем запрос в API СДЭК, добавляя серверный OAuth-токен (ключи не попадают на клиент).
// Контракт повторяет эталонный service.php из репозитория cdek-it/widget.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const booleanQuery = z.enum(["true", "false"]).transform((value) => value === "true");
const officesQuerySchema = z.object({
  type: z.enum(["PVZ", "POSTAMAT", "ALL"]).optional(),
  have_cashless: booleanQuery.optional(),
  have_cash: booleanQuery.optional(),
  allowed_cod: booleanQuery.optional(),
  is_dressing_room: booleanQuery.optional(),
  is_handout: booleanQuery.optional(),
  is_handout_only: booleanQuery.optional(),
  is_reception: booleanQuery.optional(),
  page: z.coerce.number().int().min(0).max(10_000).optional(),
  size: z.coerce.number().int().min(1).max(1_000).optional(),
});

const locationSchema = z.object({
  code: z.number().int().positive().nullable().optional(),
  postal_code: z.string().trim().max(20).nullable().optional(),
  country_code: z.string().trim().max(3).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
});

const calculateSchema = z.object({
  currency: z.number().int().min(1).max(20),
  lang: z.enum(["rus", "eng"]),
  from_location: locationSchema,
  to_location: locationSchema,
  packages: z
    .array(
      z.object({
        width: z.number().positive().max(10_000),
        height: z.number().positive().max(10_000),
        length: z.number().positive().max(10_000),
        weight: z.number().positive().max(1_000_000),
      }),
    )
    .min(1)
    .max(20),
});

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

function limited(req: NextRequest): boolean {
  return consumeRateLimit(`cdek:${clientKey(req)}`, 120, 60_000);
}

function tooManyRequests() {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

// Пункты выдачи (GET ?action=offices&<фильтры>)
export async function GET(req: NextRequest) {
  if (limited(req)) return tooManyRequests();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action !== "offices") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const parsed = officesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) params.set(key, String(value));
  }

  try {
    const res = await cdekFetch(`deliverypoints?${params.toString()}`, { method: "GET" });
    const data = await res.json();
    const total = res.headers.get("x-total-elements");
    return NextResponse.json(data, {
      status: res.status,
      headers: total ? { "X-Total-Elements": total } : undefined,
    });
  } catch (e) {
    console.error("СДЭК offices:", e);
    return NextResponse.json({ error: "cdek_unavailable" }, { status: 502 });
  }
}

// Расчёт тарифов (POST ?action=calculate, тело — payload от виджета)
export async function POST(req: NextRequest) {
  if (limited(req)) return tooManyRequests();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > 20_000) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }
  let body: unknown = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bodyAction =
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : undefined;
  if (action !== "calculate" && bodyAction !== "calculate") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const parsed = calculateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const res = await cdekFetch("calculator/tarifflist", {
      method: "POST",
      json: parsed.data,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("СДЭК calculate:", e);
    return NextResponse.json({ error: "cdek_unavailable" }, { status: 502 });
  }
}
