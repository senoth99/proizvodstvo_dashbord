"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  BomLine,
  IntakeItem,
  IntakeStatus,
  Material,
  PlanLine,
  Product,
} from "./types";

interface State {
  materials: Material[];
  products: Product[];
  plan: PlanLine[];
  intake: IntakeItem[];
  catalogBoms: Record<string, BomLine[]>;
  catalogManualCosts: Record<string, number>;
  catalogHidden: Record<string, boolean>;
  catalogStock: Record<string, number>;

  addMaterial: (m: Omit<Material, "id">) => string;
  updateMaterial: (id: string, patch: Partial<Omit<Material, "id">>) => void;
  removeMaterial: (id: string) => void;

  addProduct: (p: Omit<Product, "id" | "bom"> & { bom?: BomLine[] }) => string;
  updateProduct: (id: string, patch: Partial<Omit<Product, "id">>) => void;
  removeProduct: (id: string) => void;
  addBomLine: (productId: string, line: BomLine) => void;
  updateBomLine: (productId: string, index: number, patch: Partial<BomLine>) => void;
  removeBomLine: (productId: string, index: number) => void;

  addPlanLine: (productId: string, qty?: number) => void;
  updatePlanLine: (id: string, patch: Partial<Omit<PlanLine, "id">>) => void;
  removePlanLine: (id: string) => void;
  clearPlan: () => void;

  addIntake: (item: Omit<IntakeItem, "id" | "acceptedAt" | "status"> & {
    status?: IntakeStatus;
    acceptedAt?: string;
  }) => string;
  updateIntake: (id: string, patch: Partial<Omit<IntakeItem, "id">>) => void;
  removeIntake: (id: string) => void;
  setIntakeStatus: (id: string, status: IntakeStatus) => void;

  setCatalogBom: (key: string, bom: BomLine[]) => void;
  setCatalogManualCost: (key: string, cost: number | null) => void;
  setCatalogHidden: (key: string, hidden: boolean) => void;
  setCatalogStock: (key: string, qty: number) => void;
  addCatalogStock: (key: string, delta: number) => void;

  resetAll: () => void;
}

