import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";
import { parseAttributes } from "@/lib/constants";
import { kopecksToRubles } from "@/lib/money";

export const metadata = { title: "Редактировать товар" };

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> К товарам
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-bold tracking-tight">Редактировать товар</h1>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryId: product.categoryId,
          description: product.description ?? "",
          priceRub: kopecksToRubles(product.priceKopecks),
          oldPriceRub: product.oldPriceKopecks ? kopecksToRubles(product.oldPriceKopecks) : null,
          stockQty: product.stockQty,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          badge: product.badge ?? "",
          variantLabel: product.variantLabel ?? "",
          attributes: parseAttributes(product.attributes),
          images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
          variants: product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            priceRub: v.priceKopecks ? String(kopecksToRubles(v.priceKopecks)) : "",
            stockQty: v.stockQty,
            sku: v.sku ?? "",
          })),
        }}
      />
    </div>
  );
}
