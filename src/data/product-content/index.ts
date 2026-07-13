import { aircraftContent } from "./aircraft";
import { componentContent } from "./components";
import { kitContent } from "./kits";
import { radioVideoContent } from "./radio-video";
import { whoopContent } from "./whoops";
import type { ProductContentRecord } from "./types";

export const productContent: ProductContentRecord[] = [
  ...aircraftContent,
  ...whoopContent,
  ...radioVideoContent,
  ...componentContent,
  ...kitContent,
];

export function validateProductContent(records = productContent): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    if (seen.has(record.slug)) errors.push(`Дублирующийся slug: ${record.slug}`);
    seen.add(record.slug);
    if (!record.summary.trim()) errors.push(`${record.slug}: нет краткого описания`);
    if (!record.description.trim()) errors.push(`${record.slug}: нет полного описания`);
    if (!record.exactVariant.trim()) errors.push(`${record.slug}: не указана версия`);
    if (!record.compatibility.trim()) errors.push(`${record.slug}: нет совместимости`);
    if (!record.packageContents.trim()) errors.push(`${record.slug}: нет комплектации`);
    if (record.attributes.length < 3) errors.push(`${record.slug}: меньше трёх характеристик`);
    if (record.status === "VERIFIED" && record.sources.length === 0) {
      errors.push(`${record.slug}: проверенный товар без источника`);
    }
    if (record.status === "NEEDS_REVIEW" && !record.reviewNote?.trim()) {
      errors.push(`${record.slug}: нет внутренней причины проверки`);
    }
    for (const source of record.sources) {
      if (!source.url.startsWith("https://")) errors.push(`${record.slug}: источник не HTTPS`);
    }
    if (record.primaryImageUrl && !record.primaryImageUrl.startsWith("https://")) {
      errors.push(`${record.slug}: главное фото не HTTPS`);
    }
  }

  return errors;
}

export type { ProductContentRecord } from "./types";
