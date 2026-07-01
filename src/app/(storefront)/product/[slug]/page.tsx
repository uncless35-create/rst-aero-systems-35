import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product-purchase-panel";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { Badge } from "@/components/ui/badge";
import { getProductBySlug } from "@/lib/queries";
import { parseAttributes } from "@/lib/constants";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Товар не найден" };
  return {
    title: product.name,
    description: product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const attributes = parseAttributes(product.attributes);
  const firstImage = product.images[0]?.url ?? null;
  const inStock = product.stockQty > 0 || product.variants.some((v) => v.stockQty > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/catalog" className="hover:text-foreground">Каталог</Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/catalog/${product.category.slug}`} className="hover:text-foreground">
          {product.category.name}
        </Link>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
          name={product.name}
        />

        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {product.badge ? <Badge variant="accent">{product.badge}</Badge> : null}
              <Badge variant="muted">{product.category.name}</Badge>
            </div>
            <FavoriteButton
              className="size-11 border border-border"
              item={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                priceKopecks: product.priceKopecks,
                oldPriceKopecks: product.oldPriceKopecks,
                badge: product.badge,
                image: firstImage,
                inStock,
                hasVariants: product.variants.length > 0,
              }}
            />
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">{product.name}</h1>

          <div className="mt-6">
            <ProductPurchasePanel
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                priceKopecks: product.priceKopecks,
                oldPriceKopecks: product.oldPriceKopecks,
                stockQty: product.stockQty,
                variantLabel: product.variantLabel,
                image: firstImage,
                variants: product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  priceKopecks: v.priceKopecks ?? product.priceKopecks,
                  stockQty: v.stockQty,
                })),
              }}
            />
          </div>

          {product.description ? (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="mb-2 text-sm font-semibold">Описание</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>
          ) : null}

          {attributes.length > 0 ? (
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="mb-3 text-sm font-semibold">Характеристики</h2>
              <dl className="divide-y divide-border">
                {attributes.map((a) => (
                  <div key={a.name} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-muted-foreground">{a.name}</dt>
                    <dd className="text-right font-medium">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
