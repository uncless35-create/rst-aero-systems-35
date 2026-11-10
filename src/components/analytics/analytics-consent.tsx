"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { YandexMetrica } from "@/components/analytics/yandex-metrica";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";
import { ANALYTICS_CONSENT_KEY } from "@/lib/analytics";

type Consent = "loading" | "pending" | "accepted" | "declined";

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      } catch { /* При недоступном хранилище аналитику не запускаем. */ }
      const [version, choice] = stored?.split(":") ?? [];
      setConsent(
        version === PRIVACY_POLICY_VERSION && (choice === "accepted" || choice === "declined")
          ? choice
          : "pending",
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function choose(value: "accepted" | "declined") {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, `${PRIVACY_POLICY_VERSION}:${value}`);
    } catch { /* Выбор не должен мешать работе магазина. */ }
    setConsent(value);
  }

  return (
    <>
      {consent === "accepted" ? <Suspense fallback={null}><YandexMetrica /></Suspense> : null}
      {consent === "pending" ? (
        <aside
          aria-label="Настройки аналитики"
          className="fixed inset-x-3 bottom-24 z-[80] mx-auto max-w-2xl rounded-3xl border border-border bg-background p-5 shadow-2xl md:bottom-5"
        >
          <p className="font-semibold">Можно использовать аналитику?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            С вашего согласия Яндекс Метрика поможет понять, какие страницы удобны
            посетителям. Магазин работает и при отказе. Подробнее — в{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              политике конфиденциальности
            </Link>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => choose("accepted")}>
              Разрешить
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => choose("declined")}>
              Отказаться
            </Button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
