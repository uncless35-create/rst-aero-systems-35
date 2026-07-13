"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPurchasePanel } from "@/components/storefront/product-purchase-panel";
import { getQuickView, type QuickViewData } from "@/actions/quick-view";

export function QuickView({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<QuickViewData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || data || failed) return;
    let cancelled = false;
    getQuickView(slug)
      .then((result) => {
        if (cancelled) return;
        if (result) setData(result);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, slug, data, failed]);

  // Пока открыто и данные ещё не пришли — показываем загрузку
  const loading = open && !data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {failed ? (
          <div className="grid h-64 place-items-center px-6 text-center text-sm text-muted-foreground">
            Не удалось загрузить товар. Откройте его полную страницу или повторите позже.
          </div>
        ) : loading || !data ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <ProductGallery images={data.images} name={data.name} />
            </div>
            <div className="space-y-4">
              <DialogTitle className="text-xl font-bold leading-tight">{data.name}</DialogTitle>

              <ProductPurchasePanel
                product={{
                  id: data.id,
                  slug: data.slug,
                  name: data.name,
                  priceKopecks: data.priceKopecks,
                  oldPriceKopecks: data.oldPriceKopecks,
                  stockQty: data.stockQty,
                  outOfStock: data.outOfStock,
                  requiresConfirmation: data.contentStatus !== "VERIFIED",
                  variantLabel: data.variantLabel,
                  image: data.images[0]?.url ?? null,
                  weightGrams: data.weightGrams,
                  variants: data.variants,
                }}
              />

              {data.description && (
                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {data.description}
                </p>
              )}

              {data.attributes.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {data.attributes.slice(0, 5).map((a) => (
                    <div key={a.name} className="contents">
                      <dt className="text-muted-foreground">{a.name}</dt>
                      <dd className="text-right font-medium">{a.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <Link
                href={`/product/${data.slug}`}
                className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Подробнее о товаре →
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
