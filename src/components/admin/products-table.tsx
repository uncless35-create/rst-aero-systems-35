"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatRub } from "@/lib/money";
import { toggleProductActive, deleteProduct } from "@/actions/admin/products";

export type ProductRow = {
  id: string;
  name: string;
  image: string | null;
  categoryName: string;
  priceKopecks: number;
  stockQty: number;
  isActive: boolean;
  variantsCount: number;
};

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();

  async function toggle(p: ProductRow, next: boolean) {
    await toggleProductActive(p.id, next);
    router.refresh();
  }

  async function remove(p: ProductRow) {
    if (!confirm(`Удалить товар «${p.name}»?`)) return;
    const res = await deleteProduct(p.id);
    if (res.ok) {
      toast.success("Товар удалён");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (products.length === 0) {
    return <p className="rounded-3xl bg-background p-8 text-center text-sm text-muted-foreground">Товаров пока нет</p>;
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-background">
      <div className="divide-y divide-border">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface">
              {p.image ? (
                <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground">
                  <ImageOff className="size-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.categoryName} · {formatRub(p.priceKopecks)}
                {p.variantsCount > 0 ? ` · вариантов: ${p.variantsCount}` : ""}
              </p>
            </div>

            <div className="hidden w-20 text-center text-sm sm:block">
              <span className={p.stockQty <= 3 ? "font-semibold text-destructive" : ""}>{p.stockQty} шт</span>
            </div>

            <Switch checked={p.isActive} onCheckedChange={(v) => toggle(p, v)} aria-label="Активность" />

            <Link href={`/admin/products/${p.id}/edit`} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground" aria-label="Редактировать">
              <Pencil className="size-4" />
            </Link>
            <button onClick={() => remove(p)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-destructive" aria-label="Удалить">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
