"use client";

import { useCallback, useEffect, useState } from "react";

interface ProductionHealth {
  lastPostAt: string | null;
}

interface CatalogHealth {
  fetchedAt: number;
  lastErrorAt: number | null;
  lastError: string | null;
  ok: boolean;
  size: number;
}

const HOUR_MS = 60 * 60 * 1000;

function fmtTime(
  ts: number | string | null | undefined,
  nowMs: number
): string {
  if (!ts) return "—";
  const date = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
  if (Number.isNaN(date.getTime())) return "—";
  const nowDate = new Date(nowMs);
  const sameDay =
    date.getFullYear() === nowDate.getFullYear() &&
    date.getMonth() === nowDate.getMonth() &&
    date.getDate() === nowDate.getDate();
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return time;
  const dm = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
  return `${dm} ${time}`;
}

export function HealthIndicators() {
  const [prod, setProd] = useState<ProductionHealth | null>(null);
  const [cat, setCat] = useState<CatalogHealth | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const load = useCallback(async () => {
    let nextProd: ProductionHealth | null = null;
    let nextCat: CatalogHealth | null = null;
    try {
      const r = await fetch("/api/production", { cache: "no-store" });
      const j = await r.json();
      nextProd = { lastPostAt: j.lastPostAt ?? null };
    } catch {
      nextProd = { lastPostAt: null };
    }
    try {
      const r = await fetch("/api/products", { cache: "no-store" });
      const j = await r.json();
      nextCat = {
        fetchedAt: Number(j.fetchedAt) || 0,
        lastErrorAt: j.lastErrorAt ?? null,
        lastError: j.lastError ?? null,
        ok: !!j.ok,
        size: Number(j.size) || 0,
      };
    } catch (e) {
      nextCat = {
        fetchedAt: 0,
        lastErrorAt: Date.now(),
        lastError: e instanceof Error ? e.message : "fetch failed",
        ok: false,
        size: 0,
      };
    }
    setProd(nextProd);
    setCat(nextCat);
  }, []);

  useEffect(() => {
    const tick = () => {
      void load();
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const prodAt = prod?.lastPostAt ? new Date(prod.lastPostAt).getTime() : 0;
  const prodOk = prodAt > 0 && now - prodAt < HOUR_MS;
  const prodTitle = prod
    ? prodAt
      ? prodOk
        ? "Вебхук получен меньше часа назад"
        : "Больше часа без новых данных"
      : "Вебхуков ещё не было"
    : "Загрузка…";

  const catOk = !!cat?.ok;
  const catTitle = cat
    ? catOk
      ? `Каталог синхронизирован, ${cat.size} позиций`
      : cat.lastError
        ? `Ошибка каталога: ${cat.lastError}`
        : "Каталог ещё не загружался"
    : "Загрузка…";

  return (
    <div className="flex items-center gap-3 sm:gap-5 px-1">
      <Indicator
        label="Вебхук"
        ok={prodOk}
        time={prod?.lastPostAt ?? null}
        now={now}
        title={prodTitle}
      />
      <Indicator
        label="Каталог"
        ok={catOk}
        time={cat?.fetchedAt ? cat.fetchedAt : null}
        now={now}
        title={catTitle}
      />
    </div>
  );
}

function Indicator({
  label,
  ok,
  time,
  now,
  title,
}: {
  label: string;
  ok: boolean;
  time: number | string | null;
  now: number;
  title: string;
}) {
  const color = ok
    ? "bg-[var(--color-accent)]"
    : "bg-[#d11a1a]";
  return (
    <div
      className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] font-light"
      title={title}
    >
      <span className={`inline-block w-2 h-2 ${color}`} />
      <span className="hidden sm:inline">{label}</span>
      <span className="text-[var(--color-foreground)] tabular-nums normal-case tracking-normal">
        {fmtTime(time, now)}
      </span>
    </div>
  );
}
