"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { YandexMetrica } from "@/components/analytics/yandex-metrica";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacy";

const STORAGE_KEY = "rst-analytics-consent";

type Consent = "loading" | "pending" | "accepted" | "declined";

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Consent>("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, `${PRIVACY_POLICY_VERSION}:${value}`);
    setConsent(value);
  }

  return (
    <>
      {consent === "accepted" ? <YandexMetrica /> : null}
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
