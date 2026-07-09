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

/** Настроены ли боевые ключи (иначе работаем на тестовом контуре). */
export function isCdekProduction(): boolean {
  return API_URL.includes("api.cdek.ru") && !!process.env.CDEK_ACCOUNT && !!process.env.CDEK_PASSWORD;
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
