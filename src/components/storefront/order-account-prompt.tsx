"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimGuestOrder } from "@/actions/orders";

type Props = {
  accessToken: string;
  orderNumber: number;
  /** guest — не вошёл; claim — вошёл, но заказ оформлен без входа. */
  mode: "guest" | "claim";
};

/** Гостевой заказ не виден в «Моих заказах», пока его не привязали к аккаунту. */
export function OrderAccountPrompt({ accessToken, orderNumber, mode }: Props) {
  const [claiming, setClaiming] = useState(false);
  const orderQuery = `?order=${encodeURIComponent(accessToken)}`;

  async function claim() {
    setClaiming(true);
    try {
      const res = await claimGuestOrder(accessToken);
      if (res.ok) {
        // Спиннер остаётся до загрузки «Моих заказов».
        window.location.assign("/account/orders");
        return;
      }
      toast.error(res.error);
    } catch {
      toast.error("Не удалось сохранить заказ. Повторите попытку.");
    }
    setClaiming(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Ссылка на заказ скопирована");
    } catch {
      toast.error("Не удалось скопировать — сохраните адрес страницы из браузера");
    }
  }

  if (mode === "claim") {
    return (
      <div className="mt-4 rounded-3xl border border-border p-5 text-sm">
        <p className="font-medium">Заказ оформлен без входа в аккаунт</p>
        <p className="mt-1 text-muted-foreground">
          Сохраните его, чтобы он отображался в разделе «Мои заказы».
        </p>
        <Button className="mt-4 w-full sm:w-auto" onClick={claim} disabled={claiming}>
          {claiming ? <Loader2 className="size-5 animate-spin" /> : "Сохранить в моих заказах"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-3xl border border-border p-5 text-sm">
      <p className="font-medium">Как следить за заказом</p>
      <p className="mt-1 text-muted-foreground">
        Вы оформили заказ без входа. Создайте аккаунт или войдите — заказ №{orderNumber} появится
        в разделе «Мои заказы». Статус также можно проверить по ссылке на эту страницу.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/register${orderQuery}`}>Создать аккаунт</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/login${orderQuery}`}>Войти</Link>
        </Button>
        <Button variant="ghost" onClick={copyLink}>
          <Link2 className="size-4" /> Скопировать ссылку
        </Button>
      </div>
    </div>
  );
}
