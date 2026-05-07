"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Empty, Input, Segmented } from "./ui";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { ProductBomModal } from "./ProductBomModal";

type Mode = "grid" | "list";

interface CatalogItem {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  imageUrl: string | null;
}

interface MergedItem {
  key: string;
  name: string;
  imageUrl: string | null;
  variantCount: number;
}

function canonicalName(name: string): string {
  return (name || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function normalizeKey(name: string): string {
  return canonicalName(name)
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mergeItems(items: CatalogItem[]): MergedItem[] {
  const map = new Map<string, MergedItem>();
  for (const it of items) {
    const display = canonicalName(it.name);
    const key = normalizeKey(it.name) || it.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: display || it.name,
        imageUrl: it.imageUrl,
        variantCount: 0,
      };
      map.set(key, g);
    }
    g.variantCount += 1;
    if (!g.imageUrl && it.imageUrl) g.imageUrl = it.imageUrl;
  }
  return Array.from(map.values());
}

export function ProductsTab() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [mode, setMode] = useState<Mode>("grid");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<MergedItem | null>(null);

  const catalogBoms = useStore((s) => s.catalogBoms);
  const catalogManualCosts = useStore((s) => s.catalogManualCosts);
  const catalogHidden = useStore((s) => s.catalogHidden);
  const materials = useStore((s) => s.materials);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async () => {
    let next: CatalogItem[] | null = null;
    let err: string | null = null;
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const json = await res.json();
      next = Array.isArray(json.items) ? json.items : [];
    } catch (e) {
      err = e instanceof Error ? e.message : "Ошибка загрузки";
    }
    if (next) setItems(next);
    setError(err);
  }, []);

  useEffect(() => {
    const tick = () => {
      void load();
    };
    tick();
  }, [load]);

  const merged = useMemo(() => mergeItems(items), [items]);

  const materialPriceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mat of materials) m[mat.id] = mat.pricePerUnit;
    return m;
  }, [materials]);

  const hiddenCount = useMemo(() => {
    let n = 0;
    for (const it of merged) if (catalogHidden?.[it.key]) n += 1;
    return n;
  }, [merged, catalogHidden]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = merged.filter((m) => {
      if (!showHidden && catalogHidden?.[m.key]) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q);
    });
    return [...base].sort((a, b) => {
      const aHidden = !!catalogHidden?.[a.key];
      const bHidden = !!catalogHidden?.[b.key];
      if (aHidden !== bHidden) return aHidden ? 1 : -1;
      const aConf = isConfigured(
        a.key,
        catalogBoms,
        catalogManualCosts,
        materialPriceMap
      );
      const bConf = isConfigured(
        b.key,
        catalogBoms,
        catalogManualCosts,
        materialPriceMap
      );
      if (aConf !== bConf) return aConf ? 1 : -1;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [
    merged,
    query,
    catalogBoms,
    catalogManualCosts,
    materialPriceMap,
    catalogHidden,
    showHidden,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "grid", label: "Сетка" },
            { value: "list", label: "Список" },
          ]}
        />
        <Input
          placeholder="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-3 ml-auto">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              title={
                showHidden
                  ? "Снова скрыть скрытые товары"
                  : "Показать скрытые товары"
              }
              style={{ fontSize: "10px", lineHeight: 1 }}
              className="grid bg-transparent border-0 p-0 m-0 cursor-pointer uppercase tracking-[0.18em] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors text-right"
            >
              <span
                className="whitespace-nowrap"
                style={{
                  gridRow: 1,
                  gridColumn: 1,
                  visibility: showHidden ? "hidden" : "visible",
                }}
              >
                Показать скрытые ({hiddenCount})
              </span>
              <span
                className="whitespace-nowrap"
                style={{
                  gridRow: 1,
                  gridColumn: 1,
                  visibility: showHidden ? "visible" : "hidden",
                }}
              >
                Скрыть скрытые
              </span>
            </button>
          )}
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Изделий:{" "}
            <strong className="text-[var(--color-foreground)] tabular-nums">
              {fmtNumber(filtered.length, 0)}
            </strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="text-sm text-[var(--color-foreground)] opacity-70">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Empty>Загружаю каталог cashercollection…</Empty>
      ) : filtered.length === 0 ? (
        <Empty>Ничего не найдено по запросу «{query}».</Empty>
      ) : mode === "grid" ? (
        <GridView
          items={filtered}
          boms={catalogBoms}
          manualCosts={catalogManualCosts}
          materialPrices={materialPriceMap}
          hidden={catalogHidden}
          onPick={(m) => setActive(m)}
        />
      ) : (
        <ListView
          items={filtered}
          boms={catalogBoms}
          manualCosts={catalogManualCosts}
          materialPrices={materialPriceMap}
          hidden={catalogHidden}
          onPick={(m) => setActive(m)}
        />
      )}

      <ProductBomModal
        open={!!active}
        onClose={() => setActive(null)}
        bomKey={active?.key ?? null}
        productName={active?.name ?? null}
        imageUrl={active?.imageUrl ?? null}
      />
    </div>
  );
}

