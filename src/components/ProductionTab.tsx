"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductionItem } from "@/lib/server/store";
import { lineUrgentQty } from "@/lib/urgentDisplay";
import type { Consumable, ConsumableBomLine } from "@/lib/types";
import {
  planConsumablesForItems,
  type PlannedConsumableLine,
} from "@/lib/consumablePlan";
import { useStore } from "@/lib/store";
import { Empty, Input, Segmented } from "./ui";
import { fmtNumber } from "@/lib/format";

type Mode = "grid" | "list";
type Sort = "qty" | "name";
type Filter = "all" | "urgent";

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
  urgentQty: number;
  ids: string[];
}

interface Group {
  key: string;
  name: string;
  imageUrl: string | null;
  matchedSlug: string | null;
  totalQty: number;
  urgentQty: number;
  ids: string[];
  sizes: SizeBucket[];
  consumablePlan: PlannedConsumableLine[];
  consumableShortage: boolean;
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
        urgentQty: 0,
        ids: [],
        sizes: [],
        consumablePlan: [],
        consumableShortage: false,
      };
      map.set(groupKey, g);
    }
    if (!g.imageUrl && it.imageUrl) g.imageUrl = it.imageUrl;
    if (it.matchedName && (!g.matchedSlug || g.name === it.name)) {
      g.name = it.matchedName;
    }
    g.totalQty += it.qty;
    g.urgentQty += lineUrgentQty(it);
    g.ids.push(it.id);
    const sizeRaw = (it.size ?? "").trim();
    const sizeKey = sizeRaw || "";
    let bucket = g.sizes.find((s) => (s.size ?? "") === sizeKey);
    if (!bucket) {
      bucket = { size: sizeRaw || undefined, qty: 0, urgentQty: 0, ids: [] };
      g.sizes.push(bucket);
    }
    bucket.qty += it.qty;
    bucket.urgentQty += lineUrgentQty(it);
    bucket.ids.push(it.id);
  }
  for (const g of map.values()) {
    g.sizes.sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
  }
  return Array.from(map.values());
}

function attachConsumablePlans(
  groups: Group[],
  items: ProductionItem[],
  catalogConsumableBoms: Record<string, ConsumableBomLine[]>,
  consumables: Consumable[]
): Group[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return groups.map((g) => {
    const subset = g.ids
      .map((id) => byId.get(id))
      .filter((i): i is ProductionItem => !!i);
    const plan = planConsumablesForItems(
      subset,
      catalogConsumableBoms,
      consumables
    );
    return {
      ...g,
      consumablePlan: plan,
      consumableShortage: plan.some((p) => p.shortage > 0),
    };
  });
}

function sortGroups(groups: Group[], sort: Sort): Group[] {
  const arr = [...groups];
  arr.sort((a, b) => {
    const au = a.urgentQty > 0 ? 1 : 0;
    const bu = b.urgentQty > 0 ? 1 : 0;
    return bu - au;
  });
  if (sort === "qty") {
    arr.sort((a, b) => {
      if ((b.urgentQty > 0 ? 1 : 0) !== (a.urgentQty > 0 ? 1 : 0)) {
        return (b.urgentQty > 0 ? 1 : 0) - (a.urgentQty > 0 ? 1 : 0);
      }
      if (b.totalQty !== a.totalQty) return b.totalQty - a.totalQty;
      return a.name.localeCompare(b.name, "ru");
    });
  } else {
    arr.sort((a, b) => {
      if ((b.urgentQty > 0 ? 1 : 0) !== (a.urgentQty > 0 ? 1 : 0)) {
        return (b.urgentQty > 0 ? 1 : 0) - (a.urgentQty > 0 ? 1 : 0);
      }
      return a.name.localeCompare(b.name, "ru");
    });
  }
  return arr;
}

