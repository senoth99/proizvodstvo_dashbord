"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { CalcRow } from "@/lib/types";
import { Badge, Button, Card, Empty, Input, Select } from "./ui";
import { fmtMoney, fmtNumber } from "@/lib/format";

export function CalcTab() {
  const materials = useStore((s) => s.materials);
  const products = useStore((s) => s.products);
  const plan = useStore((s) => s.plan);
  const addPlanLine = useStore((s) => s.addPlanLine);
  const updatePlanLine = useStore((s) => s.updatePlanLine);
  const removePlanLine = useStore((s) => s.removePlanLine);
  const clearPlan = useStore((s) => s.clearPlan);

  const matById = (id: string) => materials.find((m) => m.id === id);
  const prodById = (id: string) => products.find((p) => p.id === id);

  const rows: CalcRow[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of plan) {
      const product = prodById(line.productId);
      if (!product) continue;
      for (const bom of product.bom) {
        const cur = totals.get(bom.materialId) ?? 0;
        totals.set(bom.materialId, cur + bom.qtyPerUnit * line.qty);
      }
    }
    return Array.from(totals.entries())
      .map(([materialId, required]) => {
        const m = matById(materialId);
        const stock = m?.stock ?? 0;
        const price = m?.pricePerUnit ?? 0;
        const shortage = Math.max(0, required - stock);
        return {
          materialId,
          required,
          stock,
          shortage,
          cost: required * price,
        };
      })
      .sort((a, b) => {
        if (a.shortage > 0 && b.shortage <= 0) return -1;
        if (b.shortage > 0 && a.shortage <= 0) return 1;
        const an = matById(a.materialId)?.name ?? "";
        const bn = matById(b.materialId)?.name ?? "";
        return an.localeCompare(bn, "ru");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, products, materials]);

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalShortageCost = rows.reduce((s, r) => {
    const m = matById(r.materialId);
    return s + r.shortage * (m?.pricePerUnit ?? 0);
  }, 0);
  const hasShortage = rows.some((r) => r.shortage > 0);

  return (
    <div className="grid gap-5">
      <Card
        title="План производства"
        actions={
          plan.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearPlan}>
              Очистить
            </Button>
          ) : null
        }
      >
        {products.length === 0 ? (
          <Empty>
            Сначала создайте изделие во вкладке «Изделия» — в нём задаётся
            расход материалов на единицу.
          </Empty>
        ) : (
          <>
            <div className="grid gap-2">
              {plan.length === 0 && (
                <Empty>Добавьте первую позицию ниже.</Empty>
              )}
              {plan.map((line) => {
                const p = prodById(line.productId);
                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-[1fr_140px_40px] gap-2 items-center"
                  >
                    <Select
                      value={line.productId}
                      onChange={(e) =>
                        updatePlanLine(line.id, { productId: e.target.value })
                      }
                    >
                      {products.map((pp) => (
                        <option key={pp.id} value={pp.id}>
                          {pp.name}
                        </option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        className="text-right"
                        value={line.qty}
                        onChange={(e) =>
                          updatePlanLine(line.id, {
                            qty: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="text-xs text-[var(--color-muted)] w-8">
                        {p?.unit ?? ""}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removePlanLine(line.id)}
                    >
                      ✕
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => {
                  const next = products[0];
                  if (next) addPlanLine(next.id, 1);
                }}
              >
                + Позиция
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card
        title="Потребность в материалах"
        actions={
          rows.length > 0 ? (
            hasShortage ? (
              <Badge tone="warning">
                Не хватает на {fmtMoney(totalShortageCost)}
              </Badge>
            ) : (
              <Badge tone="success">Материала хватает</Badge>
            )
          ) : null
        }
      >
        {rows.length === 0 ? (
          <Empty>
            Заполните план производства — здесь появится сводка по материалам.
          </Empty>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full text-sm">
              <thead className="text-[var(--color-muted)] text-xs uppercase tracking-wide">
                <tr className="border-b border-[var(--color-line)]">
                  <th className="text-left py-2 pr-3 font-medium">Материал</th>
                  <th className="text-right py-2 pr-3 font-medium w-32">
                    Нужно
                  </th>
                  <th className="text-right py-2 pr-3 font-medium w-32">
                    На складе
                  </th>
                  <th className="text-right py-2 pr-3 font-medium w-32">
                    Дефицит
                  </th>
                  <th className="text-right py-2 pr-3 font-medium w-32">
                    Стоимость
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = matById(r.materialId);
                  if (!m) return null;
                  return (
                    <tr
                      key={r.materialId}
                      className="border-b border-[var(--color-line)]/60 last:border-0"
                    >
                      <td className="py-2 pr-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs text-[var(--color-muted)]">
                            {fmtMoney(m.pricePerUnit)} / {m.unit}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtNumber(r.required)} {m.unit}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtNumber(r.stock)} {m.unit}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.shortage > 0 ? (
                          <Badge tone="danger">
                            −{fmtNumber(r.shortage)} {m.unit}
                          </Badge>
                        ) : (
                          <Badge tone="success">ОК</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {fmtMoney(r.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--color-line)]">
                  <td className="py-2 pr-3 font-semibold">Итого</td>
                  <td colSpan={3}></td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {fmtMoney(totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
