import Link from "next/link";
import { AlertTriangle, Boxes, Building2, CreditCard, MessageCircle, Package, SearchCheck, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/storefront/status-badge";
import { formatRub } from "@/lib/money";
import { isTbankConfigured } from "@/lib/tbank";
import { isYookassaConfigured } from "@/lib/yookassa";

export const metadata = { title: "Дашборд" };

export default async function AdminDashboard() {
  const onlinePaymentConfigured = isTbankConfigured() || isYookassaConfigured();
  const [productsCount, categoriesCount, newOrders, stockProducts, recentOrders, reviewProducts, openChats, possiblePlaceholderStock, contactsContent] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count({ where: { status: "NEW" } }),
      prisma.product.findMany({
        where: { isActive: true, outOfStock: false },
        select: {
          id: true,
          name: true,
          stockQty: true,
          variants: { select: { stockQty: true } },
        },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { items: true },
      }),
      prisma.product.count({ where: { contentStatus: "NEEDS_REVIEW", isActive: true } }),
      prisma.chatConversation.count({ where: { status: "OPEN" } }),
      prisma.product.count({
        where: {
          isActive: true,
          stockQty: 10,
          variants: { none: {} },
        },
      }),
      prisma.siteContent.findUnique({
        where: { key: "contacts" },
        select: { body: true },
      }),
    ]);
  const sellerRequisitesMissing = !contactsContent?.body.match(/\bИНН\b/i);

  const lowStock = stockProducts
    .map((product) => ({
      ...product,
      effectiveStock: product.variants.length
        ? product.variants.reduce((sum, variant) => sum + variant.stockQty, 0)
        : product.stockQty,
    }))
    .filter((product) => product.effectiveStock <= 3)
    .sort((a, b) => a.effectiveStock - b.effectiveStock)
    .slice(0, 5);

  const stats = [
    { label: "Товары", value: productsCount, icon: Package, href: "/admin/products" },
    { label: "Категории", value: categoriesCount, icon: Boxes, href: "/admin/categories" },
    { label: "Новые заказы", value: newOrders, icon: ShoppingCart, href: "/admin/orders" },
    { label: "Открытые чаты", value: openChats, icon: MessageCircle, href: "/admin/chats" },
    { label: "Сверить карточки", value: reviewProducts, icon: SearchCheck, href: "/admin/products" },
    { label: "Заканчиваются", value: lowStock.length, icon: AlertTriangle, href: "/admin/products" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-3xl bg-background p-5 transition-colors hover:bg-background/70"
            >
              <Icon className="size-5 text-muted-foreground" />
              <p className="mt-3 text-3xl font-bold tracking-tight">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </Link>
          );
        })}
      </div>

      {reviewProducts > 0 || possiblePlaceholderStock > 0 || !onlinePaymentConfigured || sellerRequisitesMissing ? (
        <div className="space-y-3">
          {reviewProducts > 0 ? (
            <Link href="/admin/products" className="flex items-start gap-3 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
              <SearchCheck className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
              <span><strong>Нужно сверить {reviewProducts} карточек.</strong> Для них покупка заблокирована до проверки точной версии по маркировке на коробке или устройстве.</span>
            </Link>
          ) : null}
          {possiblePlaceholderStock > 0 ? (
            <Link href="/admin/products" className="flex items-start gap-3 rounded-3xl border border-orange-500/30 bg-orange-500/10 p-5 text-sm">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-700 dark:text-orange-300" />
              <span><strong>Проверьте складские остатки.</strong> У {possiblePlaceholderStock} активных товаров указано ровно 10 штук без вариантов — это похоже на техническое значение старого заполнения каталога.</span>
            </Link>
          ) : null}
          {!onlinePaymentConfigured ? (
            <div className="flex items-start gap-3 rounded-3xl border border-sky-500/30 bg-sky-500/10 p-5 text-sm">
              <CreditCard className="mt-0.5 size-5 shrink-0 text-sky-700 dark:text-sky-300" />
              <span><strong>Онлайн-оплата не подключена.</strong> Заказ создаётся без платёжной ссылки, после чего менеджеру нужно связаться с покупателем и согласовать оплату.</span>
            </div>
          ) : null}
          {sellerRequisitesMissing ? (
            <Link href="/admin/pages" className="flex items-start gap-3 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm">
              <Building2 className="mt-0.5 size-5 shrink-0 text-rose-700 dark:text-rose-300" />
              <span><strong>Не заполнены реквизиты продавца.</strong> Добавьте в «Контакты» полное наименование или ФИО и статус продавца, адрес, ИНН, а также ОГРН/ОГРНИП, если применимо.</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Последние заказы */}
        <div className="rounded-3xl bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Последние заказы</h2>
            <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
              Все
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Заказов пока нет</p>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface"
                >
                  <div>
                    <p className="text-sm font-medium">№{o.orderNumber} · {o.customerName}</p>
                    <p className="text-xs text-muted-foreground">{o.items.length} тов. · {formatRub(o.totalKopecks)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Заканчивающиеся товары */}
        <div className="rounded-3xl bg-background p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Заканчиваются</h2>
            <Link href="/admin/products" className="text-sm text-muted-foreground hover:text-foreground">
              Товары
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Всё в достатке</p>
          ) : (
            <div className="space-y-1">
              {lowStock.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}/edit`}
                  className="flex items-center justify-between rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface"
                >
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <span className="shrink-0 text-sm font-semibold text-destructive">{p.effectiveStock} шт</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