export function ProductionTab() {
  const catalogConsumableBoms = useStore((s) => s.catalogConsumableBoms);
  const consumables = useStore((s) => s.consumables);
  const [data, setData] = useState<ApiState>({ items: [], lastPostAt: null });
  const [mode, setMode] = useState<Mode>("grid");
  const [sort, setSort] = useState<Sort>("qty");
  const [filter, setFilter] = useState<Filter>("all");
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

  const allGroups = useMemo(
    () =>
      attachConsumablePlans(
        groupItems(data.items),
        data.items,
        catalogConsumableBoms,
        consumables
      ),
    [data.items, catalogConsumableBoms, consumables]
  );
  const totalUnits = useMemo(
    () => data.items.reduce((s, i) => s + i.qty, 0),
    [data.items]
  );

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byText = q
      ? allGroups.filter((g) => g.name.toLowerCase().includes(q))
      : allGroups;
    const filtered =
      filter === "urgent" ? byText.filter((g) => g.urgentQty > 0) : byText;
    return sortGroups(filtered, sort);
  }, [allGroups, query, sort, filter]);

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
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Все" },
            { value: "urgent", label: "Срочно" },
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

      <details className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
        <summary className="cursor-pointer text-sky-400/90 hover:text-sky-300 transition-colors">
          Как работают расходники
        </summary>
        <div className="mt-3 normal-case tracking-normal text-[var(--color-foreground)]/85 space-y-2 leading-relaxed max-w-2xl">
          <p>
            В настройках заведите позиции в разделе «Расходники» и укажите остатки
            на складе. Для каждого изделия в «Изделия» → карточка товара задайте
            норму: сколько расходника уходит на одну штуку изделия.
          </p>
          <p>
            Когда позиция попадает в очередь «На производство», под карточкой
            показывается расчёт: сколько всего нужно расходника на эту очередь,
            сколько есть на складе и какой будет остаток после списания.
          </p>
          <p>
            Синяя рамка вокруг карточки значит, что для изделия заданы нормы
            расходников. Метка «НЕХВАТАЕТ» (синим) — если после списания остаток
            ушёл бы в минус; рядом указано, не хватает какого количества.
          </p>
          <p>
            При «Оприходовать товар» на главной расходники списываются так же,
            как материалы по BOM себестоимости — пропорционально количеству
            принятой продукции.
          </p>
        </div>
      </details>
    </div>
  );
}

function ConsumablePlanPanel({
  plan,
  urgent,
}: {
  plan: PlannedConsumableLine[];
  urgent: boolean;
}) {
  if (!plan.length) return null;
  return (
    <div
      className={
        "rounded-sm border px-2 py-2 space-y-1.5 " +
        (urgent
          ? "border-sky-400/50 bg-black/25"
          : "border-sky-500/45 bg-sky-950/40")
      }
    >
      {plan.some((p) => p.shortage > 0) && (
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">
          НЕХВАТАЕТ
        </div>
      )}
      <ul className="space-y-1.5">
        {plan.map((row) => (
          <li
            key={row.consumableId}
            className={
              "text-[10px] leading-snug font-light tracking-wide normal-case " +
              (row.shortage > 0 ? "text-sky-200" : "text-sky-100/90")
            }
          >
            <span className="font-medium text-sky-100/95">{row.name}</span>
            {": нужно "}
            <span className="tabular-nums">
              {fmtNumber(row.required)} {row.unit}
            </span>
            {" · на складе "}
            <span className="tabular-nums">
              {fmtNumber(row.stock)} {row.unit}
            </span>
            {" · после списания "}
            <span
              className={
                "tabular-nums " +
                (row.balanceAfter < 0 ? "text-sky-300 font-medium" : "")
              }
            >
              {fmtNumber(row.balanceAfter)} {row.unit}
            </span>
            {row.shortage > 0 && (
              <span className="text-sky-300">
                {" "}
                (−{fmtNumber(row.shortage)} {row.unit})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GridView({ groups }: { groups: Group[] }) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
      {groups.map((g) => (
        <li
          key={g.key}
          className={
            "overflow-hidden flex flex-col " +
            (g.urgentQty > 0 ? "bg-[#d11a1a]" : "bg-[var(--color-surface)]") +
            (g.consumablePlan.length > 0 ? " ring-2 ring-sky-500/65" : "")
          }
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
              <span
                className={
                  "inline-flex items-center px-3 h-9 text-[var(--color-foreground)] text-sm font-light tabular-nums tracking-wider " +
                  (g.urgentQty > 0 ? "bg-[#7f0f0f]" : "bg-[var(--color-accent)]")
                }
              >
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
            <ConsumablePlanPanel
              plan={g.consumablePlan}
              urgent={g.urgentQty > 0}
            />
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
          className={
            "flex flex-col sm:flex-row sm:items-center gap-3 py-3 first:pt-0 " +
            (g.urgentQty > 0 ? "bg-[#d11a1a]/20 px-2 -mx-2" : "") +
            (g.consumablePlan.length > 0 ? " ring-2 ring-sky-500/50 sm:ring-inset" : "")
          }
        >
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{g.name}</div>
            <ConsumablePlanPanel
              plan={g.consumablePlan}
              urgent={g.urgentQty > 0}
            />
            <SizeChips sizes={g.sizes} className="mt-1" />
          </div>
          <span
            className={
              "inline-flex items-center px-3 h-9 text-[var(--color-foreground)] text-sm font-light tabular-nums tracking-wider " +
              (g.urgentQty > 0 ? "bg-[#d11a1a]" : "bg-[var(--color-accent)]")
            }
          >
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
          className={
            "inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-light uppercase tracking-[0.18em] text-[var(--color-foreground)] " +
            (s.urgentQty > 0 ? "bg-[#d11a1a]" : "bg-[var(--color-surface)]")
          }
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
