import { NextRequest, NextResponse } from "next/server";
import { cdekFetch, getCdekToken } from "@/lib/cdek";

// Бэкенд-«сервис» для виджета СДЭК. Виджет обращается сюда с ?action=offices|calculate,
// а мы проксируем запрос в API СДЭК, добавляя серверный OAuth-токен (ключи не попадают на клиент).
// Контракт повторяет эталонный service.php из репозитория cdek-it/widget.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Пункты выдачи (GET ?action=offices&<фильтры>)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // Временная диагностика: /api/cdek?debug=1 — не раскрывает секреты, только факт наличия
  if (searchParams.get("debug") === "1") {
    const env = {
      apiUrl: process.env.CDEK_API_URL ?? null,
      hasAccount: !!process.env.CDEK_ACCOUNT,
      accountLen: process.env.CDEK_ACCOUNT?.length ?? 0,
      hasPassword: !!process.env.CDEK_PASSWORD,
      passwordLen: process.env.CDEK_PASSWORD?.length ?? 0,
      fromCity: process.env.CDEK_FROM_CITY_CODE ?? null,
    };
    let tokenResult: string;
    try {
      const t = await getCdekToken();
      tokenResult = "ok:" + t.slice(0, 10);
    } catch (e) {
      tokenResult = "ERR: " + String(e);
    }
    return NextResponse.json({ env, tokenResult });
  }

  if (action !== "offices") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const params = new URLSearchParams(searchParams);
  params.delete("action");

  try {
    const res = await cdekFetch(`deliverypoints?${params.toString()}`, { method: "GET" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("СДЭК offices:", e);
    return NextResponse.json({ error: "cdek_unavailable" }, { status: 502 });
  }
}

// Расчёт тарифов (POST ?action=calculate, тело — payload от виджета)
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const body = await req.json().catch(() => ({}));

  if (action !== "calculate" && body?.action !== "calculate") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Убираем служебное поле action, если виджет положил его в тело
  const payload = { ...body };
  delete payload.action;

  try {
    const res = await cdekFetch("calculator/tarifflist", { method: "POST", json: payload });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("СДЭК calculate:", e);
    return NextResponse.json({ error: "cdek_unavailable" }, { status: 502 });
  }
}
