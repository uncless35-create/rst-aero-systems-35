import { prisma } from "@/lib/prisma";
import { buildProductFeed } from "@/lib/product-feed";

export const revalidate = 300;

export async function GET() {
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
  return new Response(buildProductFeed(products, base), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