type BomLineLike = { materialId?: string; qtyPerUnit?: number };
type BomMap = Record<string, unknown[]> | undefined;
type CostMap = Record<string, number> | undefined;
type PriceMap = Record<string, number>;

function isConfigured(
  key: string,
  boms: BomMap,
  manualCosts: CostMap,
  prices: PriceMap
): boolean {
  const lines = boms?.[key];
  if (Array.isArray(lines) && lines.length > 0 && bomCost(lines, prices) > 0) {
    return true;
  }
  const cost = manualCosts?.[key];
  return typeof cost === "number" && cost > 0;
}

function bomCost(lines: unknown, prices: PriceMap): number {
  if (!Array.isArray(lines)) return 0;
  let sum = 0;
  for (const raw of lines) {
    const l = raw as BomLineLike;
    const price = l?.materialId ? prices[l.materialId] : undefined;
    const qty = Number(l?.qtyPerUnit) || 0;
    if (typeof price === "number") sum += price * qty;
  }
  return sum;
}

function badgeFor(
  key: string,
  boms: BomMap,
  manualCosts: CostMap,
  prices: PriceMap
): { label: string; tone: "accent" | "warning" } {
  const lines = boms?.[key];
  if (Array.isArray(lines) && lines.length > 0) {
    const cost = bomCost(lines, prices);
    if (cost > 0) return { label: fmtMoney(cost), tone: "accent" };
  }
  const cost = manualCosts?.[key];
  if (typeof cost === "number" && cost > 0) {
    return { label: fmtMoney(cost), tone: "accent" };
  }
  return { label: "Не настроено", tone: "warning" };
}

function GridView({
  items,
  boms,
  manualCosts,
  materialPrices,
  hidden,
  onPick,
}: {
  items: MergedItem[];
  boms: BomMap;
  manualCosts: CostMap;
  materialPrices: PriceMap;
  hidden: Record<string, boolean> | undefined;
  onPick: (m: MergedItem) => void;
}) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
      {items.map((it) => {
        const badge = badgeFor(it.key, boms, manualCosts, materialPrices);
        const isHidden = !!hidden?.[it.key];
        return (
          <li key={it.key} className={isHidden ? "opacity-40" : ""}>
            <button
              type="button"
              onClick={() => onPick(it)}
              className="w-full text-left bg-[var(--color-surface)] hover:bg-[color-mix(in_srgb,white_8%,var(--color-background))] transition-colors overflow-hidden flex flex-col"
            >
              <div className="relative aspect-square bg-black/40">
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.imageUrl}
                    alt={it.name}
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
                <div className="absolute top-2 left-2 z-[1]">
                  <span
                    className={
                      "inline-flex items-center px-2 h-6 text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light tabular-nums " +
                      (badge.tone === "accent"
                        ? "bg-[var(--color-accent)]"
                        : "bg-[#d11a1a]")
                    }
                  >
                    {badge.label}
                  </span>
                </div>
                {isHidden && (
                  <div className="absolute top-2 right-2 z-[1]">
                    <span className="inline-flex items-center px-2 h-6 bg-[var(--color-background)] text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light">
                      Скрыто
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div
                  className="text-sm font-light leading-snug line-clamp-2 min-h-[2.5rem] tracking-wide"
                  title={it.name}
                >
                  {it.name}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ListView({
  items,
  boms,
  manualCosts,
  materialPrices,
  hidden,
  onPick,
}: {
  items: MergedItem[];
  boms: BomMap;
  manualCosts: CostMap;
  materialPrices: PriceMap;
  hidden: Record<string, boolean> | undefined;
  onPick: (m: MergedItem) => void;
}) {
  return (
    <ul className="flex flex-col">
      {items.map((it) => {
        const badge = badgeFor(it.key, boms, manualCosts, materialPrices);
        const isHidden = !!hidden?.[it.key];
        return (
          <li key={it.key} className={isHidden ? "opacity-40" : ""}>
            <button
              type="button"
              onClick={() => onPick(it)}
              className="w-full text-left flex items-center gap-3 py-3 px-1 -mx-1 hover:bg-[var(--color-surface)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-light truncate tracking-wide">
                  {it.name}
                </div>
              </div>
              {isHidden && (
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] font-light">
                  Скрыто
                </span>
              )}
              <span
                className={
                  "inline-flex items-center px-2 h-6 text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light tabular-nums " +
                  (badge.tone === "accent"
                    ? "bg-[var(--color-accent)]"
                    : "bg-[#d11a1a]")
                }
              >
                {badge.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
