"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { UNITS } from "@/lib/types";
import type { Material } from "@/lib/types";
import { Button, Field, Input, Modal, Select } from "./ui";
import { fmtNumber } from "@/lib/format";

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; id: string }
  | { mode: "replenish" };

type SortKey = "status" | "name" | "stock";
type SortDir = "asc" | "desc";
type Status = "low" | "warn" | "ok";

function statusOf(m: Material): Status {
  const min = Number(m.minStock) || 0;
  if (min <= 0) return m.stock > 0 ? "ok" : "low";
  if (m.stock < min) return "low";
  if (m.stock <= min * 1.1) return "warn";
  return "ok";
}

function statusRank(s: Status): number {
  if (s === "low") return 0;
  if (s === "warn") return 1;
  return 2;
}

export function MaterialsTab() {
  const materials = useStore((s) => s.materials);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const arr = [...materials];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "ru");
      } else if (sortKey === "stock") {
        cmp = a.stock - b.stock;
      } else {
        cmp = statusRank(statusOf(a)) - statusRank(statusOf(b));
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name, "ru");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [materials, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => setModal({ mode: "create" })}
        >
          + Добавить материал
        </Button>
        <Button
          variant="secondary"
          size="lg"
          block
          onClick={() => setModal({ mode: "replenish" })}
          disabled={materials.length === 0}
        >
          Пополнить материалы
        </Button>
      </div>

      {materials.length === 0 ? null : (
        <div className="flex flex-col">
          <div
            className="px-1 pb-2 text-[10px] uppercase tracking-[0.18em] font-light text-[var(--color-muted)]"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
            }}
          >
            <SortHeader
              label="Статус"
              active={sortKey === "status"}
              dir={sortDir}
              onClick={() => toggleSort("status")}
              style={{ width: 100, flexShrink: 0, textAlign: "left" }}
            />
            <SortHeader
              label="Название"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => toggleSort("name")}
              style={{ flex: "1 1 auto", minWidth: 0, textAlign: "left" }}
            />
            <SortHeader
              label="Остаток"
              active={sortKey === "stock"}
              dir={sortDir}
              onClick={() => toggleSort("stock")}
              style={{
                width: 140,
                flexShrink: 0,
                textAlign: "left",
              }}
            />
          </div>
          <ul className="flex flex-col">
            {sorted.map((m) => (
              <MaterialRow
                key={m.id}
                m={m}
                onEdit={() => setModal({ mode: "edit", id: m.id })}
              />
            ))}
          </ul>
        </div>
      )}

      <MaterialModal state={modal} onClose={() => setModal({ mode: "closed" })} />
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  style,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const arrow = active ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "bg-transparent border-0 p-0 m-0 cursor-pointer uppercase tracking-[0.18em] hover:text-[var(--color-foreground)] transition-colors " +
        (active
          ? "text-[var(--color-foreground)]"
          : "text-[var(--color-muted)]")
      }
      style={{ fontSize: "10px", lineHeight: 1, ...style }}
    >
      {label}
      <span className="tabular-nums">{arrow}</span>
    </button>
  );
}

function MaterialRow({
  m,
  onEdit,
}: {
  m: Material;
  onEdit: () => void;
}) {
  const status = statusOf(m);
  const statusBg =
    status === "low"
      ? "bg-[#d11a1a]"
      : status === "warn"
        ? "bg-[#d4a017]"
        : "bg-[var(--color-accent)]";
  const statusLabel =
    status === "low"
      ? "не норм"
      : status === "warn"
        ? "кончается"
        : "норм";

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="w-full text-left px-1 -mx-1 py-3 border-b border-[var(--color-line)]/40 hover:bg-[var(--color-surface)] transition-colors cursor-pointer bg-transparent"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
        }}
      >
        <div
          style={{
            width: 100,
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <span
            className={
              "inline-flex items-center justify-center h-6 text-[var(--color-foreground)] text-[10px] uppercase tracking-[0.18em] font-light " +
              statusBg
            }
            style={{ width: 90 }}
          >
            {statusLabel}
          </span>
        </div>
        <div
          className="font-light tracking-wide uppercase truncate"
          title={m.name}
          style={{ flex: "1 1 auto", minWidth: 0 }}
        >
          {m.name}
        </div>
        <div
          className="tabular-nums"
          style={{ width: 140, textAlign: "left", flexShrink: 0 }}
        >
          <span className="text-[var(--color-foreground)]">
            {fmtNumber(m.stock)}
          </span>{" "}
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {m.unit}
          </span>
        </div>
      </button>
    </li>
  );
}

