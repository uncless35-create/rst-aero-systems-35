import { SITE } from "@/lib/constants";

export type FeedProduct = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  priceKopecks: number;
  oldPriceKopecks: number | null;
  stockQty: number;
  outOfStock: boolean;
  isActive: boolean;
  contentStatus: string;
  category: { id: string; name: string; isVisible: boolean };
  images: { url: string }[];
  variants: { id: string; name: string; priceKopecks: number | null; stockQty: number }[];
};

function xml(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0)!;
      return code === 9 || code === 10 || code === 13 ||
        (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff);
    })
    .join("")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function httpUrl(path: string, base: string): string | null {
  try {
    const url = new URL(path, base);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** YML: только опубликованные, проверенные товары с фотографиями и реальной ценой. */
export function buildProductFeed(products: FeedProduct[], base: string, now = new Date()): string {
  const eligible = products.filter((p) =>
    p.isActive && p.contentStatus === "VERIFIED" && p.category.isVisible &&
    p.images.some((image) => httpUrl(image.url, base)),
  );
  const categories = [...new Map(eligible.map((p) => [p.category.id, p.category])).values()];
  const categoryIds = new Map(categories.map((category, index) => [category.id, index + 1]));
  const offers = eligible.flatMap((product) => {
    const variants = product.variants.length ? product.variants : [null];
    return variants.flatMap((variant) => {
      const price = variant?.priceKopecks ?? product.priceKopecks;
      if (!Number.isSafeInteger(price) || price <= 0) return [];
      const id = variant ? `${product.id}:${variant.id}` : product.id;
      const available = !product.outOfStock && (variant?.stockQty ?? product.stockQty) > 0;
      const name = variant ? `${product.name} — ${variant.name}` : product.name;
      const url = new URL(`/product/${encodeURIComponent(product.slug)}`, base).toString();
      const pictures = product.images.map((image) => httpUrl(image.url, base))
        .filter((image): image is string => image !== null).slice(0, 10);
      return [
        `      <offer id="${xml(id)}" available="${available}">`,
        `        <url>${xml(url)}</url>`,
        `        <price>${(price / 100).toFixed(2)}</price>`,
        ...((!variant || variant.priceKopecks === null) && product.oldPriceKopecks && product.oldPriceKopecks > price
          ? [`        <oldprice>${(product.oldPriceKopecks / 100).toFixed(2)}</oldprice>`] : []),
        "        <currencyId>RUB</currencyId>",
        `        <categoryId>${categoryIds.get(product.category.id)}</categoryId>`,
        ...pictures.map((picture) => `        <picture>${xml(picture)}</picture>`),
        `        <name>${xml(name)}</name>`,
        `        <description>${xml(product.summary ?? product.description ?? product.name)}</description>`,
        "      </offer>",
      ];
    });
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<yml_catalog date="${now.toISOString().slice(0, 16).replace("T", " ")}">`,
    "  <shop>",
    `    <name>${xml(SITE.name)}</name>`,
    `    <company>${xml(SITE.name)}</company>`,
    `    <url>${xml(new URL("/", base).toString())}</url>`,
    '    <currencies><currency id="RUB" rate="1"/></currencies>',
    "    <categories>",
    ...categories.map((category) => `      <category id="${categoryIds.get(category.id)}">${xml(category.name)}</category>`),
    "    </categories>",
    "    <offers>",
    ...offers,
    "    </offers>",
    "  </shop>",
    "</yml_catalog>",
  ].join("\n");
}
