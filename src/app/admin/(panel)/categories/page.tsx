import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata = { title: "Категории" };

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader title="Категории" description="Управление категориями каталога" />
      <CategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          sortOrder: c.sortOrder,
          isVisible: c.isVisible,
          productCount: c._count.products,
        }))}
      />
    </div>
  );
}
