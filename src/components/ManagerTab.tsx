"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductionItem } from "@/lib/server/store";
import { lineUrgentQty } from "@/lib/urgentDisplay";
import { Button, Empty, Input, Modal } from "./ui";
import { fmtNumber } from "@/lib/format";

interface ApiState {
  items: ProductionItem[];
}

const MANAGER_PASSWORD = "Casher123";

interface Group {
  key: string;
  name: string;
  imageUrl: string | null;
  totalQty: number;
  urgentQty: number;
}

function normalizeKey(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function groupItems(items: ProductionItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = it.matchedSlug || normalizeKey(it.matchedName ?? it.name) || it.id;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: it.matchedName || it.name,
        imageUrl: it.imageUrl ?? null,
        totalQty: 0,
        urgentQty: 0,
      };
      map.set(key, g);
    }
    if (!g.imageUrl && it.imageUrl) g.imageUrl = it.imageUrl;
    g.totalQty += it.qty;
    g.urgentQty += lineUrgentQty(it);
  }
  return Array.from(map.values()).sort((a, b) => {
    const au = a.urgentQty > 0 ? 1 : 0;
    const bu = b.urgentQty > 0 ? 1 : 0;
    if (bu !== au) return bu - au;
    return b.totalQty - a.totalQty;
  });
}

export function ManagerTab() {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <ManagerPasswordGate onUnlock={() => setUnlocked(true)} />;
  return <ManagerTabContent />;
}

