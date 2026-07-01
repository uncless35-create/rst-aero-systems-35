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

const formSchema = checkoutSchema.omit({ items: true });
type FormValues = z.infer<typeof formSchema>;

export type DeliveryOption = {
  id: string;
  name: string;
  description: string | null;
  priceKopecks: number;
  requiresAddress: boolean;
};

export function CheckoutForm({ deliveryMethods }: { deliveryMethods: DeliveryOption[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const [submitting, setSubmitting] = useState(false);

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

  const itemsTotal = items.reduce((s, i) => s + i.priceKopecks * i.quantity, 0);
  const deliveryPrice = selectedDelivery?.priceKopecks ?? 0;
  const total = itemsTotal + deliveryPrice;

  const summary = useMemo(() => items, [items]);

  async function onSubmit(values: FormValues) {
    if (items.length === 0) {
      toast.error("Корзина пуста");
      return;
    }
    setSubmitting(true);
    const result = await createOrder({
      ...values,
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
                  <input type="radio" value={d.id} {...register("deliveryMethodId")} className="size-4 accent-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  </div>
                </div>
                <span className="text-sm font-semibold">
                  {d.priceKopecks === 0 ? "Бесплатно" : formatRub(d.priceKopecks)}
                </span>
              </label>
            ))}
          </div>

          {selectedDelivery?.requiresAddress && (
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
              <span>{deliveryPrice === 0 ? "Бесплатно" : formatRub(deliveryPrice)}</span>
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
