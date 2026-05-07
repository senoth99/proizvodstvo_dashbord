"use client";

import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";

const subscribe = (cb: () => void) => useStore.persist.onFinishHydration(cb);
const getSnapshot = () => useStore.persist.hasHydrated();
const getServerSnapshot = () => false;

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[var(--color-muted)]">
        Загрузка данных…
      </div>
    );
  }
  return <>{children}</>;
}
