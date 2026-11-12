// Интеграция с API СДЭК (v2): получение OAuth-токена и серверный расчёт тарифа.
// Используется бэкендом виджета (/api/cdek) и пересчётом стоимости при создании заказа.
//
// По умолчанию — ТЕСТОВЫЙ контур СДЭК (публичные тестовые ключи из документации).
// Для боевого режима задайте в окружении:
//   CDEK_API_URL=https://api.cdek.ru/v2
//   CDEK_ACCOUNT=<боевой account>
//   CDEK_PASSWORD=<боевой пароль интеграции>
//   CDEK_FROM_CITY_CODE=<код города отправки СДЭК>

import { createHash } from "node:crypto";
import { CDEK_PARCEL_CM } from "@/lib/cdek-options";

const API_URL = process.env.CDEK_API_URL?.replace(/\/$/, "") ?? "https://api.edu.cdek.ru/v2";
// Публичные тестовые ключи СДЭК (работают только на api.edu.cdek.ru)
const ACCOUNT = process.env.CDEK_ACCOUNT ?? "EMscd6r9JnFiQ3bLoyjJY6eM78JrJceI";
const PASSWORD = process.env.CDEK_PASSWORD ?? "PjLZkKBHEiLK3YsjtNez3M68Pmt7fFG9";

/** Код города отправки в системе СДЭК (по умолчанию Москва = 44). */
export const CDEK_FROM_CITY_CODE = Number(process.env.CDEK_FROM_CITY_CODE ?? 44);
/** Вес по умолчанию (г) для товаров без указанного веса. */
export const CDEK_DEFAULT_WEIGHT_GRAMS = Number(process.env.CDEK_DEFAULT_WEIGHT_GRAMS ?? 500);

// --- Отправитель (для создания накладной) ---
const SENDER_NAME = process.env.CDEK_SENDER_NAME ?? "";
const SENDER_PHONE = process.env.CDEK_SENDER_PHONE ?? "";
/** Код ПВЗ СДЭК, куда отправитель сдаёт посылки (shipment_point). */
const SHIPMENT_POINT = process.env.CDEK_SHIPMENT_POINT ?? "";

/** Настроен ли отправитель для создания накладных СДЭК. */
export function isCdekShipmentConfigured(): boolean {
  return !!SENDER_NAME && !!SENDER_PHONE && !!SHIPMENT_POINT;
}

/**
 * Настроен ли боевой СДЭК. Опираемся на несекретный CDEK_API_URL (боевой домен),
 * т.к. эта проверка вызывается и при сборке, куда Sensitive-секреты могут не попадать.
 * Сам аккаунт/пароль читаются в рантайме, где Sensitive-переменные доступны.
 */
export function isCdekProduction(): boolean {
  return API_URL.includes("api.cdek.ru");
}

export function getCdekApiUrl(): string {
  return API_URL;
}