function MaterialModal({
  state,
  onClose,
}: {
  state: ModalState;
  onClose: () => void;
}) {
  if (state.mode === "closed") {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }
  if (state.mode === "replenish") {
    return <ReplenishModalContent onClose={onClose} />;
  }
  return (
    <MaterialModalContent
      key={state.mode === "edit" ? state.id : "create"}
      state={state}
      onClose={onClose}
    />
  );
}

function ReplenishModalContent({ onClose }: { onClose: () => void }) {
  const materials = useStore((s) => s.materials);
  const updateMaterial = useStore((s) => s.updateMaterial);

  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  const sortedMaterials = useMemo(
    () =>
      [...materials].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [materials]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedMaterials;
    return sortedMaterials.filter((m) => m.name.toLowerCase().includes(q));
  }, [sortedMaterials, query]);

  const valid = useMemo(
    () =>
      materials
        .map((m) => ({ m, qty: Number(qtyById[m.id]) }))
        .filter((r) => Number.isFinite(r.qty) && r.qty > 0),
    [materials, qtyById]
  );
  const canSave = valid.length > 0;

  const setQty = (id: string, v: string) =>
    setQtyById((s) => ({ ...s, [id]: v }));

  const submit = () => {
    if (!canSave) return;
    for (const r of valid) {
      updateMaterial(r.m.id, { stock: (Number(r.m.stock) || 0) + r.qty });
    }
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Пополнить материалы"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSave}>
            Пополнить
            {canSave ? ` (${valid.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Поиск по материалу"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {visible.length === 0 ? (
          <div className="text-center text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)] py-4">
            Ничего не найдено
          </div>
        ) : (
          <ul
            className="flex flex-col"
            style={{ maxHeight: 420, overflowY: "auto" }}
          >
            {visible.map((m) => {
              const raw = qtyById[m.id] ?? "";
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.06)] w-full min-w-0"
                >
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span
                      className="text-[12px] font-light uppercase tracking-wide truncate"
                      title={m.name}
                    >
                      {m.name.toUpperCase()}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] tabular-nums">
                      {fmtNumber(m.stock)} {m.unit}
                    </span>
                  </div>
                  <Input
                    className="w-[110px] min-w-0 text-center"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder={`+ ${m.unit}`}
                    value={raw}
                    onChange={(e) => setQty(m.id, e.target.value)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function MaterialModalContent({
  state,
  onClose,
}: {
  state: Exclude<ModalState, { mode: "closed" }>;
  onClose: () => void;
}) {
  const addMaterial = useStore((s) => s.addMaterial);
  const updateMaterial = useStore((s) => s.updateMaterial);
  const removeMaterial = useStore((s) => s.removeMaterial);
  const existing = useStore((s) =>
    state.mode === "edit"
      ? s.materials.find((m) => m.id === state.id) ?? null
      : null
  );

  const [name, setName] = useState(existing?.name ?? "");
  const [unit, setUnit] = useState(existing?.unit ?? "шт");
  const [price, setPrice] = useState(
    existing ? String(existing.pricePerUnit) : ""
  );
  const [stock, setStock] = useState(
    existing ? String(existing.stock) : ""
  );
  const [minStock, setMinStock] = useState(
    existing?.minStock != null ? String(existing.minStock) : ""
  );

  const isEdit = state.mode === "edit";

  const submit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      unit,
      pricePerUnit: Number(price) || 0,
      stock: Number(stock) || 0,
      minStock: minStock === "" ? 0 : Number(minStock) || 0,
    };
    if (isEdit) {
      updateMaterial(state.id, payload);
    } else {
      addMaterial(payload);
    }
    onClose();
  };

  const remove = () => {
    if (!isEdit) return;
    if (!confirm(`Удалить материал «${name || existing?.name}»?`)) return;
    removeMaterial(state.id);
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? "Изменить материал" : "Новый материал"}
      footer={
        <>
          {isEdit && (
            <Button variant="ghost" onClick={remove}>
              Удалить
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit}>
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Название">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ед.">
            <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              {!UNITS.includes(unit as (typeof UNITS)[number]) && (
                <option value={unit}>{unit}</option>
              )}
            </Select>
          </Field>
          <Field label="Цена/ед.">
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Введите цену"
            />
          </Field>
          <Field label="Остаток">
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Введите остаток"
            />
          </Field>
        </div>
        <Field label="Минимальный остаток">
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="Введите минимальный остаток"
          />
        </Field>
      </div>
    </Modal>
  );
}
