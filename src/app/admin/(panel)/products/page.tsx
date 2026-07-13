import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductsTable } from "@/components/admin/products-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Товары" };

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      variants: { select: { stockQty: true } },
    },
  });
  const verifiedCount = products.filter((product) => product.contentStatus === "VERIFIED").length;
  const reviewCount = products.filter((product) => product.contentStatus === "NEEDS_REVIEW").length;

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Товары" description={`Всего: ${products.length} · проверено: ${verifiedCount} · нужно сверить: ${reviewCount}`}>
        <Button asChild className="gap-2">
          <Link href="/admin/products/new">
            <Plus className="size-4" /> Добавить товар
          </Link>
        </Button>
      </AdminPageHeader>

      <ProductsTable
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          image: p.images[0]?.url ?? null,
          categoryName: p.category.name,
          priceKopecks: p.priceKopecks,
          stockQty: p.variants.length
            ? p.variants.reduce((sum, variant) => sum + variant.stockQty, 0)
            : p.stockQty,
          isActive: p.isActive,
          variantsCount: p.variants.length,
          contentStatus: p.contentStatus as "DRAFT" | "NEEDS_REVIEW" | "VERIFIED",
          contentReviewNote: p.contentReviewNote,
        }))}
      />
    </div>
  );
}
