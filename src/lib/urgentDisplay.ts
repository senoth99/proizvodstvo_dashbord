/** Единицы «срочно» по строке очереди (с учётом лимита из urgentTargets). */
export function lineUrgentQty(it: {
  qty: number;
  urgent?: boolean;
  urgentQty?: number;
}): number {
  const uq = it.urgentQty;
  if (uq != null && Number.isFinite(uq) && uq > 0) return uq;
  return it.urgent ? Math.max(0, Number(it.qty) || 0) : 0;
}