const seed = () => {
  const flour: Material = {
    id: nanoid(8),
    name: "Мука пшеничная",
    unit: "кг",
    pricePerUnit: 60,
    stock: 50,
  };
  const sugar: Material = {
    id: nanoid(8),
    name: "Сахар",
    unit: "кг",
    pricePerUnit: 80,
    stock: 20,
  };
  const eggs: Material = {
    id: nanoid(8),
    name: "Яйца",
    unit: "шт",
    pricePerUnit: 12,
    stock: 200,
  };
  const butter: Material = {
    id: nanoid(8),
    name: "Масло сливочное",
    unit: "кг",
    pricePerUnit: 700,
    stock: 5,
  };

  const cake: Product = {
    id: nanoid(8),
    name: "Кекс ванильный",
    unit: "шт",
    bom: [
      { materialId: flour.id, qtyPerUnit: 0.25 },
      { materialId: sugar.id, qtyPerUnit: 0.15 },
      { materialId: eggs.id, qtyPerUnit: 2 },
      { materialId: butter.id, qtyPerUnit: 0.1 },
    ],
  };

  return {
    materials: [flour, sugar, eggs, butter],
    products: [cake],
    plan: [{ id: nanoid(8), productId: cake.id, qty: 50 }] as PlanLine[],
    intake: [] as IntakeItem[],
    catalogBoms: {} as Record<string, BomLine[]>,
    catalogManualCosts: {} as Record<string, number>,
    catalogHidden: {} as Record<string, boolean>,
    catalogStock: {} as Record<string, number>,
  };
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...seed(),

      addMaterial: (m) => {
        const id = nanoid(8);
        set((s) => ({ materials: [...s.materials, { id, ...m }] }));
        return id;
      },
      updateMaterial: (id, patch) =>
        set((s) => ({
          materials: s.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMaterial: (id) =>
        set((s) => ({
          materials: s.materials.filter((m) => m.id !== id),
          products: s.products.map((p) => ({
            ...p,
            bom: p.bom.filter((l) => l.materialId !== id),
          })),
        })),

      addProduct: (p) => {
        const id = nanoid(8);
        set((s) => ({
          products: [...s.products, { id, bom: [], ...p }],
        }));
        return id;
      },
      updateProduct: (id, patch) =>
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removeProduct: (id) =>
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          plan: s.plan.filter((pl) => pl.productId !== id),
        })),
      addBomLine: (productId, line) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, bom: [...p.bom, line] } : p
          ),
        })),
      updateBomLine: (productId, index, patch) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  bom: p.bom.map((l, i) => (i === index ? { ...l, ...patch } : l)),
                }
              : p
          ),
        })),
      removeBomLine: (productId, index) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId
              ? { ...p, bom: p.bom.filter((_, i) => i !== index) }
              : p
          ),
        })),

      addPlanLine: (productId, qty = 1) =>
        set((s) => ({
          plan: [...s.plan, { id: nanoid(8), productId, qty }],
        })),
      updatePlanLine: (id, patch) =>
        set((s) => ({
          plan: s.plan.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removePlanLine: (id) =>
        set((s) => ({
          plan: s.plan.filter((l) => l.id !== id),
        })),
      clearPlan: () => set({ plan: [] }),

      addIntake: (item) => {
        const id = nanoid(8);
        const acceptedAt = item.acceptedAt ?? new Date().toISOString();
        const status: IntakeStatus = item.status ?? "accepted";
        set((s) => ({
          intake: [
            { id, acceptedAt, status, ...item },
            ...s.intake,
          ],
        }));
        return id;
      },
      updateIntake: (id, patch) =>
        set((s) => ({
          intake: s.intake.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      removeIntake: (id) =>
        set((s) => ({
          intake: s.intake.filter((i) => i.id !== id),
        })),
      setIntakeStatus: (id, status) =>
        set((s) => ({
          intake: s.intake.map((i) => (i.id === id ? { ...i, status } : i)),
        })),

      setCatalogBom: (key, bom) =>
        set((s) => {
          const next = { ...s.catalogBoms };
          if (bom.length === 0) {
            delete next[key];
          } else {
            next[key] = bom;
          }
          return { catalogBoms: next };
        }),

      setCatalogManualCost: (key, cost) =>
        set((s) => {
          const next = { ...s.catalogManualCosts };
          if (cost == null || !Number.isFinite(cost) || cost <= 0) {
            delete next[key];
          } else {
            next[key] = cost;
          }
          return { catalogManualCosts: next };
        }),

      setCatalogHidden: (key, hidden) =>
        set((s) => {
          const next = { ...s.catalogHidden };
          if (hidden) {
            next[key] = true;
          } else {
            delete next[key];
          }
          return { catalogHidden: next };
        }),

      setCatalogStock: (key, qty) =>
        set((s) => {
          const next = { ...s.catalogStock };
          if (!Number.isFinite(qty) || qty <= 0) {
            delete next[key];
          } else {
            next[key] = qty;
          }
          return { catalogStock: next };
        }),

      addCatalogStock: (key, delta) =>
        set((s) => {
          const next = { ...s.catalogStock };
          const cur = Number(next[key]) || 0;
          const v = cur + (Number(delta) || 0);
          if (!Number.isFinite(v) || v <= 0) {
            delete next[key];
          } else {
            next[key] = v;
          }
          return { catalogStock: next };
        }),

      resetAll: () => set(seed()),
    }),
    {
      name: "proizvodstvo-store-v4",
      version: 4,
      migrate: (persisted) => {
        const p = (persisted as Partial<State> | undefined) ?? {};
        return {
          ...p,
          catalogBoms:
            p.catalogBoms && typeof p.catalogBoms === "object"
              ? p.catalogBoms
              : {},
          catalogManualCosts:
            p.catalogManualCosts && typeof p.catalogManualCosts === "object"
              ? p.catalogManualCosts
              : {},
          catalogHidden:
            p.catalogHidden && typeof p.catalogHidden === "object"
              ? p.catalogHidden
              : {},
          catalogStock:
            p.catalogStock && typeof p.catalogStock === "object"
              ? p.catalogStock
              : {},
        } as State;
      },
      merge: (persisted, current) => {
        const p = (persisted as Partial<State> | undefined) ?? {};
        return {
          ...current,
          ...p,
          catalogBoms:
            p.catalogBoms && typeof p.catalogBoms === "object"
              ? p.catalogBoms
              : current.catalogBoms ?? {},
          catalogManualCosts:
            p.catalogManualCosts && typeof p.catalogManualCosts === "object"
              ? p.catalogManualCosts
              : current.catalogManualCosts ?? {},
          catalogHidden:
            p.catalogHidden && typeof p.catalogHidden === "object"
              ? p.catalogHidden
              : current.catalogHidden ?? {},
          catalogStock:
            p.catalogStock && typeof p.catalogStock === "object"
              ? p.catalogStock
              : current.catalogStock ?? {},
        };
      },
    }
  )
);
