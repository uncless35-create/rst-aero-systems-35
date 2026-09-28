/** accessToken гостевого заказа из query-параметра `?order=` (cuid — только [A-Za-z0-9_-]). */
export function parseOrderToken(value: string | null | undefined): string | null {
  return value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}
