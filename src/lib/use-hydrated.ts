"use client";

import { useEffect, useState } from "react";

/** true после монтирования на клиенте — чтобы не рассинхронить SSR с persist-хранилищами. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
