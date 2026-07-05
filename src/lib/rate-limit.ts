/**
 * Простой лимитер попыток в памяти процесса.
 * На serverless действует в рамках одного инстанса — это базовая защита
 * от перебора (в связке с медленным bcrypt), не полноценный WAF.
 */

type Entry = { count: number; firstAt: number };

const store = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX_ATTEMPTS = 5;

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
  // не даём Map расти бесконечно
  if (store.size > 10_000) {
    for (const [k, v] of store) {
      if (now - v.firstAt > WINDOW_MS) store.delete(k);
    }
  }
}

/** Сбросить счётчик (после успешного входа). */
export function resetFailures(key: string): void {
  store.delete(key);
}
