"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    ym?: (id: number, action: string, goal: string) => void;
  }
}

// Цель «order» в Яндекс.Метрике — срабатывает один раз на заказ
// (защита от повторов через sessionStorage: перезагрузки/поллинг не дублируют).
export function OrderGoal({ orderNumber }: { orderNumber: number }) {
  useEffect(() => {
    const id = Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID);
    if (!id) return;
    const key = `ym-order-${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // приватный режим — шлём без защиты от повтора
    }
    // Метрика может грузиться позже страницы — пробуем с небольшими повторами
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      if (typeof window.ym === "function") {
        window.ym(id, "reachGoal", "order");
        clearInterval(t);
      } else if (attempts > 10) {
        clearInterval(t);
      }
    }, 500);
    return () => clearInterval(t);
  }, [orderNumber]);

  return null;
}
