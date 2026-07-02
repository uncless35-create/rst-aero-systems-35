import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { isVisible: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticPaths: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/catalog", priority: 0.9 },
    { path: "/about", priority: 0.4 },
    { path: "/delivery-payment", priority: 0.5 },
    { path: "/contacts", priority: 0.4 },
    { path: "/privacy", priority: 0.2 },
  ];

  return [
    ...staticPaths.map((p) => ({
      url: `${BASE}${p.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: p.priority,
    })),
    ...categories.map((c) => ({
      url: `${BASE}/catalog/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: `${BASE}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
