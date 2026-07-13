"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader, type ImageValue } from "@/components/admin/image-uploader";
import { createProduct, updateProduct } from "@/actions/admin/products";
import { rublesToKopecks } from "@/lib/money";

type CategoryOption = { id: string; name: string };

type VariantForm = { id?: string; name: string; priceRub: string; stockQty: number; sku: string };
type AttrForm = { name: string; value: string };
type SourceForm = {
  label: string;
  url: string;
  type: "OFFICIAL_PRODUCT" | "OFFICIAL_MANUAL" | "DISTRIBUTOR" | "OTHER";
};

export type ProductFormInitial = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  summary: string;
  exactVariant: string;
  compatibility: string;
  packageContents: string;
  contentStatus: "DRAFT" | "NEEDS_REVIEW" | "VERIFIED";
  contentReviewNote: string;
  sources: SourceForm[];
  priceRub: number;
  oldPriceRub: number | null;
  stockQty: number;
  weightGrams: number | null;
  isActive: boolean;
  outOfStock: boolean;
  isFeatured: boolean;
  badge: string;
  variantLabel: string;
  attributes: AttrForm[];
  images: ImageValue[];
  variants: VariantForm[];
};

export function ProductForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [exactVariant, setExactVariant] = useState(initial?.exactVariant ?? "");
  const [compatibility, setCompatibility] = useState(initial?.compatibility ?? "");
  const [packageContents, setPackageContents] = useState(initial?.packageContents ?? "");
  const [contentStatus, setContentStatus] = useState<"DRAFT" | "NEEDS_REVIEW" | "VERIFIED">(initial?.contentStatus ?? "DRAFT");
  const [contentReviewNote, setContentReviewNote] = useState(initial?.contentReviewNote ?? "");
  const [sources, setSources] = useState<SourceForm[]>(initial?.sources ?? []);
  const [priceRub, setPriceRub] = useState<string>(initial ? String(initial.priceRub) : "");
  const [oldPriceRub, setOldPriceRub] = useState<string>(
    initial?.oldPriceRub ? String(initial.oldPriceRub) : ""
  );
  const [stockQty, setStockQty] = useState<number>(initial?.stockQty ?? 0);
  const [weightGrams, setWeightGrams] = useState<string>(
    initial?.weightGrams != null ? String(initial.weightGrams) : ""
  );
  const [badge, setBadge] = useState(initial?.badge ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);
  const [outOfStock, setOutOfStock] = useState(initial?.outOfStock ?? false);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [variantLabel, setVariantLabel] = useState(initial?.variantLabel ?? "");
  const [attributes, setAttributes] = useState<AttrForm[]>(initial?.attributes ?? []);
  const [images, setImages] = useState<ImageValue[]>(initial?.images ?? []);
  const [variants, setVariants] = useState<VariantForm[]>(initial?.variants ?? []);

  async function submit() {
    if (!name.trim()) return toast.error("Укажите название");
    if (!categoryId) return toast.error("Выберите категорию");
    if (priceRub === "" || Number(priceRub) < 0) return toast.error("Укажите цену");

    setSaving(true);
    const payload = {
      name,
      slug,
      categoryId,
      description,
      summary,
      exactVariant,
      compatibility,
      packageContents,
      contentStatus,
      contentReviewNote,
      sources: sources.filter((source) => source.label.trim() && source.url.trim()),
      priceKopecks: rublesToKopecks(priceRub),
      oldPriceKopecks: oldPriceRub ? rublesToKopecks(oldPriceRub) : null,
      stockQty,
      weightGrams: weightGrams.trim() === "" ? null : Number(weightGrams),
      isActive,
      outOfStock,
      isFeatured,
      badge,
      variantLabel,
      attributes: attributes.filter((a) => a.name.trim() && a.value.trim()),
      images,
      variants: variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          id: v.id,
          name: v.name,
          priceKopecks: v.priceRub ? rublesToKopecks(v.priceRub) : null,
          stockQty: v.stockQty,
          sku: v.sku || null,
        })),
    };

    try {
      const res = initial
        ? await updateProduct(initial.id, payload)
        : await createProduct(payload);

      if (res.ok) {
        toast.success(initial ? "Товар обновлён" : "Товар создан");
        router.push("/admin/products");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Не удалось сохранить товар");
    } finally {
      setSaving(false);
    }
  }

  const card = "rounded-3xl bg-background p-5 space-y-4";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Основное */}
        <section className={card}>
          <h2 className="font-semibold">Основное</h2>
          <div className="space-y-2">
            <Label htmlFor="p-name">Название</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-slug">Адрес (slug)</Label>
            <Input id="p-slug" value={slug} placeholder="авто из названия" onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-summary">Краткое описание</Label>
            <Textarea id="p-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Что это за товар и кому он подходит" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-version">Точная версия</Label>
            <Input id="p-version" value={exactVariant} onChange={(e) => setExactVariant(e.target.value)} placeholder="Напр. ELRS 2.4G, DJI O4 Pro, 6S" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Описание</Label>
            <Textarea id="p-desc" rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-compat">Совместимость и что потребуется</Label>
            <Textarea id="p-compat" rows={5} value={compatibility} onChange={(e) => setCompatibility(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-package">Комплектация</Label>
            <Textarea id="p-package" rows={5} value={packageContents} onChange={(e) => setPackageContents(e.target.value)} />
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Источники и проверка</h2>
            <Button type="button" variant="surface" size="sm" onClick={() => setSources([...sources, { label: "", url: "", type: "OFFICIAL_PRODUCT" }])} className="gap-1">
              <Plus className="size-4" /> Добавить
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-content-status">Статус информации</Label>
            <select id="p-content-status" value={contentStatus} onChange={(event) => setContentStatus(event.target.value as typeof contentStatus)} className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm">
              <option value="DRAFT">Черновик</option>
              <option value="NEEDS_REVIEW">Нужно подтвердить версию</option>
              <option value="VERIFIED">Проверено</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-content-note">Что нужно проверить</Label>
            <Textarea id="p-content-note" rows={3} value={contentReviewNote} onChange={(event) => setContentReviewNote(event.target.value)} placeholder="Внутренняя заметка — покупатель её не видит" />
          </div>
          {sources.map((source, index) => (
            <div key={index} className="grid gap-2 rounded-2xl bg-surface p-3 sm:grid-cols-[1fr_140px_40px]">
              <div className="space-y-2">
                <Input placeholder="Название источника" value={source.label} onChange={(event) => setSources(sources.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
                <Input placeholder="https://…" value={source.url} onChange={(event) => setSources(sources.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} />
              </div>
              <select value={source.type} onChange={(event) => setSources(sources.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as SourceForm["type"] } : item))} className="h-12 rounded-2xl border border-input bg-background px-3 text-xs">
                <option value="OFFICIAL_PRODUCT">Официальный товар</option>
                <option value="OFFICIAL_MANUAL">Инструкция</option>
                <option value="DISTRIBUTOR">Дистрибьютор</option>
                <option value="OTHER">Другой</option>
              </select>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSources(sources.filter((_, itemIndex) => itemIndex !== index))}><X className="size-4" /></Button>
            </div>
          ))}
        </section>

        {/* Фото */}
        <section className={card}>
          <h2 className="font-semibold">Фотографии</h2>
          <ImageUploader value={images} onChange={setImages} />
        </section>

        {/* Характеристики */}
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Характеристики</h2>
            <Button type="button" variant="surface" size="sm" onClick={() => setAttributes([...attributes, { name: "", value: "" }])} className="gap-1">
              <Plus className="size-4" /> Добавить
            </Button>
          </div>
          {attributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Например: Вес — 480 г</p>
          ) : (
            <div className="space-y-2">
              {attributes.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Название" value={a.name} onChange={(e) => setAttributes(attributes.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} />
                  <Input placeholder="Значение" value={a.value} onChange={(e) => setAttributes(attributes.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setAttributes(attributes.filter((_, idx) => idx !== i))}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Варианты */}
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Варианты</h2>
            <Button type="button" variant="surface" size="sm" onClick={() => setVariants([...variants, { name: "", priceRub: "", stockQty: 0, sku: "" }])} className="gap-1">
              <Plus className="size-4" /> Добавить
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-vlabel">Название группы вариантов</Label>
            <Input id="p-vlabel" value={variantLabel} placeholder="напр. Цвет / Частота" onChange={(e) => setVariantLabel(e.target.value)} />
          </div>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Без вариантов товар продаётся как есть. Добавьте, если нужен выбор (цвет, частота и т.п.).</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_90px_70px_40px] gap-2 px-1 text-xs text-muted-foreground">
                <span>Название</span><span>Цена, ₽</span><span>Остаток</span><span></span>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_70px_40px] gap-2">
                  <Input placeholder="Чёрный" value={v.name} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} />
                  <Input type="number" placeholder="—" value={v.priceRub} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, priceRub: e.target.value } : x)))} />
                  <Input type="number" value={v.stockQty} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, stockQty: Number(e.target.value) } : x)))} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Пустая цена варианта = основная цена товара.</p>
            </div>
          )}
        </section>
      </div>

      {/* Правая колонка */}
      <div className="space-y-6">
        <section className={card}>
          <h2 className="font-semibold">Цена и наличие</h2>
          <div className="space-y-2">
            <Label htmlFor="p-price">Цена, ₽</Label>
            <Input id="p-price" type="number" min={0} value={priceRub} onChange={(e) => setPriceRub(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-oldprice">Старая цена, ₽ (для скидки)</Label>
            <Input id="p-oldprice" type="number" min={0} value={oldPriceRub} onChange={(e) => setOldPriceRub(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-stock">Остаток, шт</Label>
            <Input id="p-stock" type="number" min={0} value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">Если есть варианты, учитывается остаток вариантов.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-weight">Вес, г (для расчёта доставки СДЭК)</Label>
            <Input id="p-weight" type="number" min={0} placeholder="напр. 300" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} />
            <p className="text-xs text-muted-foreground">Вес с упаковкой. Если пусто — берётся значение по умолчанию.</p>
          </div>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Параметры</h2>
          <div className="space-y-2">
            <Label htmlFor="p-cat">Категория</Label>
            <select
              id="p-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-badge">Бейдж</Label>
            <Input id="p-badge" value={badge} placeholder="напр. Хит продаж" onChange={(e) => setBadge(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <Label htmlFor="p-active">Активен (в продаже)</Label>
            <Switch id="p-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <div>
              <Label htmlFor="p-oos">Временно нет в наличии</Label>
              <p className="text-xs text-muted-foreground">Товар остаётся виден, но купить нельзя</p>
            </div>
            <Switch id="p-oos" checked={outOfStock} onCheckedChange={setOutOfStock} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <Label htmlFor="p-featured">В «Рекомендуем» на главной</Label>
            <Switch id="p-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>
        </section>

        <div className="flex gap-2">
          <Button onClick={submit} disabled={saving} size="lg" className="flex-1">
            {saving ? <Loader2 className="size-5 animate-spin" /> : "Сохранить"}
          </Button>
          <Button variant="surface" size="lg" onClick={() => router.push("/admin/products")}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
