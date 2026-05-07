"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { BomLine } from "@/lib/types";
import { fmtMoney, fmtNumber } from "@/lib/format";
import { Button, Field, Input, Modal, Select } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  bomKey: string | null;
  productName: string | null;
  imageUrl?: string | null;
}

export function ProductBomModal(props: Props) {
  const { open, bomKey } = props;
  if (!open || !bomKey) {
    return (
      <Modal open={false} onClose={props.onClose} title="">
        {null}
      </Modal>
    );
  }
  return <ProductBomModalContent key={bomKey} {...props} />;
}

function ProductBomModalContent({
  onClose,
  bomKey,
  productName,
  imageUrl,
}: Props) {
  const materials = useStore((s) => s.materials);
  const setCatalogBom = useStore((s) => s.setCatalogBom);
  const setCatalogManualCost = useStore((s) => s.setCatalogManualCost);
  const setCatalogHidden = useStore((s) => s.setCatalogHidden);
  const isHidden = useStore((s) =>
    bomKey ? !!s.catalogHidden?.[bomKey] : false
  );

  const [lines, setLines] = useState<BomLine[]>(() => {
    if (!bomKey) return [];
    const all = useStore.getState().catalogBoms ?? {};
    const stored = all[bomKey];
    return Array.isArray(stored) ? stored : [];
  });

  const [manualCost, setManualCost] = useState<string>(() => {
    if (!bomKey) return "";
    const all = useStore.getState().catalogManualCosts ?? {};
    const stored = all[bomKey];
    return typeof stored === "number" && stored > 0 ? String(stored) : "";
  });

  const computedCost = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const m = materials.find((mm) => mm.id === l.materialId);
        return sum + (m ? m.pricePerUnit * l.qtyPerUnit : 0);
      }, 0),
    [lines, materials]
  );

  const useManual = lines.length === 0;
  const displayCost = useManual ? Number(manualCost) || 0 : computedCost;

  const addLine = () => {
    if (!materials.length) return;
    const used = new Set(lines.map((l) => l.materialId));
    const next = materials.find((m) => !used.has(m.id)) ?? materials[0];
    setLines((arr) => [...arr, { materialId: next.id, qtyPerUnit: 0 }]);
  };

  const updateLine = (idx: number, patch: Partial<BomLine>) =>
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const removeLine = (idx: number) =>
    setLines((arr) => arr.filter((_, i) => i !== idx));

  const save = () => {
    if (!bomKey) return;
    const valid = lines.filter(
      (l) => l.materialId && Number.isFinite(l.qtyPerUnit) && l.qtyPerUnit > 0
    );
    setCatalogBom(bomKey, valid);
    if (valid.length === 0) {
      const num = Number(manualCost);
      setCatalogManualCost(
        bomKey,
        Number.isFinite(num) && num > 0 ? num : null
      );
    } else {
      setCatalogManualCost(bomKey, null);
    }
    onClose();
  };

  const clear = () => {
    if (!bomKey) return;
    if (!lines.length && !manualCost) return;
    if (!confirm("Удалить все настройки расхода для этого изделия?")) return;
    setLines([]);
    setManualCost("");
  };

  const toggleHidden = () => {
    if (!bomKey) return;
    setCatalogHidden(bomKey, !isHidden);
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={productName ? `Расход: ${productName}` : "Расход материалов"}
      headerExtra={
        <button
          type="button"
          onClick={toggleHidden}
          style={{ fontSize: "10px", lineHeight: 1 }}
          className="uppercase tracking-[0.18em] font-light text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors px-1 bg-transparent border-0 m-0"
        >
          {isHidden ? "Вернуть товар" : "Скрыть товар"}
        </button>
      }
      footer={
        <>
          {(lines.length > 0 || manualCost) && (
            <Button variant="ghost" onClick={clear}>
              Очистить
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={save}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        {imageUrl && (
          <div className="w-16 h-16 shrink-0 bg-black/40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={productName ?? ""}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
            Себестоимость / 1 шт.
            {!useManual && (
              <span className="ml-2 text-[var(--color-muted)] normal-case tracking-normal">
                (из материалов)
              </span>
            )}
          </div>
          {useManual ? (
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0"
              value={manualCost}
              onChange={(e) => setManualCost(e.target.value)}
              className="mt-1 text-base"
            />
          ) : (
            <div className="text-base font-light text-[var(--color-foreground)] tabular-nums normal-case tracking-normal mt-1">
              {fmtMoney(displayCost)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {lines.map((line, idx) => {
          const m = materials.find((mm) => mm.id === line.materialId);
          return (
            <div
              key={idx}
              className="grid grid-cols-[1fr_140px_36px] gap-2 items-end"
            >
                <Field label="Материал">
                  <Select
                    value={line.materialId}
                    onChange={(e) =>
                      updateLine(idx, { materialId: e.target.value })
                    }
                  >
                    {materials.map((mm) => (
                      <option key={mm.id} value={mm.id}>
                        {mm.name.toUpperCase()} ({mm.unit})
                      </option>
                    ))}
                  </Select>
                </Field>
              <Field label={`Расход (${m?.unit ?? ""})`}>
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  className="text-right"
                  value={line.qtyPerUnit}
                  onChange={(e) =>
                    updateLine(idx, {
                      qtyPerUnit: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <button
                type="button"
                onClick={() => removeLine(idx)}
                aria-label="Удалить строку"
                className="h-10 w-9 inline-flex items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)]"
              >
                ✕
              </button>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-1">
          {materials.length > 0 ? (
            <Button size="sm" onClick={addLine}>
              + Материал
            </Button>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Чтобы считать из материалов — добавьте их в разделе
              «Материалы»
            </span>
          )}
          {lines.length > 0 && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Строк:{" "}
              <strong className="text-[var(--color-foreground)] tabular-nums">
                {fmtNumber(lines.length, 0)}
              </strong>
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
