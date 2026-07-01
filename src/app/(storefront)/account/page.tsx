import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ChevronRight, Mail, Phone } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/storefront/sign-out-button";

export const metadata: Metadata = { title: "Личный кабинет" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/account");

  const [user, ordersCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.order.count({ where: { userId: session.user.id } }),
  ]);
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Личный кабинет</h1>
        <SignOutButton />
      </div>

      <div className="mt-6 rounded-3xl bg-surface p-6">
        <p className="text-lg font-semibold">{user.name}</p>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Mail className="size-4" /> {user.email}
          </p>
          {user.phone && (
            <p className="flex items-center gap-2">
              <Phone className="size-4" /> {user.phone}
            </p>
          )}
        </div>
      </div>

      <Link
        href="/account/orders"
        className="mt-4 flex items-center justify-between rounded-3xl border border-border p-5 transition-colors hover:bg-surface"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full bg-surface">
            <Package className="size-5" />
          </div>
          <div>
            <p className="font-medium">Мои заказы</p>
            <p className="text-sm text-muted-foreground">
              {ordersCount > 0 ? `Заказов: ${ordersCount}` : "Пока нет заказов"}
            </p>
          </div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </div>
  );
}
