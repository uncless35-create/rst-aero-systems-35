import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product-purchase-panel";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { ProductGrid } from "@/components/storefront/product-grid";
import { Badge } from "@/components/ui/badge";
import { JsonLd, absoluteUrl, schemaPrice } from "@/components/seo/json-ld";
import { getProductBySlug, getRelatedProducts } from "@/lib/queries";
import { parseAttributes } from "@/lib/constants";

type Params = Promise<{ slug: string }>;

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Товар не найден" };
  const description = product.summary ?? product.description ?? undefined;
  const image = product.images[0];
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/product/${product.slug}`,
      images: image ? [{ url: image.url, alt: image.alt ?? product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const attributes = parseAttributes(product.attributes);
  const firstImage = product.images[0]?.url ?? null;
  const inStock = !product.outOfStock && (product.stockQty > 0 || product.variants.some((v) => v.stockQty > 0));
  const related = await getRelatedProducts(product.categoryId, product.id, 4);

  const url = absoluteUrl(`/product/${product.slug}`);
  const prices = product.variants.length
    ? product.variants.map((v) => v.priceKopecks ?? product.priceKopecks)
    : [product.priceKopecks];
  const availability = inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const offer =
    Math.min(...prices) === Math.max(...prices)
      ? { "@type": "Offer", price: schemaPrice(prices[0]), priceCurrency: "RUB", availability, url, itemCondition: "https://schema.org/NewCondition" }
      : { "@type": "AggregateOffer", lowPrice: schemaPrice(Math.min(...prices)), highPrice: schemaPrice(Math.max(...prices)), offerCount: prices.length, priceCurrency: "RUB", availability, url };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.summary ?? product.description ?? undefined,
          image: product.images.map((i) => absoluteUrl(i.url)),
          sku: product.slug,
          category: product.category.name,
          url,
          offers: offer,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Каталог", item: absoluteUrl("/catalog") },
            { "@type": "ListItem", position: 2, name: product.category.name, item: absoluteUrl(`/catalog/${product.category.slug}`) },
            { "@type": "ListItem", position: 3, name: product.name, item: url },
          ],
        }}
      />
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
                requiresConfirmation: product.contentStatus !== "VERIFIED",
              }}
            />
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">{product.name}</h1>

          {product.exactVariant ? (
            <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm">
              <span className="font-medium">Версия:</span> {product.exactVariant}
            </p>
          ) : null}

          {product.summary ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{product.summary}</p>
          ) : null}

          <div className="mt-6">
            <ProductPurchasePanel
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                priceKopecks: product.priceKopecks,
                oldPriceKopecks: product.oldPriceKopecks,
                stockQty: product.stockQty,
                outOfStock: product.outOfStock,
                variantLabel: product.variantLabel,
                image: firstImage,
                weightGrams: product.weightGrams,
                requiresConfirmation: product.contentStatus !== "VERIFIED",
                variants: product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  priceKopecks: v.priceKopecks ?? product.priceKopecks,
                  stockQty: v.stockQty,
                })),
              }}
            />
          </div>

        </div>
      </div>

      <div className="mx-auto mt-12 max-w-4xl space-y-10 border-t border-border pt-10">
        {product.description ? (
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Описание</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">{product.description}</p>
          </section>
        ) : null}

        {attributes.length > 0 ? (
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Характеристики</h2>
            <dl className="mt-4 divide-y divide-border rounded-3xl bg-surface px-5 sm:px-6">
              {attributes.map((attribute) => (
                <div key={attribute.name} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(180px,0.8fr)_1.2fr] sm:gap-8">
                  <dt className="text-muted-foreground">{attribute.name}</dt>
                  <dd className="font-medium sm:text-right">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {product.packageContents ? (
          <section className="rounded-3xl bg-surface p-6">
            <h2 className="text-base font-semibold tracking-tight">Что в комплекте</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{product.packageContents}</p>
          </section>
        ) : null}

        {product.compatibility ? (
          <section className="rounded-3xl bg-surface p-6">
            <h2 className="text-base font-semibold tracking-tight">Совместимость и что докупить</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{product.compatibility}</p>
          </section>
        ) : null}

      </div>

      {/* Похожие товары */}
      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-semibold tracking-tight">Похожие товары</h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  );
}
