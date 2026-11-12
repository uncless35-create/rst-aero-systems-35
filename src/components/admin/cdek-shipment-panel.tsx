"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRub } from "@/lib/money";
import { createShipmentForOrder, syncShipmentFromCdek } from "@/actions/admin/cdek-shipment";

export function CdekShipmentPanel({
  orderId,
  uuid,
  trackNumber,
  cdekStatus,
  cashOnDeliveryKopecks,
}: {
  orderId: string;
  uuid: string | null;
  trackNumber: string | null;
  /** Последний статус отправления в СДЭК, уже подписанный (describeCdekStatus) */
  cdekStatus: string | null;
  /** Сколько СДЭК возьмёт с покупателя при получении; 0 — заказ оплачен заранее */
  cashOnDeliveryKopecks: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const r = await createShipmentForOrder(orderId);
    setLoading(false);
    if (r.ok) {
      toast.success("Отправление СДЭК создано");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  async function sync() {
    setLoading(true);
    const r = await syncShipmentFromCdek(orderId);
    setLoading(false);
    if (r.ok) {
      toast.success(r.cdekStatusName ? `СДЭК: ${r.cdekStatusName}` : "Данные СДЭК обновлены");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="mt-4 rounded-3xl bg-background p-5 text-sm">
      <p className="mb-2 font-semibold">Отправление СДЭК</p>
      <p className="mb-3 text-muted-foreground">
        {cashOnDeliveryKopecks > 0 ? (
          <>
            Наложенный платёж:{" "}
            <span className="font-semibold text-foreground">{formatRub(cashOnDeliveryKopecks)}</span> — СДЭК
            возьмёт с покупателя при получении (товары и доставка).
          </>
        ) : (
          "Заказ оплачен заранее — при получении покупатель ничего не платит."
        )}
      </p>
      {uuid ? (
        <div className="space-y-2 text-muted-foreground">
          {trackNumber ? (
            <p>
              Накладная: <span className="font-semibold text-foreground">{trackNumber}</span>
            </p>
          ) : (
            <p>Отправление создано, номер накладной готовится…</p>
          )}
          <p>
            Статус в СДЭК:{" "}
            <span className="font-medium text-foreground">{cdekStatus ?? "ещё не получен"}</span>
          </p>
          <p className="text-xs">
            Статус заказа меняется сам: «Отправлен» — когда посылку приняли в СДЭК, «В пункте выдачи», «Завершён» —
            после вручения.
          </p>
          <p className="break-all text-xs">UUID: {uuid}</p>
          <Button size="sm" variant="surface" onClick={sync} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Обновить из СДЭК
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={create} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
          Создать отправление СДЭК
        </Button>
      )}
    </div>
  );
}
