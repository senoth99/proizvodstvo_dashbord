"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductionItem } from "@/lib/server/store";
import { Empty, Input, Segmented } from "./ui";
import { fmtNumber } from "@/lib/format";

type Mode = "grid" | "list";
type Sort = "qty" | "name";

interface ApiState {
  items: ProductionItem[];
  lastPostAt: string | null;
}

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "3XL",
  "4XL",
  "5XL",
  "ONE SIZE",
  "OS",
];

function sizeRank(s?: string): number {
  if (!s) return 99999;
  const norm = s.toUpperCase().trim();
  const idx = SIZE_ORDER.indexOf(norm);
  if (idx >= 0) return idx;
  const num = parseFloat(norm);
  if (Number.isFinite(num)) return 1000 + num;
  return 5000;
}

function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

interface SizeBucket {
  size?: string;
  qty: number;
  ids: string[];
}

interface Group {
  key: string;
  name: string;
  imageUrl: string | null;
  matchedSlug: string | null;
  totalQty: number;
  ids: string[];
  sizes: SizeBucket[];
}

function groupItems(items: ProductionItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const groupKey =
      it.matchedSlug || normalizeKey(it.matchedName ?? it.name) || it.id;
    let g = map.get(groupKey);
    if (!g) {
      g = {
        key: groupKey,
        name: it.matchedName || it.name,
        imageUrl: it.imageUrl ?? null,
        matchedSlug: it.matchedSlug ?? null,
        totalQty: 0,
        ids: [],
        sizes: [],
      };
      map.set(groupKey, g);
    }
    if (!g.imageUrl && it.imageUrl) g.imageUrl = it.imageUrl;
    if (it.matchedName && (!g.matchedSlug || g.name === it.name)) {
      g.name = it.matchedName;
    }
    g.totalQty += it.qty;
    g.ids.push(it.id);
    const sizeRaw = (it.size ?? "").trim();
    const sizeKey = sizeRaw || "";
    let bucket = g.sizes.find((s) => (s.size ?? "") === sizeKey);
    if (!bucket) {
      bucket = { size: sizeRaw || undefined, qty: 0, ids: [] };
      g.sizes.push(bucket);
    }
    bucket.qty += it.qty;
    bucket.ids.push(it.id);
  }
  for (const g of map.values()) {
    g.sizes.sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
  }
  return Array.from(map.values());
}

