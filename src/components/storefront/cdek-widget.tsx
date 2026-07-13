"use client";

import { useEffect, useRef, useState } from "react";
import { CDEK_TARIFFS } from "@/lib/cdek-options";

// Виджет СДЭК (карта ПВЗ + расчёт стоимости). Скрипт грузится с CDN,
// бэкенд-запросы идут через наш прокси /api/cdek (ключи СДЭК не попадают на клиент).
// Карта рендерится на Яндекс.Картах — нужен ключ NEXT_PUBLIC_YANDEX_MAPS_API_KEY.

const WIDGET_SRC = "https://cdn.jsdelivr.net/npm/@cdek-it/widget@3";

// Тарифы СДЭК: отгрузка со склада магазина.
// office — до пункта выдачи (склад-склад), door — курьером до двери (склад-дверь).
export type CdekSelection = {
  mode: "office" | "door";
  tariffCode: number;
  deliverySumKopecks: number;
  periodMin: number | null;
  periodMax: number | null;
  cityCode: number | null;
  cityName: string | null;
  pvzCode: string | null;
  address: string;
};

type CdekTariff = {
  tariff_code: number;
  tariff_name?: string;
  delivery_sum: number;
  period_min?: number;
  period_max?: number;
};

type CdekPoint = {
  code?: string;
  city_code?: number;
  city?: string;
  name?: string;
  address?: string;
  formatted?: string;
  location?: { address?: string; city_code?: number; city?: string };
};

type CdekWidgetInstance = { destroy?: () => void };

declare global {
  interface Window {
    CDEKWidget?: new (opts: Record<string, unknown>) => CdekWidgetInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.CDEKWidget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("cdek script error")));
      return;
    }
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.charset = "utf-8";
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("cdek script error")));
    document.body.appendChild(s);
  });
  void scriptPromise.catch(() => {
    scriptPromise = null;
  });
  return scriptPromise;
}

export function CdekWidget({
  weightGrams,
  onSelect,
}: {
  weightGrams: number;
  onSelect: (sel: CdekSelection | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<CdekWidgetInstance | null>(null);
  const onSelectRef = useRef(onSelect);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const fromCity = process.env.NEXT_PUBLIC_CDEK_FROM_CITY ?? "Москва";
  const weightKg = Math.max(0.1, Math.round(weightGrams) / 1000);

  useEffect(() => {
    if (!apiKey) return; // без ключа карт виджет не построить — покажем сообщение ниже
    let cancelled = false;

    loadWidgetScript()
      .then(() => {
        if (cancelled || !window.CDEKWidget || !rootRef.current) return;
        rootRef.current.id = rootRef.current.id || "cdek-map";

        instanceRef.current = new window.CDEKWidget({
          root: rootRef.current.id,
          apiKey,
          servicePath: "/api/cdek",
          from: fromCity,
          defaultLocation: fromCity,
          lang: "rus",
          currency: "RUB",
          tariffs: CDEK_TARIFFS,
          goods: [{ width: 20, height: 10, length: 20, weight: weightKg }],
          onChoose(mode: "office" | "door", tariff: CdekTariff, point: CdekPoint) {
            const cityCode =
              point?.city_code ?? point?.location?.city_code ?? null;
            const cityName = point?.city ?? point?.location?.city ?? null;
            const address =
              point?.address ||
              point?.location?.address ||
              point?.formatted ||
              point?.name ||
              "";
            onSelectRef.current({
              mode,
              tariffCode: tariff.tariff_code,
              deliverySumKopecks: Math.round((tariff.delivery_sum ?? 0) * 100),
              periodMin: tariff.period_min ?? null,
              periodMax: tariff.period_max ?? null,
              cityCode,
              cityName,
              pvzCode: mode === "office" ? point?.code ?? null : null,
              address,
            });
          },
        });
      })
      .catch((e) => {
        console.error("Виджет СДЭК не загрузился:", e);
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      try {
        instanceRef.current?.destroy?.();
      } catch {
        // ignore
      }
      instanceRef.current = null;
    };
    // Пересоздаём виджет при изменении веса корзины
  }, [apiKey, fromCity, retryKey, weightKg]);

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Карта пунктов выдачи временно недоступна. Укажите адрес доставки в комментарии
        к заказу — рассчитаем стоимость и свяжемся с вами.
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium">Не удалось загрузить карту СДЭК</p>
        <p className="mt-1 text-muted-foreground">
          Проверьте соединение и попробуйте ещё раз. Если карта остаётся недоступной,
          выберите самовывоз или напишите менеджеру в чат.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            setRetryKey((value) => value + 1);
          }}
          className="mt-3 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background"
        >
          Повторить загрузку
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={rootRef}
        id="cdek-map"
        className="h-[500px] w-full overflow-hidden rounded-2xl border border-border"
      />
    </div>
  );
}