// --- Кеш токена в памяти процесса ---
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getCdekToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: ACCOUNT,
    client_secret: PASSWORD,
  });
  const res = await fetch(`${API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // Токен нельзя кешировать на уровне fetch — управляем сроком сами
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`СДЭК: не удалось получить токен (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/** Авторизованный запрос к API СДЭК. */
export async function cdekFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const token = await getCdekToken();
  const { json, headers, ...rest } = init;
  return fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
}

export type CdekTariffResult = {
  deliverySumKopecks: number;
  periodMin: number | null;
  periodMax: number | null;
};

export type CdekDeliveryPoint = {
  code: string;
  cityCode: number;
  city: string | null;
  address: string;
};

/** Получает ПВЗ по точному коду для серверной проверки выбора покупателя. */
export async function getCdekDeliveryPoint(code: string): Promise<CdekDeliveryPoint | null> {
  const params = new URLSearchParams({ code });
  const res = await cdekFetch(`deliverypoints?${params.toString()}`, { method: "GET" });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{
    code?: string;
    location?: {
      city_code?: number;
      city?: string;
      address?: string;
      address_full?: string;
    };
  }>;
  const point = data.find((item) => item.code === code);
  const cityCode = point?.location?.city_code;
  const address = point?.location?.address_full || point?.location?.address;
  if (!point?.code || cityCode == null || !address) return null;
  return {
    code: point.code,
    cityCode,
    city: point.location?.city ?? null,
    address,
  };
}

type CdekLocation = Record<string, unknown>;
type CdekPackage = { weight: number; length?: number; width?: number; height?: number };

/**
 * Сколько СДЭК выставит магазину за посылку по тарифу: `total_sum` — доставка с НДС
 * плюс страховка объявленной стоимости (СДЭК берёт её всегда, когда в накладной есть
 * стоимость товара). `delivery_sum` из calculator/tariff — без НДС, брать его нельзя:
 * с покупателя возьмём меньше, чем заплатим сами.
 */
export async function calculateTariffTotal(params: {
  tariffCode: number;
  from: CdekLocation;
  to: CdekLocation;
  packages: CdekPackage[];
  declaredValueRub: number;
}): Promise<CdekTariffResult> {
  const declared = Math.round(params.declaredValueRub);
  const res = await cdekFetch("calculator/tariff", {
    method: "POST",
    json: {
      type: 1, // интернет-магазин
      tariff_code: params.tariffCode,
      from_location: params.from,
      to_location: params.to,
      packages: params.packages,
      ...(declared > 0 ? { services: [{ code: "INSURANCE", parameter: String(declared) }] } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`СДЭК: расчёт тарифа не удался (${res.status}) ${text}`);
  }
  const data = (await res.json()) as {
    total_sum?: number;
    period_min?: number;
    period_max?: number;
  };
  if (typeof data.total_sum !== "number") {
    throw new Error("СДЭК: в ответе нет стоимости доставки");
  }
  return {
    deliverySumKopecks: Math.round(data.total_sum * 100),
    periodMin: data.period_min ?? null,
    periodMax: data.period_max ?? null,
  };
}

/**
 * Серверный расчёт стоимости доставки по конкретному тарифу.
 * Используется при создании заказа — данным клиента о цене не доверяем.
 */
export async function calculateTariff(params: {
  tariffCode: number;
  toCityCode: number;
  weightGrams: number;
  /** Стоимость товаров, руб — объявленная стоимость для страховки СДЭК */
  declaredValueRub: number;
  fromCityCode?: number;
}): Promise<CdekTariffResult> {
  return calculateTariffTotal({
    tariffCode: params.tariffCode,
    from: { code: params.fromCityCode ?? CDEK_FROM_CITY_CODE },
    to: { code: params.toCityCode },
    packages: [{ weight: Math.max(1, Math.round(params.weightGrams)), ...CDEK_PARCEL_CM }],
    declaredValueRub: params.declaredValueRub,
  });
}

export type CdekShipmentItem = {
  name: string;
  wareKey: string; // артикул/идентификатор товара
  costRub: number; // объявленная стоимость, руб
  /** Наложенный платёж за единицу товара, руб; 0 — товар оплачен заранее */
  paymentRub: number;
  weightGrams: number;
  amount: number;
};

/**
 * Создать заказ-отправление (накладную) в СДЭК: POST /v2/orders.
 * Наложенный платёж: СДЭК берёт с получателя paymentRub за каждый товар и
 * deliveryRecipientCostRub за доставку, затем перечисляет деньги магазину.
 * Возвращает UUID заказа. Номер накладной (cdek_number) появляется асинхронно —
 * получить его можно через getCdekOrderInfo(uuid).
 */
export async function createCdekShipment(params: {
  tariffCode: number;
  toCityCode: number;
  pvzCode: string | null; // для доставки в ПВЗ (office)
  toAddress: string | null; // для доставки курьером (door)
  recipientName: string;
  recipientPhone: string;
  items: CdekShipmentItem[];
  /** Сколько получатель платит за доставку при получении, руб; 0 — не берём */
  deliveryRecipientCostRub: number;
}): Promise<{ uuid: string }> {
  const totalWeight = params.items.reduce(
    (s, i) => s + Math.max(1, Math.round(i.weightGrams)) * i.amount,
    0,
  );

  const body: Record<string, unknown> = {
    type: 1, // интернет-магазин
    tariff_code: params.tariffCode,
    shipment_point: SHIPMENT_POINT,
    sender: { name: SENDER_NAME, phones: [{ number: SENDER_PHONE }] },
    recipient: {
      name: params.recipientName,
      phones: [{ number: params.recipientPhone }],
    },
    packages: [
      {
        number: "1",
        weight: Math.max(1, totalWeight),
        items: params.items.map((i, idx) => ({
          name: i.name.slice(0, 255),
          ware_key: (i.wareKey || `item-${idx + 1}`).slice(0, 50),
          payment: { value: Math.max(0, i.paymentRub) },
          cost: Math.max(0, Math.round(i.costRub)),
          weight: Math.max(1, Math.round(i.weightGrams)),
          amount: Math.max(1, i.amount),
        })),
      },
    ],
  };

  if (params.deliveryRecipientCostRub > 0) {
    body.delivery_recipient_cost = { value: params.deliveryRecipientCostRub };
  }

  // ПВЗ или курьер
  if (params.pvzCode) {
    body.delivery_point = params.pvzCode;
  } else {
    body.to_location = {
      code: params.toCityCode,
      address: params.toAddress || "—",
    };
  }

  const res = await cdekFetch("orders", { method: "POST", json: body });
  const data = (await res.json()) as {
    entity?: { uuid?: string };
    requests?: { state?: string; errors?: { code: string; message: string }[] }[];
  };
  const uuid = data.entity?.uuid;
  if (!uuid) {
    const err = data.requests?.[0]?.errors?.[0]?.message ?? "неизвестная ошибка";
    throw new Error(`СДЭК: не удалось создать отправление — ${err}`);
  }
  return { uuid };
}

/** Событие в истории отправления СДЭК. */
export type CdekStatusEvent = {
  code: string;
  name: string;
  /** ISO-время СДЭК, например 2026-11-10T16:46:07+0000 */
  dateTime: string;
  city: string | null;
};

/**
 * Информация о заказе-отправлении СДЭК: номер накладной и история статусов.
 * found=false — СДЭК не знает такой uuid (или запрос не удался): статус заказа не трогаем.
 */
export async function getCdekOrderInfo(uuid: string): Promise<{
  found: boolean;
  cdekNumber: string | null;
  statuses: CdekStatusEvent[];
}> {
  const res = await cdekFetch(`orders/${encodeURIComponent(uuid)}`, { method: "GET" });
  if (!res.ok) return { found: false, cdekNumber: null, statuses: [] };
  const data = (await res.json()) as {
    entity?: {
      cdek_number?: string;
      statuses?: { code?: string; name?: string; date_time?: string; city?: string }[];
    };
  };
  const statuses = (data.entity?.statuses ?? []).flatMap((s) =>
    s.code && s.date_time
      ? [{ code: s.code, name: s.name ?? s.code, dateTime: s.date_time, city: s.city ?? null }]
      : [],
  );
  return { found: !!data.entity, cdekNumber: data.entity?.cdek_number ?? null, statuses };
}

/** Подписки СДЭК на события аккаунта (вебхуки). */
export async function listCdekWebhooks(): Promise<{ uuid: string; type: string; url: string }[]> {
  const res = await cdekFetch("webhooks", { method: "GET" });
  if (!res.ok) throw new Error(`СДЭК: список вебхуков не получен (${res.status})`);
  return (await res.json()) as { uuid: string; type: string; url: string }[];
}

export async function createCdekWebhook(type: string, url: string): Promise<void> {
  const res = await cdekFetch("webhooks", { method: "POST", json: { type, url } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`СДЭК: вебхук не создан (${res.status}) ${text}`);
  }
}

export async function deleteCdekWebhook(uuid: string): Promise<void> {
  const res = await cdekFetch(`webhooks/${encodeURIComponent(uuid)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`СДЭК: вебхук ${uuid} не удалён (${res.status})`);
}

/** Секрет в адресе вебхука СДЭК: СДЭК не подписывает запросы. Явный из env либо хеш пароля. */
export function getCdekWebhookSecret(): string {
  return (
    process.env.CDEK_WEBHOOK_SECRET ||
    createHash("sha256").update(`rst-aero-cdek-webhook:${ACCOUNT}:${PASSWORD}`).digest("hex")
  );
}
