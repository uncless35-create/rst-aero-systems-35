import { Truck, CreditCard, ShieldCheck, Headset } from "lucide-react";

const ITEMS = [
  { icon: Truck, title: "Доставка по России", text: "СДЭК и самовывоз в Новороссийске" },
  { icon: CreditCard, title: "Подтверждение заказа", text: "Менеджер согласует наличие и оплату" },
  { icon: ShieldCheck, title: "Проверенные карточки", text: "Версии и характеристики сверяем по источникам" },
  { icon: Headset, title: "Поддержка пилотов", text: "Поможем с выбором и настройкой" },
];

export function Benefits() {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.title} className="rounded-3xl bg-surface p-5">
            <div className="grid size-10 place-items-center rounded-full bg-background">
              <Icon className="size-5" />
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug">{it.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{it.text}</p>
          </div>
        );
      })}
    </section>
  );
}
