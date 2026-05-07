import { productionBomKey } from "@/lib/bomKey";
import type { Consumable, ConsumableBomLine } from "@/lib/types";

/** Поля очереди производства, нужные для расчёта расходников */
export interface ProductionItemLike {
  matchedSlug?: string | null;
  matchedName?: string | null;
  name: string;
  qty: number;
}

/** Строка плана на карточке: учёт всей очереди (фронт, без записи на сервер). */
export interface ConsumableDisplayLine {
  consumableId: string;
  name: string;
  unit: string;
  /** Сколько уйдёт на эту карточку (группу) */
  requiredGroup: number;
  /** Сколько уйдёт по всей очереди «На производство» */
  demandTotal: number;
  /** Фактический остаток на складе */
  stock: number;
  /** Остаток после вычета всей очереди: stock − demandTotal */
  afterQueue: number;
  /** Не хватает на всю очередь, max(0, demandTotal − stock) */
  shortage: number;
  /** Остаток после очереди > 0, но низкий — «скоро закончится» */
  warnSoon: boolean;
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

/**
 * План расходников для одной карточки: потребность группы + глобально по очереди.
 * `afterQueue` / `shortage` / `warnSoon` считаются от суммарной потребности всей очереди.
 */
export function buildConsumableLinesForGroup(
  groupItems: ProductionItemLike[],
  allQueueItems: ProductionItemLike[],
  catalogConsumableBoms: Record<string, ConsumableBomLine[]>,
  consumables: Consumable[]
): ConsumableDisplayLine[] {
  const globalMap = demandForItems(allQueueItems, catalogConsumableBoms);
  const groupMap = demandForItems(groupItems, catalogConsumableBoms);
  const byId = new Map(consumables.map((c) => [c.id, c]));
  const rows: ConsumableDisplayLine[] = [];

  for (const [consumableId, requiredGroup] of groupMap) {
    const c = byId.get(consumableId);
    if (!c) continue;
    const demandTotal = globalMap.get(consumableId) ?? requiredGroup;
    const stock = Number(c.stock) || 0;
    const afterQueue = stock - demandTotal;
    const shortage = afterQueue < 0 ? -afterQueue : 0;
    const minStock = Number(c.minStock) || 0;
    const warnSoon =
      shortage === 0 &&
      afterQueue > 0 &&
      ((minStock > 0 && afterQueue <= minStock) ||
        (minStock <= 0 &&
          stock > 0 &&
          afterQueue / stock <= 0.15));

    rows.push({
      consumableId,
      name: c.name,
      unit: c.unit,
      requiredGroup,
      demandTotal,
      stock,
      afterQueue,
      shortage,
      warnSoon,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return rows;
}
