/**
 * Российский номер в международном виде без «+»: "8 (999) 123-45-67" → "79991234567".
 * Нужен для ссылок wa.me / t.me. Если номер не похож на российский — null.
 */
export function normalizeRuPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return `7${digits.slice(1)}`;
  return null;
}
