export const CDEK_TARIFFS = {
  office: [136, 234],
  door: [137, 233],
} as const;

export type CdekMode = keyof typeof CDEK_TARIFFS;

/**
 * Коробка, по которой считаем посылку, см. Одна и та же для карты СДЭК и серверного
 * пересчёта при оформлении — иначе покупатель увидит одну цену, а в заказ попадёт другая.
 */
export const CDEK_PARCEL_CM = { length: 20, width: 20, height: 10 } as const;

export function isAllowedCdekTariff(mode: CdekMode, tariffCode: number): boolean {
  return (CDEK_TARIFFS[mode] as readonly number[]).includes(tariffCode);
}
