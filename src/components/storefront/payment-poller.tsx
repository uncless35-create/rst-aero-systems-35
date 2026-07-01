"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Пока оплата в процессе — обновляем страницу каждые 3с (до 10 раз),
 * чтобы поймать подтверждение от вебхука ЮKassa.
 */
export function PaymentPoller({ pollable }: { pollable: boolean }) {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!pollable) return;
    const id = setInterval(() => {
      attempts.current += 1;
      if (attempts.current > 10) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [pollable, router]);

  return null;
}
