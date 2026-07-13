// Интеграция с API СДЭК (v2): получение OAuth-токена и серверный расчёт тарифа.
// Используется бэкендом виджета (/api/cdek) и пересчётом стоимости при создании заказа.
//
// По умолчанию — ТЕСТОВЫЙ контур СДЭК (публичные тестовые ключи из документации).
// Для боевого режима задайте в окружении:
//   CDEK_API_URL=https://api.cdek.ru/v2
//   CDEK_ACCOUNT=<боевой account>
//   CDEK_PASSWORD=<боевой пароль интеграции>
//   CDEK_FROM_CITY_CODE=<код города отправки СДЭК>

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

/**
 * Серверный расчёт стоимости доставки по конкретному тарифу.
 * Используется при создании заказа — данным клиента о цене не доверяем.
 */
export async function calculateTariff(params: {
  tariffCode: number;
  toCityCode: number;
  weightGrams: number;
  fromCityCode?: number;
}): Promise<CdekTariffResult> {
  const res = await cdekFetch("calculator/tariff", {
    method: "POST",
    json: {
      type: 1, // интернет-магазин
      tariff_code: params.tariffCode,
      from_location: { code: params.fromCityCode ?? CDEK_FROM_CITY_CODE },
      to_location: { code: params.toCityCode },
      packages: [{ weight: Math.max(1, Math.round(params.weightGrams)) }],
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`СДЭК: расчёт тарифа не удался (${res.status}) ${text}`);
  }
  const data = (await res.json()) as {
    delivery_sum?: number;
    period_min?: number;
    period_max?: number;
  };
  if (typeof data.delivery_sum !== "number") {
    throw new Error("СДЭК: в ответе нет стоимости доставки");
  }
  return {
    deliverySumKopecks: Math.round(data.delivery_sum * 100),
    periodMin: data.period_min ?? null,
    periodMax: data.period_max ?? null,
  };
}

export type CdekShipmentItem = {
  name: string;
  wareKey: string; // артикул/идентификатор товара
  costRub: number; // объявленная стоимость, руб
  weightGrams: number;
  amount: number;
};

/**
 * Создать заказ-отправление (накладную) в СДЭК: POST /v2/orders.
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
          payment: { value: 0 }, // предоплата — наложенного платежа нет
          cost: Math.max(0, Math.round(i.costRub)),
          weight: Math.max(1, Math.round(i.weightGrams)),
          amount: Math.max(1, i.amount),
        })),
      },
    ],
  };

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

/** Информация о заказе-отправлении СДЭК: номер накладной и статус. */
export async function getCdekOrderInfo(
  uuid: string,
): Promise<{ cdekNumber: string | null; status: string | null }> {
  const res = await cdekFetch(`orders/${uuid}`, { method: "GET" });
  if (!res.ok) return { cdekNumber: null, status: null };
  const data = (await res.json()) as {
    entity?: { cdek_number?: string; statuses?: { name?: string }[] };
  };
  return {
    cdekNumber: data.entity?.cdek_number ?? null,
    status: data.entity?.statuses?.[0]?.name ?? null,
  };
}
