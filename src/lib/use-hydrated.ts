"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true после монтирования на клиенте — чтобы не рассинхронить SSR с persist-хранилищами. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
