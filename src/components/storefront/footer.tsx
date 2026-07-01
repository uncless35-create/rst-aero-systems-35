import Link from "next/link";
import { SITE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-bold tracking-tight">RST AERO SYSTEMS</p>
          <p className="mt-2 text-sm text-muted-foreground">{SITE.tagline}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Магазин</p>
          <Link href="/catalog" className="block text-muted-foreground hover:text-foreground">Каталог</Link>
          <Link href="/favorites" className="block text-muted-foreground hover:text-foreground">Избранное</Link>
          <Link href="/cart" className="block text-muted-foreground hover:text-foreground">Корзина</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Информация</p>
          <Link href="/about" className="block text-muted-foreground hover:text-foreground">О компании</Link>
          <Link href="/delivery-payment" className="block text-muted-foreground hover:text-foreground">Доставка и оплата</Link>
          <Link href="/contacts" className="block text-muted-foreground hover:text-foreground">Контакты</Link>
          <Link href="/privacy" className="block text-muted-foreground hover:text-foreground">Политика конфиденциальности</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Контакты</p>
          <p className="text-muted-foreground">{SITE.phone}</p>
          <p className="text-muted-foreground">{SITE.email}</p>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} RST AERO SYSTEMS. Все права защищены.
      </div>
    </footer>
  );
}
