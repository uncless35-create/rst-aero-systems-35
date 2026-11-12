import { prisma } from "@/lib/prisma";
import { buildGoogleFeed, feedLinkParams } from "@/lib/product-feed";

// Фид для Google Merchant Center. Метки по умолчанию: заказы с карточек Google подпишутся «Google».
export async function GET(request: Request) {
  const products = await prisma.product.findMany({
    where: { isActive: true, contentStatus: "VERIFIED", category: { isVisible: true } },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 10 },
      variants: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { id: "asc" },
  });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const params = new URL(request.url).searchParams;
  const linkParams = { utm_source: "google", utm_medium: "merchant", ...feedLinkParams(params) };
  return new Response(buildGoogleFeed(products, base, linkParams), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
