import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryPills } from "@/components/storefront/category-pills";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Button } from "@/components/ui/button";
import {
  getVisibleCategories,
  getFeaturedProducts,
  getNewProducts,
} from "@/lib/queries";

export default async function HomePage() {
  const [categories, featured, fresh] = await Promise.all([
    getVisibleCategories(),
    getFeaturedProducts(8),
    getNewProducts(4),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Герой */}
      <section className="pt-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-16">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-accent">
              RST AERO SYSTEMS
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              FPV-дроны, тинивупы и всё для полёта
            </h1>
            <p className="mt-4 text-primary-foreground/70">
              Проверенное оборудование для пилотов любого уровня. Быстрая доставка
              по России, оплата картой и СБП.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/catalog">
                  В каталог <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/20 bg-transparent text-primary-foreground hover:bg-white/10">
                <Link href="/catalog/drony">Смотреть дроны</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Категории */}
      <section className="pt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Категории</h2>
          <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground">
            Все
          </Link>
        </div>
        <CategoryPills categories={categories} showAll={false} />
      </section>

      {/* Хиты */}
      {featured.length > 0 && (
        <section className="pt-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Хиты продаж</h2>
            <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground">
              Смотреть все
            </Link>
          </div>
          <ProductGrid products={featured} />
        </section>
      )}

      {/* Новинки */}
      {fresh.length > 0 && (
        <section className="pt-14">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Новинки</h2>
            <Link href="/catalog?sort=new" className="text-sm text-muted-foreground hover:text-foreground">
              Смотреть все
            </Link>
          </div>
          <ProductGrid products={fresh} />
        </section>
      )}
    </div>
  );
}