function sortGroups(groups: Group[], sort: Sort): Group[] {
  const arr = [...groups];
  if (sort === "qty") {
    arr.sort((a, b) => {
      if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
      return a.name.localeCompare(b.name, "ru");
    });
  } else {
    arr.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  return arr;
}

export function ProductionTab() {
  const [data, setData] = useState<ApiState>({ items: [], lastPostAt: null });
  const [mode, setMode] = useState<Mode>("grid");
  const [sort, setSort] = useState<Sort>("qty");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    let nextData: ApiState | null = null;
    let nextError: string | null = null;
    try {
      const res = await fetch("/api/production", { cache: "no-store" });
      const json = await res.json();
      nextData = {
        items: Array.isArray(json.items) ? json.items : [],
        lastPostAt: json.lastPostAt ?? null,
      };
    } catch (e) {
      nextError = e instanceof Error ? e.message : "Ошибка запроса";
    }
    if (nextData) setData(nextData);
    setError(nextError);
  }, []);

  useEffect(() => {
    const tick = () => {
      void refresh();
    };
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const allGroups = useMemo(() => groupItems(data.items), [data.items]);
  const totalUnits = useMemo(
    () => data.items.reduce((s, i) => s + i.qty, 0),
    [data.items]
  );

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allGroups.filter((g) => g.name.toLowerCase().includes(q))
      : allGroups;
    return sortGroups(filtered, sort);
  }, [allGroups, query, sort]);

  const visibleUnits = useMemo(
    () => visibleGroups.reduce((s, g) => s + g.totalQty, 0),
    [visibleGroups]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "grid", label: "Сетка", icon: <GridIcon /> },
            { value: "list", label: "Список", icon: <ListIcon /> },
          ]}
        />
        <Segmented<Sort>
          value={sort}
          onChange={setSort}
          options={[
            { value: "qty", label: "По кол-ву" },
            { value: "name", label: "По названию" },
          ]}
        />
        <Input
          placeholder="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-72"
        />
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] w-full">
          Товаров:{" "}
          <strong className="text-[var(--color-foreground)] tabular-nums">
            {fmtNumber(visibleGroups.length, 0)}
          </strong>
          {visibleGroups.length !== allGroups.length && (
            <>
              {" / "}
              <span className="tabular-nums">
                {fmtNumber(allGroups.length, 0)}
              </span>
            </>
          )}{" "}
          · Единиц:{" "}
          <strong className="text-[var(--color-foreground)] tabular-nums">
            {fmtNumber(visibleUnits, 0)}
          </strong>
          {visibleUnits !== totalUnits && (
            <>
              {" / "}
              <span className="tabular-nums">
                {fmtNumber(totalUnits, 0)}
              </span>
            </>
          )}
        </span>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-foreground)] opacity-70">
          {error}
        </div>
      )}

      {allGroups.length === 0 ? (
        <Empty>Очередь пуста. Ждём POST.</Empty>
      ) : visibleGroups.length === 0 ? (
        <Empty>Ничего не найдено по запросу «{query}».</Empty>
      ) : mode === "grid" ? (
        <GridView groups={visibleGroups} />
      ) : (
        <ListView groups={visibleGroups} />
      )}
    </div>
  );
}

function GridView({ groups }: { groups: Group[] }) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
      {groups.map((g) => (
        <li
          key={g.key}
          className="bg-[var(--color-surface)] overflow-hidden flex flex-col"
        >
          <div className="relative aspect-square bg-black/40">
            {g.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={g.imageUrl}
                alt={g.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)] text-xs uppercase tracking-[0.18em]">
                нет фото
              </div>
            )}
            <div className="absolute bottom-2 right-2 z-[1]">
              <span className="inline-flex items-center px-3 h-9 bg-[var(--color-accent)] text-[var(--color-foreground)] text-sm font-light tabular-nums tracking-wider">
                ×{fmtNumber(g.totalQty, 0)}
              </span>
            </div>
          </div>
          <div className="p-3 flex flex-col gap-2">
            <div
              className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]"
              title={g.name}
            >
              {g.name}
            </div>
            <SizeChips sizes={g.sizes} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListView({ groups }: { groups: Group[] }) {
  return (
    <ul className="flex flex-col">
      {groups.map((g) => (
        <li
          key={g.key}
          className="flex items-center gap-3 py-3 first:pt-0"
        >
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{g.name}</div>
            <SizeChips sizes={g.sizes} className="mt-1" />
          </div>
          <span className="inline-flex items-center px-3 h-9 bg-[var(--color-accent)] text-[var(--color-foreground)] text-sm font-light tabular-nums tracking-wider">
            ×{fmtNumber(g.totalQty, 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SizeChips({
  sizes,
  className = "",
}: {
  sizes: SizeBucket[];
  className?: string;
}) {
  if (!sizes.length) return null;
  return (
    <div className={"flex flex-wrap gap-1.5 " + className}>
      {sizes.map((s, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-light uppercase tracking-[0.18em] bg-[var(--color-surface)] text-[var(--color-foreground)]"
          title={s.size ? `Размер ${s.size}` : "Размер не указан"}
        >
          <span className="text-[var(--color-muted)]">{s.size ?? "—"}</span>
          <span className="tabular-nums text-[var(--color-foreground)]">
            {fmtNumber(s.qty, 0)}
          </span>
        </span>
      ))}
    </div>
  );
}

function GridIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
