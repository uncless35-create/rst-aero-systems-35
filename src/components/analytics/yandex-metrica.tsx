"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { trackGoal, trackPageView } from "@/lib/analytics";

export function YandexMetrica() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const id = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;

  useEffect(() => {
    const sent = trackPageView(window.location.href, document.referrer);
    if (sent && pathname === "/checkout") trackGoal("checkout_start");
  }, [pathname, query]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a");
      if (!link) return;
      if (link.protocol === "mailto:") trackGoal("contact_email");
      else if (link.protocol === "tel:") trackGoal("contact_phone");
      else if (["t.me", "telegram.me"].includes(link.hostname)) trackGoal("contact_telegram");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!id || !/^\d+$/.test(id)) return null;
  return <Script id="yandex-metrica-tag" src="https://mc.yandex.ru/metrika/tag.js" strategy="afterInteractive" />;
}
