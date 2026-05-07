"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ensureStateSync, useStore } from "@/lib/store";

const subscribe = (cb: () => void) => useStore.subscribe(cb);
const getSnapshot = () => useStore.getState()._hydrated;
const getServerSnapshot = () => false;

export function HydrationGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    ensureStateSync();
  }, []);
  const ready = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20 text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        Загружаю данные…
      </div>
    );
  }
  return <>{children}</>;
}
