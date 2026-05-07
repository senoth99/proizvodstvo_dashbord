"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { BomLine, Consumable, ConsumableBomLine, Material } from "./types";

interface State {
  // ── server-synced ─────────────────────────────────────────
  materials: Material[];
  consumables: Consumable[];
  catalogBoms: Record<string, BomLine[]>;
  catalogConsumableBoms: Record<string, ConsumableBomLine[]>;
  catalogManualCosts: Record<string, number>;
  catalogHidden: Record<string, boolean>;
  catalogStock: Record<string, number>;

  // ── sync flags ────────────────────────────────────────────
  _hydrated: boolean;
  _rev: number;

  // ── actions ───────────────────────────────────────────────
  addMaterial: (m: Omit<Material, "id">) => string;
  updateMaterial: (id: string, patch: Partial<Omit<Material, "id">>) => void;
  removeMaterial: (id: string) => void;

  addConsumable: (c: Omit<Consumable, "id">) => string;
  updateConsumable: (id: string, patch: Partial<Omit<Consumable, "id">>) => void;
  removeConsumable: (id: string) => void;

  setCatalogBom: (key: string, bom: BomLine[]) => void;
  setCatalogConsumableBom: (key: string, bom: ConsumableBomLine[]) => void;
  setCatalogManualCost: (key: string, cost: number | null) => void;
  setCatalogHidden: (key: string, hidden: boolean) => void;
  setCatalogStock: (key: string, qty: number) => void;
  addCatalogStock: (key: string, delta: number) => void;
}

export const useStore = create<State>()((set) => ({
  materials: [],
  consumables: [],
  catalogBoms: {},
  catalogConsumableBoms: {},
  catalogManualCosts: {},
  catalogHidden: {},
  catalogStock: {},

  _hydrated: false,
  _rev: 0,

  addMaterial: (m) => {
    const id = nanoid(8);
    set((s) => ({ materials: [...s.materials, { id, ...m }] }));
    return id;
  },
  updateMaterial: (id, patch) =>
    set((s) => ({
      materials: s.materials.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    })),
  removeMaterial: (id) =>
    set((s) => ({
      materials: s.materials.filter((m) => m.id !== id),
      catalogBoms: stripMaterialFromBoms(s.catalogBoms, id),
    })),

  addConsumable: (c) => {
    const id = nanoid(8);
    set((s) => ({ consumables: [...s.consumables, { id, ...c }] }));
    return id;
  },
  updateConsumable: (id, patch) =>
    set((s) => ({
      consumables: s.consumables.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    })),
  removeConsumable: (id) =>
    set((s) => ({
      consumables: s.consumables.filter((c) => c.id !== id),
      catalogConsumableBoms: stripConsumableFromBoms(
        s.catalogConsumableBoms,
        id
      ),
    })),

  setCatalogBom: (key, bom) =>
    set((s) => {
      const next = { ...s.catalogBoms };
      if (!Array.isArray(bom) || bom.length === 0) delete next[key];
      else next[key] = bom;
      return { catalogBoms: next };
    }),

  setCatalogConsumableBom: (key, bom) =>
    set((s) => {
      const next = { ...s.catalogConsumableBoms };
      if (!Array.isArray(bom) || bom.length === 0) delete next[key];
      else next[key] = bom;
      return { catalogConsumableBoms: next };
    }),

  setCatalogManualCost: (key, cost) =>
    set((s) => {
      const next = { ...s.catalogManualCosts };
      if (cost == null || !Number.isFinite(cost) || cost <= 0) delete next[key];
      else next[key] = cost;
      return { catalogManualCosts: next };
    }),

  setCatalogHidden: (key, hidden) =>
    set((s) => {
      const next = { ...s.catalogHidden };
      if (hidden) next[key] = true;
      else delete next[key];
      return { catalogHidden: next };
    }),

  setCatalogStock: (key, qty) =>
    set((s) => {
      const next = { ...s.catalogStock };
      if (!Number.isFinite(qty) || qty <= 0) delete next[key];
      else next[key] = qty;
      return { catalogStock: next };
    }),

  addCatalogStock: (key, delta) =>
    set((s) => {
      const next = { ...s.catalogStock };
      const cur = Number(next[key]) || 0;
      const v = cur + (Number(delta) || 0);
      if (!Number.isFinite(v) || v <= 0) delete next[key];
      else next[key] = v;
      return { catalogStock: next };
    }),
}));

