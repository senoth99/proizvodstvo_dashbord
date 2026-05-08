import { normalizeBomKey } from "@/lib/bomKey";
import type { BomLine, Material } from "@/lib/types";

/** Поля очереди производства для расчёта */
export interface ProductionItemLike {
  matchedSlug?: string | null;
  matchedName?: string | null;
  name: string;
  qty: number;
}

/** Прогноз по материалу на карточке очереди (фронт). */
export interface QueueMaterialLine {
  materialId: string;
  name: string;
  unit: string;
  requiredGroup: number;
  demandTotal: number;
  stock: number;
  afterQueue: number;
  shortage: number;
  warnSoon: boolean;
}

function materialBomForItem(
  it: ProductionItemLike,
  catalogBoms: Record<string, BomLine[]>
): BomLine[] | null {
  const slug = it.matchedSlug?.toString().trim();
  if (slug) {
    const a = catalogBoms[slug];
    if (a?.length) return a;
  }
  const k1 = normalizeBomKey(it.matchedName ?? it.name);
  if (k1) {
    const a = catalogBoms[k1];
    if (a?.length) return a;
  }
  const k2 = normalizeBomKey(it.name);
  if (k2 && k2 !== k1) {
    const a = catalogBoms[k2];
    if (a?.length) return a;
  }
  return null;
}

function demandForItems(
  productionItems: ProductionItemLike[],
  catalogBoms: Record<string, BomLine[]>
): Map<string, number> {
  const demand = new Map<string, number>();
  for (const it of productionItems) {
    const lines = materialBomForItem(it, catalogBoms);
    if (!lines?.length) continue;
    const units = Number(it.qty) || 0;
    if (units <= 0) continue;
    for (const line of lines) {
      const mid = line.materialId;
      const per = Number(line.qtyPerUnit);
      if (!mid || !Number.isFinite(per) || per <= 0) continue;
      demand.set(mid, (demand.get(mid) ?? 0) + per * units);
    }
  }
  return demand;
}

export function buildQueueMaterialLinesForGroup(
  groupItems: ProductionItemLike[],
  allQueueItems: ProductionItemLike[],
  catalogBoms: Record<string, BomLine[]>,
  materials: Material[]
): QueueMaterialLine[] {
  const globalMap = demandForItems(allQueueItems, catalogBoms);
  const groupMap = demandForItems(groupItems, catalogBoms);
  const byId = new Map(materials.map((m) => [m.id, m]));
  const rows: QueueMaterialLine[] = [];

  for (const [materialId, requiredGroup] of groupMap) {
    const mat = byId.get(materialId);
    if (!mat) continue;
    const demandTotal = globalMap.get(materialId) ?? requiredGroup;
    const stock = Number(mat.stock) || 0;
    const afterQueue = stock - demandTotal;
    const shortage = afterQueue < 0 ? -afterQueue : 0;
    const minStock = Number(mat.minStock) || 0;
    const warnSoon =
      shortage === 0 &&
      afterQueue > 0 &&
      ((minStock > 0 && afterQueue <= minStock) ||
        (minStock <= 0 && stock > 0 && afterQueue / stock <= 0.15));

    rows.push({
      materialId,
      name: mat.name,
      unit: mat.unit,
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

export function totalQueueMaterialDemand(
  productionItems: ProductionItemLike[],
  catalogBoms: Record<string, BomLine[]>
): Map<string, number> {
  return demandForItems(productionItems, catalogBoms);
}
