export type ContentStatus = "NEEDS_REVIEW" | "VERIFIED";

export type ContentSource = {
  label: string;
  url: string;
  type: "OFFICIAL_PRODUCT" | "OFFICIAL_MANUAL" | "DISTRIBUTOR" | "OTHER";
};

export type ProductContentRecord = {
  slug: string;
  name?: string;
  primaryImageUrl?: string;
  summary: string;
  exactVariant: string;
  description: string;
  compatibility: string;
  packageContents: string;
  attributes: Array<{ name: string; value: string }>;
  sources: ContentSource[];
  status: ContentStatus;
  reviewNote?: string;
};

export function official(label: string, url: string): ContentSource {
  return { label, url, type: "OFFICIAL_PRODUCT" };
}

export function manual(label: string, url: string): ContentSource {
  return { label, url, type: "OFFICIAL_MANUAL" };
}

/** Объявление магазина на Авито, из которого взяты комплектация и описание. */
export function avitoListing(path: string): ContentSource {
  return { label: "Объявление RST AERO (FLY STORE) на Авито", url: `https://www.avito.ru${path}`, type: "OTHER" };
}