function ManagerTabContent() {
  const [data, setData] = useState<ApiState>({ items: [] });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/production", { cache: "no-store" });
      const j = await r.json();
      setData({ items: Array.isArray(j.items) ? j.items : [] });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }, []);

  useEffect(() => {
    const tick = () => void refresh();
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const groups = useMemo(() => groupItems(data.items), [data.items]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  const byKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.key, g);
    return m;
  }, [groups]);

  const chosen = useMemo(
    () =>
      Object.entries(picked)
        .map(([k, qty]) => {
          const g = byKey.get(k);
          if (!g) return null;
          return { group: g, qty };
        })
        .filter((x): x is { group: Group; qty: number } => !!x),
    [picked, byKey]
  );

  const saveUrgent = async () => {
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        chosen.map(({ group: g, qty }) => {
          const q = Math.max(1, Math.floor(Number(qty)) || 1);
          return fetch("/api/production/urgent", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key: g.key, qty: q }),
          });
        })
      );
      setPicked({});
      setOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const clearUrgentForKey = async (key: string) => {
    setClearingKey(key);
    try {
      const r = await fetch("/api/production/urgent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, qty: 0 }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Не удалось снять срочное",
        );
        return;
      }
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setClearingKey(null);
    }
  };

  const clearAllUrgent = async () => {
    setClearingAll(true);
    try {
      const r = await fetch("/api/production/urgent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(
          typeof (j as { error?: string }).error === "string"
            ? (j as { error: string }).error
            : "Не удалось снять все срочные",
        );
        return;
      }
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setClearingAll(false);
    }
  };

  const hasAnyUrgent = useMemo(() => groups.some((g) => g.urgentQty > 0), [groups]);

  return (
    <>
      <div className="flex flex-col gap-4">
        <Button block onClick={() => setOpen(true)} disabled={groups.length === 0}>
          Добавить товар в срочные
        </Button>

        <Button
          variant="ghost"
          block
          disabled={!hasAnyUrgent || clearingAll}
          onClick={() => void clearAllUrgent()}
        >
          {clearingAll ? "Снимаем…" : "Снять все срочные"}
        </Button>

        <Input
          placeholder="Поиск по товару"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#d11a1a]">
            {error}
          </div>
        )}

        {visible.length === 0 ? (
          <Empty>Нет товаров в очереди.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((g) => (
              <li
                key={g.key}
                className={
                  "p-3 " +
                  (g.urgentQty > 0 ? "bg-[#d11a1a]/25" : "bg-[var(--color-surface)]")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="text-[12px] font-light uppercase tracking-[0.18em] truncate"
                    title={g.name}
                  >
                    {g.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] tabular-nums text-[var(--color-muted)]">
                    {fmtNumber(g.totalQty, 0)} шт
                  </div>
                </div>
                {g.urgentQty > 0 && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-foreground)]">
                      СРОЧНО — {fmtNumber(g.urgentQty, 0)} шт
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={clearingKey === g.key}
                      onClick={(e) => {
                        e.preventDefault();
                        void clearUrgentForKey(g.key);
                      }}
                    >
                      {clearingKey === g.key ? "…" : "Снять срочное"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <UrgentPickerModal
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
        picked={picked}
        setPicked={setPicked}
        onSave={saveUrgent}
        saving={saving}
      />
    </>
  );
}

function UrgentPickerModal({
  open,
  onClose,
  groups,
  picked,
  setPicked,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  picked: Record<string, number>;
  setPicked: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onSave: () => void;
  saving: boolean;
}) {
  const [query, setQuery] = useState("");

  if (!open) {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }

  const visible = groups
    .filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Добавить в срочные"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={saving || Object.keys(picked).length === 0}
          >
            Добавить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Поиск по товару"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {visible.length === 0 ? (
          <Empty>Ничего не найдено.</Empty>
        ) : (
          <ul
            className="grid grid-cols-3 sm:grid-cols-4 gap-2"
            style={{ maxHeight: 380, overflowY: "auto" }}
          >
            {visible.map((g) => {
              const active = g.key in picked;
              const urgentPick = picked[g.key];
              return (
                <li key={g.key}>
                  <div
                    className={
                      "w-full text-left bg-[var(--color-surface)] overflow-hidden flex flex-col transition-colors " +
                      (active
                        ? "ring-2 ring-[#d11a1a]"
                        : "")
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setPicked((s) => {
                          const n = { ...s };
                          if (g.key in n) delete n[g.key];
                          else n[g.key] = g.totalQty;
                          return n;
                        })
                      }
                      className={
                        "w-full text-left flex flex-col transition-colors " +
                        (active
                          ? ""
                          : "hover:bg-[color-mix(in_srgb,white_8%,var(--color-background))]")
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
                      ) : null}
                      <div className="absolute top-1 left-1 z-[1]">
                        <span className="inline-flex items-center px-2 h-5 bg-[var(--color-background)] text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light tabular-nums">
                          {fmtNumber(g.totalQty, 0)}
                        </span>
                      </div>
                      {active && (
                        <div className="absolute top-1 right-1 z-[1]">
                          <span className="inline-flex items-center px-2 h-5 bg-[#d11a1a] text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light">
                            СРОЧНО
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div
                        className="text-[11px] font-light leading-snug line-clamp-2 min-h-[2.4em] tracking-wide uppercase"
                        title={g.name}
                      >
                        {g.name}
                      </div>
                    </div>
                    </button>
                    {active && (
                      <div className="px-2 pb-2 flex items-center gap-2">
                        <label className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-muted)] shrink-0">
                          Срочно
                        </label>
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-[11px] tabular-nums"
                          value={urgentPick === undefined ? "" : urgentPick}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setPicked((s) => ({
                              ...s,
                              [g.key]:
                                Number.isFinite(v) && v >= 1
                                  ? Math.floor(v)
                                  : 1,
                            }));
                          }}
                        />
                        <span className="text-[9px] text-[var(--color-muted)] shrink-0">
                          шт
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function ManagerPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (value === MANAGER_PASSWORD) onUnlock();
    else setError(true);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mx-auto w-full max-w-sm flex flex-col gap-4 py-12"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[11px] font-light uppercase tracking-[0.24em]">
          Панель манагера
        </h2>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Введите пароль
        </p>
      </div>
      <Input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(false);
        }}
        placeholder="Пароль"
      />
      {error && (
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#d11a1a]">
          Неверный пароль
        </div>
      )}
      <Button type="submit" variant="primary" block disabled={!value}>
        Войти
      </Button>
    </form>
  );
}

