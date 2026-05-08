"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Material } from "@/lib/types";
import type { ProductionItem } from "@/lib/server/store";
import { lineUrgentQty } from "@/lib/urgentDisplay";
import {
  buildQueueMaterialLinesForGroup,
  totalQueueMaterialDemand,
} from "@/lib/consumablePlan";
import { fmtNumber } from "@/lib/format";
import { Button, Empty, Input, Modal } from "./ui";

interface ApiState {
  items: ProductionItem[];
  lastPostAt: string | null;
}

const ACCENT = "var(--color-accent)";
const RED = "#d11a1a";
const WARN = "#d4a017";

type Status = "low" | "warn" | "ok";

function statusOf(m: Material): Status {
  const min = Number(m.minStock) || 0;
  if (min <= 0) return m.stock > 0 ? "ok" : "low";
  if (m.stock < min) return "low";
  if (m.stock <= min * 1.1) return "warn";
  return "ok";
}

function colorFor(s: Status): string {
  if (s === "low") return RED;
  if (s === "warn") return WARN;
  return ACCENT;
}

function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

interface ProdGroup {
  key: string;
  name: string;
  qty: number;
  urgentQty: number;
  consumableShortage: boolean;
  hasConsumablePlan: boolean;
  consumableWarnSoon: boolean;
}

function groupProduction(items: ProductionItem[]): ProdGroup[] {
  const map = new Map<string, ProdGroup>();
  for (const it of items) {
    const key =
      it.matchedSlug || normalizeKey(it.matchedName ?? it.name) || it.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: it.matchedName || it.name,
        qty: 0,
        urgentQty: 0,
        consumableShortage: false,
        hasConsumablePlan: false,
        consumableWarnSoon: false,
      };
      map.set(key, g);
    }
    g.qty += it.qty;
    g.urgentQty += lineUrgentQty(it);
    if (it.matchedName) g.name = it.matchedName;
  }
  return Array.from(map.values()).sort((a, b) => {
    const au = a.urgentQty > 0 ? 1 : 0;
    const bu = b.urgentQty > 0 ? 1 : 0;
    if (bu !== au) return bu - au;
    return b.qty - a.qty;
  });
}

