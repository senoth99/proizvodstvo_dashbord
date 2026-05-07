import { productionBomKey } from "@/lib/bomKey";
import type { Consumable, ConsumableBomLine } from "@/lib/types";

/** Поля очереди производства, нужные для расчёта расходников */
export interface ProductionItemLike {
  matchedSlug?: string | null;
  matchedName?: string | null;
  name: string;
  qty: number;
}

export interface PlannedConsumableLine {
  consumableId: string;
  name: string;
  unit: string;
  required: number;
  stock: number;
  balanceAfter: number;
  shortage: number;
}

function demandForItems(
  productionItems: ProductionItemLike[],
  catalogConsumableBoms: Record<string, ConsumableBomLine[]>
): Map<string, number> {
  const demand = new Map<string, number>();
  for (const it of productionItems) {
    const k = productionBomKey(it);
    const lines = catalogConsumableBoms[k];
    if (!lines?.length) continue;
    const units = Number(it.qty) || 0;
    if (units <= 0) continue;
    for (const line of lines) {
      const cid = line.consumableId;
      const per = Number(line.qtyPerUnit);
      if (!cid || !Number.isFinite(per) || per <= 0) continue;
      demand.set(cid, (demand.get(cid) ?? 0) + per * units);
    }
  }
  return demand;
}

export function planConsumablesForItems(
  productionItems: ProductionItemLike[],
  catalogConsumableBoms: Record<string, ConsumableBomLine[]>,
  consumables: Consumable[]
): PlannedConsumableLine[] {
  const demand = demandForItems(productionItems, catalogConsumableBoms);
  const byId = new Map(consumables.map((c) => [c.id, c]));
  const rows: PlannedConsumableLine[] = [];
  for (const [consumableId, required] of demand) {
    const c = byId.get(consumableId);
    if (!c) continue;
    const stock = Number(c.stock) || 0;
    const balanceAfter = stock - required;
    const shortage = balanceAfter < 0 ? -balanceAfter : 0;
    rows.push({
      consumableId,
      name: c.name,
      unit: c.unit,
      required,
      stock,
      balanceAfter,
      shortage,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return rows;
}
