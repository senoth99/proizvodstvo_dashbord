export type Unit =
  | "шт"
  | "кг"
  | "г"
  | "т"
  | "м"
  | "см"
  | "мм"
  | "м²"
  | "м³"
  | "л"
  | "мл"
  | "уп";

export const UNITS: Unit[] = [
  "шт",
  "кг",
  "г",
  "т",
  "м",
  "см",
  "мм",
  "м²",
  "м³",
  "л",
  "мл",
  "уп",
];

export interface Material {
  id: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  stock: number;
  minStock?: number;
  notes?: string;
}

export interface BomLine {
  materialId: string;
  qtyPerUnit: number;
}

export interface Consumable {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock?: number;
  notes?: string;
}

export interface ConsumableBomLine {
  consumableId: string;
  qtyPerUnit: number;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  bom: BomLine[];
  notes?: string;
}

export interface PlanLine {
  id: string;
  productId: string;
  qty: number;
}

export interface CalcRow {
  materialId: string;
  required: number;
  stock: number;
  shortage: number;
  cost: number;
}

export type IntakeStatus = "accepted" | "in_progress" | "done";

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  accepted: "Принято",
  in_progress: "В работе",
  done: "Готово",
};

export interface IntakeItem {
  id: string;
  productId?: string;
  title: string;
  qty: number;
  customer?: string;
  notes?: string;
  acceptedAt: string;
  status: IntakeStatus;
}
