"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { UNITS } from "@/lib/types";
import type { Consumable } from "@/lib/types";
import { Button, Field, Input, Modal, Select } from "./ui";
import { fmtNumber } from "@/lib/format";

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; id: string };

type SortKey = "stock" | "name";
type SortDir = "asc" | "desc";

export function ConsumablesTab() {
  const consumables = useStore((s) => s.consumables);
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const arr = [...consumables];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "ru");
      else cmp = a.stock - b.stock;
      if (cmp === 0) cmp = a.name.localeCompare(b.name, "ru");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [consumables, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="primary"
        size="lg"
        block
        onClick={() => setModal({ mode: "create" })}
      >
        + Добавить расходник
      </Button>

      {consumables.length === 0 ? (
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Список пуст. Расходники используются в нормах на изделие (вкладка
          «Изделия») и отображаются на производстве.
        </p>
      ) : (
        <div className="flex flex-col">
          <div
            className="px-1 pb-2 text-[10px] uppercase tracking-[0.18em] font-light text-[var(--color-muted)] flex items-center gap-6"
          >
            <SortHeader
              label="Название"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => toggleSort("name")}
            />
            <SortHeader
              label="Остаток"
              active={sortKey === "stock"}
              dir={sortDir}
              onClick={() => toggleSort("stock")}
            />
          </div>
          <ul className="flex flex-col">
            {sorted.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "edit", id: c.id })}
                  className="w-full text-left px-1 -mx-1 py-3 border-b border-[var(--color-line)]/40 hover:bg-[var(--color-surface)] transition-colors flex items-center gap-6 bg-transparent"
                >
                  <span className="font-light tracking-wide uppercase truncate flex-1 min-w-0">
                    {c.name}
                  </span>
                  <span className="tabular-nums text-[var(--color-foreground)] w-32 shrink-0 text-left">
                    {fmtNumber(c.stock)} {c.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConsumableModal state={modal} onClose={() => setModal({ mode: "closed" })} />
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
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
      style={{ fontSize: "10px", lineHeight: 1 }}
    >
      {label}
      <span className="tabular-nums">{arrow}</span>
    </button>
  );
}

function ConsumableModal({
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
  return (
    <ConsumableModalContent
      key={state.mode === "edit" ? state.id : "create"}
      state={state}
      onClose={onClose}
    />
  );
}

function ConsumableModalContent({
  state,
  onClose,
}: {
  state: Exclude<ModalState, { mode: "closed" }>;
  onClose: () => void;
}) {
  const addConsumable = useStore((s) => s.addConsumable);
  const updateConsumable = useStore((s) => s.updateConsumable);
  const removeConsumable = useStore((s) => s.removeConsumable);
  const existing = useStore((s) =>
    state.mode === "edit"
      ? s.consumables.find((c) => c.id === state.id) ?? null
      : null
  );

  const [name, setName] = useState(existing?.name ?? "");
  const [unit, setUnit] = useState(existing?.unit ?? "шт");
  const [stock, setStock] = useState(
    existing ? String(existing.stock) : ""
  );
  const [minStock, setMinStock] = useState(
    existing?.minStock != null ? String(existing.minStock) : ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const isEdit = state.mode === "edit";

  const submit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      unit,
      stock: Number(stock) || 0,
      minStock: minStock === "" ? undefined : Number(minStock) || 0,
      notes: notes.trim() || undefined,
    };
    if (isEdit) {
      updateConsumable(state.id, payload);
    } else {
      addConsumable(payload);
    }
    onClose();
  };

  const remove = () => {
    if (!isEdit) return;
    if (!confirm(`Удалить расходник «${name || existing?.name}»?`)) return;
    removeConsumable(state.id);
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? "Изменить расходник" : "Новый расходник"}
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
            placeholder="Например: нитки, бирки"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ед. учёта">
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
          <Field label="Остаток на складе">
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Мин. остаток (опц.)">
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="не задано"
          />
        </Field>
        <Field label="Заметка">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="необязательно"
          />
        </Field>
      </div>
    </Modal>
  );
}
