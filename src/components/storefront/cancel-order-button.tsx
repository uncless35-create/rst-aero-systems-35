"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelMyOrder } from "@/actions/orders";

/** Отмена заказа покупателем: кнопка → подтверждение → отмена. */
export function CancelOrderButton({ orderNumber }: { orderNumber: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await cancelMyOrder(orderNumber);
      if (result.ok) {
        toast.success(`Заказ №${orderNumber} отменён`);
        router.refresh();
      } else {
        toast.error(result.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Отменить заказ
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Точно отменить заказ?</span>
      <Button variant="destructive" size="sm" onClick={cancel} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Да, отменить
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Нет
      </Button>
    </div>
  );
}
