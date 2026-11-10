"use client";

import { useEffect } from "react";
import { METRICA_READY_EVENT, trackGoal } from "@/lib/analytics";

// Цель «order» в Яндекс.Метрике — срабатывает один раз на заказ
// (защита от повторов через sessionStorage: перезагрузки/поллинг не дублируют).
export function OrderGoal({ orderNumber }: { orderNumber: number }) {
  useEffect(() => {
    let sent = false;
    function send() {
      if (!sent) sent = trackGoal("order", `ym-order-${orderNumber}`);
    }
    // Согласие может появиться спустя любое время после открытия заказа.
    window.addEventListener(METRICA_READY_EVENT, send);
    send();
    return () => window.removeEventListener(METRICA_READY_EVENT, send);
  }, [orderNumber]);

  return null;
}
