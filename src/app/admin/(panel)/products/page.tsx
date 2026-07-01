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
      _count: { select: { variants: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader title="Товары" description={`Всего: ${products.length}`}>
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
          stockQty: p.stockQty,
          isActive: p.isActive,
          variantsCount: p._count.variants,
        }))}
      />
    </div>
  );
}
