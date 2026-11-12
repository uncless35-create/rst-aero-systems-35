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

/** Производители каталога. Модели без бренда в названии узнаём по линейке. */
const VENDORS: Array<[RegExp, string]> = [
  [/\bbeta ?fpv\b|\bmeteor ?\d|\bair(65|75)\b|\bpavo ?\d|\bliteradio\b/i, "BETAFPV"],
  [/\bgeprc\b|\bcinelog\b|\bvapor [dx]\d/i, "GEPRC"],
  [/\baxisflying\b/i, "Axisflying"],
  [/\biflight\b|\bnazgul\b/i, "iFlight"],
  [/\bdji\b/i, "DJI"],
  [/\bradiomaster\b/i, "RadioMaster"],
  [/\bhappy ?model\b|\bmobula ?\d/i, "HappyModel"],
  [/\bspeedybee\b/i, "SpeedyBee"],
  [/\bmatek\b/i, "Matek"],
  [/\bcaddx\b/i, "Caddx"],
  [/\brush ?fpv\b/i, "RushFPV"],
  [/\bsologood\b/i, "SoloGood"],
  [/\bovonic\b/i, "Ovonic"],
  [/\btattu\b/i, "Tattu"],
  [/\bgnb\b/i, "GNB"],
  [/\blitokala\b/i, "Litokala"],
  [/\bvifly\b/i, "Vifly"],
  [/\btoolkit ?rc\b/i, "ToolkitRC"],
];

/**
 * Бренд по названию. В скобках — начинка («GEPRC Vapor X5 (DJI O4 Pro, ELRS)»), её не считаем.
 * В сборных комплектах несколько брендов — тогда бренд не указываем.
 */
export function detectVendor(name: string): string | null {
  const title = name.replace(/\([^)]*\)/g, " ");
  const found = new Set(VENDORS.filter(([re]) => re.test(title)).map(([, vendor]) => vendor));
  return found.size === 1 ? [...found][0] : null;
}

/** UTM-метки для ссылок фида: у каждой площадки свой адрес фида, заказы подписаны источником. */
export type FeedLinkParams = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign", string>>;

export function feedLinkParams(searchParams: URLSearchParams): FeedLinkParams {
  const params: FeedLinkParams = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"] as const) {
    const value = searchParams.get(key)?.trim();
    if (value && /^[a-zA-Z0-9_.-]{1,40}$/.test(value)) params[key] = value;
  }
  return params;
}

type Offer = {
  id: string;
  groupId: string;
  available: boolean;
  url: string;
  priceKopecks: number;
  oldPriceKopecks: number | null;
  categoryId: string;
  pictures: string[];
  name: string;
  vendor: string | null;
  description: string;
};

/** Общая выборка для фидов: только опубликованные, проверенные товары с фото и реальной ценой. */
function feedOffers(products: FeedProduct[], base: string, linkParams: FeedLinkParams): Offer[] {
  const eligible = products.filter((p) =>
    p.isActive && p.contentStatus === "VERIFIED" && p.category.isVisible &&
    p.images.some((image) => httpUrl(image.url, base)),
  );
  return eligible.flatMap((product) => {
    const variants = product.variants.length ? product.variants : [null];
    const productUrl = new URL(`/product/${encodeURIComponent(product.slug)}`, base);
    for (const [key, value] of Object.entries(linkParams)) productUrl.searchParams.set(key, value);
    const pictures = product.images.map((image) => httpUrl(image.url, base))
      .filter((image): image is string => image !== null).slice(0, 10);
    return variants.flatMap((variant): Offer[] => {
      const price = variant?.priceKopecks ?? product.priceKopecks;
      if (!Number.isSafeInteger(price) || price <= 0) return [];
      const ownPrice = !variant || variant.priceKopecks === null;
      return [{
        id: variant ? `${product.id}:${variant.id}` : product.id,
        groupId: product.id,
        available: !product.outOfStock && (variant?.stockQty ?? product.stockQty) > 0,
        url: productUrl.toString(),
        priceKopecks: price,
        oldPriceKopecks: ownPrice && product.oldPriceKopecks && product.oldPriceKopecks > price
          ? product.oldPriceKopecks : null,
        categoryId: product.category.id,
        pictures,
        name: variant ? `${product.name} — ${variant.name}` : product.name,
        vendor: detectVendor(product.name),
        description: product.summary ?? product.description ?? product.name,
      }];
    });
  });
}

const rub = (kopecks: number) => (kopecks / 100).toFixed(2);

/** YML для Яндекса (Вебмастер → Товары, Директ, Маркет). */
export function buildProductFeed(
  products: FeedProduct[],
  base: string,
  now = new Date(),
  linkParams: FeedLinkParams = {},
): string {
  const offers = feedOffers(products, base, linkParams);
  const categories = [...new Map(
    products.filter((p) => offers.some((o) => o.categoryId === p.category.id))
      .map((p) => [p.category.id, p.category]),
  ).values()];
  const categoryIds = new Map(categories.map((category, index) => [category.id, index + 1]));
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
    ...offers.flatMap((o) => [
      `      <offer id="${xml(o.id)}" available="${o.available}">`,
      `        <url>${xml(o.url)}</url>`,
      `        <price>${rub(o.priceKopecks)}</price>`,
      ...(o.oldPriceKopecks ? [`        <oldprice>${rub(o.oldPriceKopecks)}</oldprice>`] : []),
      "        <currencyId>RUB</currencyId>",
      `        <categoryId>${categoryIds.get(o.categoryId)}</categoryId>`,
      ...o.pictures.map((picture) => `        <picture>${xml(picture)}</picture>`),
      `        <name>${xml(o.name)}</name>`,
      ...(o.vendor ? [`        <vendor>${xml(o.vendor)}</vendor>`] : []),
      `        <description>${xml(o.description)}</description>`,
      "      </offer>",
    ]),
    "    </offers>",
    "  </shop>",
    "</yml_catalog>",
  ].join("\n");
}

/** RSS 2.0 для Google Merchant Center (бесплатные товарные карточки в Google). */
export function buildGoogleFeed(products: FeedProduct[], base: string, linkParams: FeedLinkParams = {}): string {
  const offers = feedOffers(products, base, linkParams);
  const tag = (name: string, value: string) => `      <g:${name}>${xml(value)}</g:${name}>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${xml(SITE.name)}</title>`,
    `    <link>${xml(new URL("/", base).toString())}</link>`,
    `    <description>${xml(SITE.name)}</description>`,
    ...offers.flatMap((o) => {
      const sale = o.oldPriceKopecks !== null;
      return [
        "    <item>",
        tag("id", o.id),
        ...(o.groupId !== o.id ? [tag("item_group_id", o.groupId)] : []),
        tag("title", o.name.slice(0, 150)),
        tag("description", o.description.slice(0, 5000)),
        tag("link", o.url),
        tag("image_link", o.pictures[0]),
        ...o.pictures.slice(1).map((picture) => tag("additional_image_link", picture)),
        tag("availability", o.available ? "in_stock" : "out_of_stock"),
        tag("price", `${rub(sale ? o.oldPriceKopecks! : o.priceKopecks)} RUB`),
        ...(sale ? [tag("sale_price", `${rub(o.priceKopecks)} RUB`)] : []),
        tag("condition", "new"),
        ...(o.vendor ? [tag("brand", o.vendor)] : []),
        // GTIN у нас нет; без бренда Google требует identifier_exists=no
        tag("identifier_exists", "no"),
        "    </item>",
      ];
    }),
    "  </channel>",
    "</rss>",
  ].join("\n");
}