function stripMaterialFromBoms(
  boms: Record<string, BomLine[]>,
  materialId: string
): Record<string, BomLine[]> {
  const next: Record<string, BomLine[]> = {};
  for (const [k, lines] of Object.entries(boms)) {
    const filtered = (lines ?? []).filter((l) => l.materialId !== materialId);
    if (filtered.length > 0) next[k] = filtered;
  }
  return next;
}

function stripConsumableFromBoms(
  boms: Record<string, ConsumableBomLine[]>,
  consumableId: string
): Record<string, ConsumableBomLine[]> {
  const next: Record<string, ConsumableBomLine[]> = {};
  for (const [k, lines] of Object.entries(boms)) {
    const filtered = (lines ?? []).filter(
      (l) => l.consumableId !== consumableId
    );
    if (filtered.length > 0) next[k] = filtered;
  }
  return next;
}

// ────────────────────────────────────────────────────────────
// Server sync (singleton, безопасно вызывается многократно)
// ────────────────────────────────────────────────────────────

const POLL_MS = 5_000;
const PUSH_DEBOUNCE_MS = 250;

interface ServerPayload {
  materials: Material[];
  consumables: Consumable[];
  catalogBoms: Record<string, BomLine[]>;
  catalogConsumableBoms: Record<string, ConsumableBomLine[]>;
  catalogManualCosts: Record<string, number>;
  catalogHidden: Record<string, boolean>;
  catalogStock: Record<string, number>;
}

function serialize(s: ServerPayload): string {
  return JSON.stringify({
    materials: s.materials,
    consumables: s.consumables,
    catalogBoms: s.catalogBoms,
    catalogConsumableBoms: s.catalogConsumableBoms,
    catalogManualCosts: s.catalogManualCosts,
    catalogHidden: s.catalogHidden,
    catalogStock: s.catalogStock,
  });
}

let lastSyncedJson = "";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function pull() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.rev !== "number") return;
    const cur = useStore.getState();

    // Никаких более старых ревизий не применяем.
    if (cur._hydrated && data.rev <= cur._rev) return;

    const payload: ServerPayload = {
      materials: Array.isArray(data.materials) ? data.materials : [],
      consumables: Array.isArray(data.consumables) ? data.consumables : [],
      catalogBoms:
        data.catalogBoms && typeof data.catalogBoms === "object"
          ? data.catalogBoms
          : {},
      catalogConsumableBoms:
        data.catalogConsumableBoms &&
        typeof data.catalogConsumableBoms === "object"
          ? data.catalogConsumableBoms
          : {},
      catalogManualCosts:
        data.catalogManualCosts && typeof data.catalogManualCosts === "object"
          ? data.catalogManualCosts
          : {},
      catalogHidden:
        data.catalogHidden && typeof data.catalogHidden === "object"
          ? data.catalogHidden
          : {},
      catalogStock:
        data.catalogStock && typeof data.catalogStock === "object"
          ? data.catalogStock
          : {},
    };
    lastSyncedJson = serialize(payload);
    useStore.setState({ ...payload, _rev: data.rev, _hydrated: true });
  } catch (e) {
    console.error("[state pull] failed", e);
  }
}

async function push(serialized: string) {
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: serialized,
    });
    if (!res.ok) {
      console.error("[state push] HTTP", res.status);
      return;
    }
    const data = await res.json();
    if (typeof data.rev === "number") {
      useStore.setState({ _rev: data.rev });
    }
  } catch (e) {
    console.error("[state push] failed", e);
  }
}

export function ensureStateSync(): void {
  if (typeof window === "undefined" || started) return;
  started = true;

  void pull();
  setInterval(() => {
    void pull();
  }, POLL_MS);

  useStore.subscribe((state) => {
    if (!state._hydrated) return;
    const ser = serialize(state);
    if (ser === lastSyncedJson) return;
    lastSyncedJson = ser;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(ser), PUSH_DEBOUNCE_MS);
  });
}
