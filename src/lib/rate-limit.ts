/**
 * Простой лимитер попыток в памяти процесса.
 * На serverless действует в рамках одного инстанса — это базовая защита
 * от перебора (в связке с медленным bcrypt), не полноценный WAF.
 */

type Entry = { count: number; firstAt: number };

const store = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX_ATTEMPTS = 5;

function pruneExpired(now: number, windowMs: number): void {
  if (store.size <= 10_000) return;
  for (const [key, value] of store) {
    if (now - value.firstAt > windowMs) store.delete(key);
  }
}

/** true — лимит исчерпан, попытку следует отклонить. */
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) return false;
  return entry.count >= MAX_ATTEMPTS;
}

/** Зафиксировать неудачную попытку. */
export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
  pruneExpired(now, WINDOW_MS);
}

/** Сбросить счётчик (после успешного входа). */
export function resetFailures(key: string): void {
  store.delete(key);
}

/** Consumes one request and returns true when the caller exceeded the limit. */
export function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.firstAt > windowMs) {
    store.set(key, { count: 1, firstAt: now });
    pruneExpired(now, windowMs);
    return false;
  }
  entry.count += 1;
  return entry.count > maxRequests;
}
