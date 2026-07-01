/**
 * Работа с деньгами. Все суммы в базе хранятся в КОПЕЙКАХ (целое число),
 * чтобы исключить ошибки округления с плавающей точкой.
 */

/** Форматирует копейки в строку рублей: 1234567 → "12 345 ₽" (без копеек, если ровно). */
export function formatRub(kopecks: number): string {
  const rubles = kopecks / 100;
  const hasFraction = kopecks % 100 !== 0;
  return (
    rubles.toLocaleString("ru-RU", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }) + " ₽"
  );
}

/** Рубли (число или строка) → копейки. */
export function rublesToKopecks(rubles: number | string): number {
  const value = typeof rubles === "string" ? parseFloat(rubles.replace(",", ".")) : rubles;
  return Math.round((value || 0) * 100);
}

/** Копейки → рубли (для инпутов в админке). */
export function kopecksToRubles(kopecks: number): number {
  return kopecks / 100;
}
