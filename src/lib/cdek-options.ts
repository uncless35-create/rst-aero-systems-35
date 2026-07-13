export const CDEK_TARIFFS = {
  office: [136, 234],
  door: [137, 233],
} as const;

export type CdekMode = keyof typeof CDEK_TARIFFS;

export function isAllowedCdekTariff(mode: CdekMode, tariffCode: number): boolean {
  return (CDEK_TARIFFS[mode] as readonly number[]).includes(tariffCode);
}
