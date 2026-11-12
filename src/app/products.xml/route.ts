import { prisma } from "@/lib/prisma";
import { buildProductFeed, feedLinkParams } from "@/lib/product-feed";

export const revalidate = 300;

// Для каждой площадки свой адрес фида с метками, например
// /products.xml?utm_source=yandex&utm_medium=products — заказы с неё подпишутся «Яндекс».
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
  return new Response(buildProductFeed(products, base, new Date(), feedLinkParams(new URL(request.url).searchParams)), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
