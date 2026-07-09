"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkoutSchema } from "@/lib/validation/checkout";
import { createOrder } from "@/actions/checkout";
import { useCartStore } from "@/stores/cart-store";
import { useHydrated } from "@/lib/use-hydrated";
import { formatRub } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CdekWidget, type CdekSelection } from "@/components/storefront/cdek-widget";

const formSchema = checkoutSchema.omit({ items: true });
type FormValues = z.infer<typeof formSchema>;

// Вес по умолчанию (г) для товаров без указанного веса — только для живой оценки в виджете;
// при создании заказа стоимость пересчитывается на сервере авторитетно.
const DEFAULT_WEIGHT_GRAMS = 500;

export type DeliveryOption = {
  id: string;
  name: string;
  description: string | null;
  priceKopecks: number;
  requiresAddress: boolean;
  provider: string | null;
};

export function CheckoutForm({
  deliveryMethods,
  cdekReady = false,
}: {
  deliveryMethods: DeliveryOption[];
  cdekReady?: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const [submitting, setSubmitting] = useState(false);
  const [cdek, setCdek] = useState<CdekSelection | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { deliveryMethodId: deliveryMethods[0]?.id ?? "" },
  });

  const selectedDeliveryId = watch("deliveryMethodId");
  const selectedDelivery = deliveryMethods.find((d) => d.id === selectedDeliveryId);
  // Виджет СДЭК включается только когда есть И ключ карт (клиент), И боевые ключи API СДЭК
  // (сервер, cdekReady). Иначе метод «СДЭК» работает как обычный (адрес + фиксированная цена) —
  // никакой битой карты на витрине, пока не подключены ключи.
  const cdekEnabled = cdekReady && !!process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const isCdek = selectedDelivery?.provider === "CDEK" && cdekEnabled;

  const cartWeightGrams = items.reduce(
    (s, i) => s + (i.weightGrams ?? DEFAULT_WEIGHT_GRAMS) * i.quantity,
    0
  );

  const itemsTotal = items.reduce((s, i) => s + i.priceKopecks * i.quantity, 0);
  const deliveryPrice = isCdek
    ? cdek?.deliverySumKopecks ?? 0
    : selectedDelivery?.priceKopecks ?? 0;
  const total = itemsTotal + deliveryPrice;

  // При смене способа доставки сбрасываем выбор пункта СДЭК
  function handleDeliveryChange() {
    setCdek(null);
  }

  const summary = useMemo(() => items, [items]);

  async function onSubmit(values: FormValues) {
    if (items.length === 0) {
      toast.error("Корзина пуста");
      return;
    }
    if (isCdek && !cdek) {
      toast.error("Выберите пункт выдачи или адрес на карте СДЭК");
      return;
    }
    setSubmitting(true);
    const result = await createOrder({
      ...values,
      // Для СДЭК адрес — из выбора на карте; иначе — из поля формы
      deliveryAddress: isCdek ? cdek?.address || "" : values.deliveryAddress,
      cdek: isCdek && cdek
        ? {
            mode: cdek.mode,
            tariffCode: cdek.tariffCode,
            cityCode: cdek.cityCode,
            pvzCode: cdek.pvzCode,
            deliverySumKopecks: cdek.deliverySumKopecks,
          }
        : undefined,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    });
    setSubmitting(false);

    if (result.ok) {
      clear();
      if (result.confirmationUrl) {
        // Переходим на защищённую страницу оплаты ЮKassa
        window.location.href = result.confirmationUrl;
        return;
      }
      toast.success("Заказ оформлен");
      router.push(`/order/${result.orderNumber}/success`);
    } else {
      toast.error(result.error);
    }
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="rounded-3xl bg-surface p-8 text-center">
        <p className="text-lg font-semibold">Корзина пуста</p>
        <p className="mt-1 text-sm text-muted-foreground">Добавьте товары перед оформлением.</p>
        <Button className="mt-4" onClick={() => router.push("/catalog")}>В каталог</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Данные покупателя */}
      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Контактные данные</h2>
          <div className="space-y-2">
            <Label htmlFor="customerName">Имя *</Label>
            <Input id="customerName" placeholder="Иван Иванов" {...register("customerName")} />
            {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Телефон *</Label>
              <Input id="customerPhone" placeholder="+7 900 000-00-00" {...register("customerPhone")} />
              {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input id="customerEmail" type="email" placeholder="mail@example.com" {...register("customerEmail")} />
              {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail.message}</p>}
            </div>
          </div>
        </section>

        {/* Доставка */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Доставка</h2>
          <div className="space-y-2">
            {deliveryMethods.map((d) => (
              <label
                key={d.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-colors",
                  selectedDeliveryId === d.id ? "border-primary bg-surface" : "border-border hover:bg-surface"
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    value={d.id}
                    {...register("deliveryMethodId", { onChange: handleDeliveryChange })}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  </div>
                </div>
                <span className="text-sm font-semibold">
                  {d.provider === "CDEK"
                    ? "по тарифу"
                    : d.priceKopecks === 0
                      ? "Бесплатно"
                      : formatRub(d.priceKopecks)}
                </span>
              </label>
            ))}
          </div>

          {/* СДЭК: карта пунктов выдачи с авторасчётом стоимости */}
          {isCdek && (
            <div className="space-y-3">
              <CdekWidget weightGrams={cartWeightGrams} onSelect={setCdek} />
              {cdek ? (
                <div className="rounded-2xl border border-primary bg-surface p-4 text-sm">
                  <p className="font-medium">
                    {cdek.mode === "office" ? "Пункт выдачи СДЭК" : "Курьером СДЭК"}
                  </p>
                  {cdek.address && (
                    <p className="mt-0.5 text-muted-foreground">{cdek.address}</p>
                  )}
                  <p className="mt-1 flex justify-between font-semibold">
                    <span>Доставка</span>
                    <span>{formatRub(cdek.deliverySumKopecks)}</span>
                  </p>
                  {(cdek.periodMin || cdek.periodMax) && (
                    <p className="text-xs text-muted-foreground">
                      Срок: {cdek.periodMin ?? "?"}–{cdek.periodMax ?? "?"} дн.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Выберите город и пункт выдачи на карте — стоимость посчитается автоматически.
                </p>
              )}
            </div>
          )}

          {!isCdek && selectedDelivery?.requiresAddress && (
            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Адрес доставки *</Label>
              <Textarea id="deliveryAddress" placeholder="Город, улица, дом, квартира, индекс" {...register("deliveryAddress")} />
            </div>
          )}
        </section>

        {/* Комментарий */}
        <section className="space-y-2">
          <Label htmlFor="comment">Комментарий к заказу</Label>
          <Textarea id="comment" placeholder="Пожелания по заказу (необязательно)" {...register("comment")} />
        </section>
      </div>

      {/* Итоги */}
      <div className="lg:sticky lg:top-20 lg:h-fit">
        <div className="rounded-3xl border border-border p-5">
          <h2 className="text-lg font-semibold">Ваш заказ</h2>
          <div className="mt-4 space-y-3">
            {hydrated &&
              summary.map((i) => (
                <div key={i.key} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="line-clamp-1">{i.name}</span>
                    <span className="text-muted-foreground">
                      {i.variantName ? `${i.variantName} · ` : ""}{i.quantity} шт
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatRub(i.priceKopecks * i.quantity)}</span>
                </div>
              ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Товары</span>
              <span>{formatRub(itemsTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Доставка</span>
              <span>
                {isCdek && !cdek
                  ? "рассчитается"
                  : deliveryPrice === 0
                    ? "Бесплатно"
                    : formatRub(deliveryPrice)}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>Итого</span>
              <span>{formatRub(total)}</span>
            </div>
          </div>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-5 animate-spin" /> : "Оформить заказ"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности.
          </p>
        </div>
      </div>
    </form>
  );
}