export function MainTab() {
  const materials = useStore((s) => s.materials);
  const catalogBoms = useStore((s) => s.catalogBoms);
  const [prod, setProd] = useState<ApiState>({ items: [], lastPostAt: null });
  const [receiveOpen, setReceiveOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/production", { cache: "no-store" });
      const json = await res.json();
      setProd({
        items: Array.isArray(json.items) ? json.items : [],
        lastPostAt: json.lastPostAt ?? null,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      void refresh();
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const groups = useMemo(() => {
    const base = groupProduction(prod.items);
    return base.map((g) => {
      const subset = prod.items.filter(
        (it) =>
          (it.matchedSlug || normalizeKey(it.matchedName ?? it.name) || it.id) ===
          g.key
      );
      const plan = buildQueueMaterialLinesForGroup(
        subset,
        prod.items,
        catalogBoms,
        materials
      );
      return {
        ...g,
        consumableShortage: plan.some((p) => p.shortage > 0),
        hasConsumablePlan: plan.length > 0,
        consumableWarnSoon: plan.some(
          (p) => p.warnSoon && p.shortage <= 0
        ),
      };
    });
  }, [prod.items, catalogBoms, materials]);
  const materialDemand = useMemo(
    () => totalQueueMaterialDemand(prod.items, catalogBoms),
    [prod.items, catalogBoms]
  );

  const materialRows = useMemo(() => {
    return materials.map((m) => {
      const demand = materialDemand.get(m.id) ?? 0;
      const stock = Number(m.stock) || 0;
      const min = Number(m.minStock) || 0;
      const after = stock - demand;
      const shortage = after < 0 ? -after : 0;
      const warnSoon =
        shortage === 0 &&
        after > 0 &&
        ((min > 0 && after <= min) ||
          (min <= 0 && stock > 0 && after / stock <= 0.15));
      const hasDemand = demand > 0;
      return {
        key: m.id,
        label: m.name,
        value: stock,
        max: Math.max(stock, demand, min, 1),
        meta: hasDemand
          ? `склад ${fmtNumber(stock)} ${m.unit} · очередь ${fmtNumber(demand)} · после ${fmtNumber(after)}${
              shortage > 0
                ? ` · не хватает ${fmtNumber(shortage)}`
                : warnSoon
                  ? " · мало ✎"
                  : ""
            }`
          : `${fmtNumber(stock)} ${m.unit}${
              min > 0 ? ` / мин ${fmtNumber(min)} ${m.unit}` : ""
            }`,
        color: !hasDemand
          ? ACCENT
          : shortage > 0
            ? "#38bdf8"
            : warnSoon
              ? "#38bdf8"
              : "#0ea5e9",
        marker: hasDemand
          ? demand
          : min > 0
            ? min
            : null,
      };
    });
  }, [materials, materialDemand]);

  const stats = useMemo(() => {
    let lowStock = 0;
    let runningOut = 0;
    for (const m of materials) {
      const s = statusOf(m);
      if (s === "low") lowStock += 1;
      else if (s === "warn") runningOut += 1;
    }
    const totalProdUnits = prod.items.reduce((s, i) => s + i.qty, 0);
    return {
      runningOut,
      lowStock,
      groups: groups.length,
      totalProdUnits,
    };
  }, [materials, prod.items, groups.length]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile
          label="Заканчивается"
          value={stats.runningOut}
          tone={stats.runningOut > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Не норм"
          value={stats.lowStock}
          tone={stats.lowStock > 0 ? "danger" : "default"}
        />
        <StatTile label="Позиций в очереди" value={stats.groups} />
        <StatTile label="Единиц на производство" value={stats.totalProdUnits} />
      </div>

      <Button
        variant="primary"
        size="lg"
        block
        onClick={() => setReceiveOpen(true)}
      >
        Оприходовать товар
      </Button>

      <ReceiveModal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
      />

      <DashboardSection
        title="Материалы (склад + прогноз очереди)"
        empty="Материалов пока нет — добавьте в Настройки → Материалы."
        rows={materials.length}
      >
        <BarChart rows={materialRows} />
      </DashboardSection>

      <DashboardSection
        title="На производство"
        empty="Очередь пуста — ждём новых данных от вебхука."
        rows={groups.length}
      >
        <BarChart
          rows={groups.map((g) => ({
            key: g.key,
            label: g.name,
            value: g.qty,
            max: groups[0]?.qty || 1,
            meta:
              `${fmtNumber(g.qty, 0)} шт` +
              (g.consumableShortage
                ? " · НЕХВАТАЕТ материалов"
                : g.consumableWarnSoon
                  ? " · после очереди мало ✎"
                  : g.hasConsumablePlan
                    ? " · есть нормы BOM"
                    : ""),
            color: g.consumableShortage
              ? "#38bdf8"
              : g.consumableWarnSoon
                ? "#38bdf8"
                : g.hasConsumablePlan
                  ? "#0ea5e9"
                  : g.urgentQty > 0
                    ? RED
                    : ACCENT,
          }))}
        />
      </DashboardSection>
    </div>
  );
}

function ReceiveModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }
  return <ReceiveModalContent onClose={onClose} />;
}

interface CatalogItem {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  imageUrl: string | null;
}

interface MergedCatalogItem {
  key: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
}

function canonicalProductName(name: string): string {
  return (name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function normalizeProductKey(name: string): string {
  return canonicalProductName(name)
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mergeCatalog(items: CatalogItem[]): MergedCatalogItem[] {
  const map = new Map<string, MergedCatalogItem>();
  for (const it of items) {
    const display = canonicalProductName(it.name);
    const key = normalizeProductKey(it.name) || it.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: display || it.name,
        imageUrl: it.imageUrl,
        category: it.category,
      };
      map.set(key, g);
    }
    if (!g.imageUrl && it.imageUrl) g.imageUrl = it.imageUrl;
    if (!g.category && it.category) g.category = it.category;
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ru")
  );
}

interface ReceiveLine {
  productKey: string;
  qty: string;
}

function ReceiveModalContent({ onClose }: { onClose: () => void }) {
  const catalogHidden = useStore((s) => s.catalogHidden);
  const catalogBoms = useStore((s) => s.catalogBoms);
  const materials = useStore((s) => s.materials);
  const addCatalogStock = useStore((s) => s.addCatalogStock);
  const updateMaterial = useStore((s) => s.updateMaterial);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Record<string, ReceiveLine>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && Array.isArray(json.items)) setItems(json.items);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const merged = useMemo(
    () => mergeCatalog(items).filter((m) => !catalogHidden?.[m.key]),
    [items, catalogHidden]
  );
  const byKey = useMemo(() => {
    const m = new Map<string, MergedCatalogItem>();
    for (const it of merged) m.set(it.key, it);
    return m;
  }, [merged]);

  const orderedKeys = Object.keys(lines);
  const valid = useMemo(() => {
    const agg = new Map<string, number>();
    for (const [key, l] of Object.entries(lines)) {
      const q = Number(l.qty);
      if (!Number.isFinite(q) || q <= 0) continue;
      agg.set(key, q);
    }
    return agg;
  }, [lines]);
  const totalUnits = Array.from(valid.values()).reduce((s, q) => s + q, 0);
  const canSave = valid.size > 0;

  const setQty = (key: string, qty: string) =>
    setLines((s) => ({ ...s, [key]: { productKey: key, qty } }));
  const removeLine = (key: string) =>
    setLines((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });

  const handlePick = (it: MergedCatalogItem) => {
    setLines((s) =>
      s[it.key] ? s : { ...s, [it.key]: { productKey: it.key, qty: "" } }
    );
    setPickerOpen(false);
  };

  const submit = () => {
    if (!canSave) return;
    const matDelta = new Map<string, number>();
    for (const [key, q] of valid) {
      addCatalogStock(key, q);
      const bom = catalogBoms?.[key];
      if (Array.isArray(bom)) {
        for (const line of bom) {
          const matId = line?.materialId;
          const per = Number(line?.qtyPerUnit);
          if (!matId || !Number.isFinite(per) || per <= 0) continue;
          matDelta.set(matId, (matDelta.get(matId) ?? 0) + per * q);
        }
      }
    }
    for (const [matId, used] of matDelta) {
      const m = materials.find((mm) => mm.id === matId);
      if (!m) continue;
      updateMaterial(matId, { stock: (Number(m.stock) || 0) - used });
    }
    onClose();
  };

  return (
    <>
      <Modal
        open={true}
        onClose={onClose}
        title="Оприходовать товар"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" onClick={submit} disabled={!canSave}>
              Оприходовать
              {canSave ? ` (${fmtNumber(totalUnits, 0)} шт)` : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {loading && items.length === 0 ? (
            <Empty>Загружаю каталог cashercollection…</Empty>
          ) : (
            <>
              {orderedKeys.length === 0 ? (
                <div className="text-center text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] py-4">
                  Нажмите «+ Товар», чтобы добавить позицию
                </div>
              ) : (
                <ul className="flex flex-col gap-2 w-full">
                  {orderedKeys.map((key) => {
                    const it = byKey.get(key);
                    if (!it) return null;
                    const line = lines[key];
                    return (
                      <li
                        key={key}
                        className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.06)] w-full min-w-0"
                      >
                        <ProductThumb item={it} />
                        <div className="flex-1 min-w-0">
                          <span
                            className="text-[12px] font-light uppercase tracking-wide truncate block"
                            title={it.name}
                          >
                            {it.name.toUpperCase()}
                          </span>
                        </div>
                        <Input
                          className="w-[88px] min-w-0 text-center"
                          type="number"
                          step="1"
                          min="0"
                          inputMode="numeric"
                          placeholder="0"
                          value={line.qty}
                          autoFocus
                          onChange={(e) => setQty(key, e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(key)}
                          aria-label="Удалить позицию"
                          className="h-9 w-9 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)] shrink-0"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Button
                block
                onClick={() => setPickerOpen(true)}
                disabled={merged.length === 0}
              >
                + Товар
              </Button>
            </>
          )}

          <div className="mt-2 px-3 py-2 bg-[#d4a017] text-[var(--color-foreground)] text-[11px] uppercase tracking-[0.18em] font-light text-center">
            Удостоверьтесь, что товар в надлежащем качестве и без брака
          </div>
        </div>
      </Modal>

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={merged}
        excludedKeys={new Set(orderedKeys)}
        onPick={handlePick}
      />
    </>
  );
}

function ProductThumb({ item }: { item: MergedCatalogItem }) {
  return (
    <div
      className="w-12 h-12 shrink-0 bg-[var(--color-surface)] overflow-hidden relative"
      aria-hidden
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}

function ProductPickerModal({
  open,
  onClose,
  items,
  excludedKeys,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  items: MergedCatalogItem[];
  excludedKeys: Set<string>;
  onPick: (m: MergedCatalogItem) => void;
}) {
  if (!open) {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }
  return (
    <ProductPickerContent
      onClose={onClose}
      items={items}
      excludedKeys={excludedKeys}
      onPick={onPick}
    />
  );
}

function ProductPickerContent({
  onClose,
  items,
  excludedKeys,
  onPick,
}: {
  onClose: () => void;
  items: MergedCatalogItem[];
  excludedKeys: Set<string>;
  onPick: (m: MergedCatalogItem) => void;
}) {
  const catalogStock = useStore((s) => s.catalogStock);

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((it) => {
      if (!q) return true;
      return it.name.toLowerCase().includes(q);
    });
    list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return list;
  }, [items, query]);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Выбор товара"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Поиск по товару"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="flex items-center justify-end">
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Найдено:{" "}
            <strong className="text-[var(--color-foreground)] tabular-nums">
              {fmtNumber(filtered.length, 0)}
            </strong>
          </span>
        </div>

        {filtered.length === 0 ? (
          <Empty>Ничего не найдено.</Empty>
        ) : (
          <ul
            className="grid grid-cols-3 sm:grid-cols-4 gap-2"
            style={{ maxHeight: 380, overflowY: "auto" }}
          >
            {filtered.map((it) => {
              const used = excludedKeys.has(it.key);
              const stock = Number(catalogStock?.[it.key]) || 0;
              return (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={() => !used && onPick(it)}
                    disabled={used}
                    className={
                      "w-full text-left bg-[var(--color-surface)] overflow-hidden flex flex-col transition-colors " +
                      (used
                        ? "opacity-40 pointer-events-none"
                        : "hover:bg-[color-mix(in_srgb,white_8%,var(--color-background))] cursor-pointer")
                    }
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
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-muted)] text-[10px] uppercase tracking-[0.18em]">
                          нет фото
                        </div>
                      )}
                      {stock > 0 && (
                        <div className="absolute top-1 left-1 z-[1]">
                          <span className="inline-flex items-center px-2 h-5 bg-[var(--color-accent)] text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light tabular-nums">
                            {fmtNumber(stock, 0)} шт
                          </span>
                        </div>
                      )}
                      {used && (
                        <div className="absolute top-1 right-1 z-[1]">
                          <span className="inline-flex items-center px-2 h-5 bg-[var(--color-background)] text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light">
                            Добавлено
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div
                        className="text-[11px] font-light leading-snug line-clamp-2 min-h-[2.4em] tracking-wide uppercase"
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
        )}
      </div>
    </Modal>
  );
}


function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warning";
}) {
  const bg =
    tone === "danger"
      ? "bg-[#d11a1a]"
      : tone === "warning"
        ? "bg-[#d4a017]"
        : "bg-[var(--color-surface)]";
  return (
    <div
      className={"p-3 sm:p-4 flex flex-col " + bg}
      style={{ minHeight: 110 }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
        {label}
      </div>
      <div className="flex-1" />
      <div className="text-2xl sm:text-3xl font-light tabular-nums tracking-wide text-left">
        {fmtNumber(value, 0)}
      </div>
    </div>
  );
}

function DashboardSection({
  title,
  empty,
  rows,
  children,
}: {
  title: string;
  empty: string;
  rows: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-[11px] font-light uppercase tracking-[0.24em]">
          {title}
        </h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Всего:{" "}
          <strong className="text-[var(--color-foreground)] tabular-nums">
            {fmtNumber(rows, 0)}
          </strong>
        </span>
      </header>
      {rows === 0 ? <Empty>{empty}</Empty> : children}
    </section>
  );
}

interface BarRow {
  key: string;
  label: string;
  value: number;
  max: number;
  meta: string;
  color: string;
  marker?: number | null;
}

function BarChart({ rows }: { rows: BarRow[] }) {
  const overallMax = rows.reduce((m, r) => Math.max(m, r.value, r.max), 0) || 1;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = Math.min(100, (r.value / overallMax) * 100);
        const markerPct =
          r.marker != null && r.marker > 0
            ? Math.min(100, (r.marker / overallMax) * 100)
            : null;
        return (
          <li key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span
                className="font-light uppercase tracking-wide truncate"
                title={r.label}
              >
                {r.label}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] tabular-nums normal-case shrink-0">
                {r.meta}
              </span>
            </div>
            <div className="relative h-3 bg-[var(--color-surface)]">
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: r.color }}
              />
              {markerPct != null && (
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: `${markerPct}%`,
                    width: 1,
                    background: "rgba(255,255,255,0.55)",
                  }}
                  title={`мин. ${r.marker}`}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
