"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createShipmentForOrder,
  refreshShipmentNumber,
} from "@/actions/admin/cdek-shipment";

export function CdekShipmentPanel({
  orderId,
  uuid: initialUuid,
  trackNumber: initialTrack,
}: {
  orderId: string;
  uuid: string | null;
  trackNumber: string | null;
}) {
  const [uuid, setUuid] = useState(initialUuid);
  const [track, setTrack] = useState(initialTrack);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const r = await createShipmentForOrder(orderId);
    setLoading(false);
    if (r.ok) {
      setUuid(r.uuid);
      setTrack(r.trackNumber);
      toast.success("Отправление СДЭК создано");
    } else {
      toast.error(r.error);
    }
  }

  async function refresh() {
    setLoading(true);
    const r = await refreshShipmentNumber(orderId);
    setLoading(false);
    if (r.ok) {
      setTrack(r.trackNumber);
      toast.success(r.trackNumber ? "Номер накладной получен" : "Номер ещё готовится в СДЭК");
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="mt-4 rounded-3xl bg-background p-5 text-sm">
      <p className="mb-2 font-semibold">Отправление СДЭК</p>
      {uuid ? (
        <div className="space-y-2 text-muted-foreground">
          {track ? (
            <p>
              Накладная: <span className="font-semibold text-foreground">{track}</span>
            </p>
          ) : (
            <p>Отправление создано, номер накладной готовится…</p>
          )}
          <p className="break-all text-xs">UUID: {uuid}</p>
          {!track && (
            <Button size="sm" variant="surface" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Обновить номер
            </Button>
          )}
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
