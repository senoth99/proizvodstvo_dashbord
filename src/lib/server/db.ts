import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BomLine, Material } from "@/lib/types";

export interface AppStateShape {
  materials: Material[];
  catalogBoms: Record<string, BomLine[]>;
  catalogManualCosts: Record<string, number>;
  catalogHidden: Record<string, boolean>;
  catalogStock: Record<string, number>;
}

export interface AppStateFile extends AppStateShape {
  rev: number;
  updatedAt: string;
}

/** Старый формат state.json (расходники отдельно) — миграция при чтении. */
interface LegacyConsumableLine {
  consumableId?: string;
  qtyPerUnit?: number;
}

interface LegacyConsumable {
  id?: string;
  name?: string;
  unit?: string;
  stock?: number;
  minStock?: number;
  notes?: string;
}

function mergeBomLines(a: BomLine[], b: BomLine[]): BomLine[] {
  const m = new Map<string, number>();
  for (const l of [...a, ...b]) {
    const id = String(l.materialId || "").trim();
    const q = Number(l.qtyPerUnit);
    if (!id || !Number.isFinite(q) || q <= 0) continue;
    m.set(id, (m.get(id) ?? 0) + q);
  }
  return [...m.entries()].map(([materialId, qtyPerUnit]) => ({
    materialId,
    qtyPerUnit,
  }));
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "state.json");

const empty: AppStateFile = {
  rev: 0,
  updatedAt: new Date(0).toISOString(),
  materials: [],
  catalogBoms: {},
  catalogManualCosts: {},
  catalogHidden: {},
  catalogStock: {},
};

const g = globalThis as unknown as {
  __appLock?: Promise<void>;
  __appState?: AppStateFile;
};
g.__appLock ??= Promise.resolve();

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify(empty, null, 2), "utf8");
  }
}

function normalize(
  parsed: Partial<AppStateFile> & {
    consumables?: LegacyConsumable[];
    catalogConsumableBoms?: Record<string, LegacyConsumableLine[]>;
  }
): AppStateFile {
  let materials: Material[] = Array.isArray(parsed.materials)
    ? parsed.materials.map((m) => ({
        ...m,
        pricePerUnit:
          typeof m.pricePerUnit === "number" && Number.isFinite(m.pricePerUnit)
            ? m.pricePerUnit
            : 0,
        stock: typeof m.stock === "number" ? m.stock : 0,
      }))
    : [];

  let catalogBoms: Record<string, BomLine[]> =
    parsed.catalogBoms && typeof parsed.catalogBoms === "object"
      ? (parsed.catalogBoms as Record<string, BomLine[]>)
      : {};

  const legacyC = Array.isArray(parsed.consumables) ? parsed.consumables : [];
  const legacyCB =
    parsed.catalogConsumableBoms &&
    typeof parsed.catalogConsumableBoms === "object"
      ? parsed.catalogConsumableBoms
      : {};

  if (legacyC.length > 0 || Object.keys(legacyCB).length > 0) {
    const matIds = new Set(materials.map((m) => m.id));
    for (const c of legacyC) {
      const id = String(c.id || "").trim();
      if (!id || matIds.has(id)) continue;
      materials.push({
        id,
        name: String(c.name || "").trim() || id,
        unit: String(c.unit || "шт").trim() || "шт",
        stock: Number(c.stock) || 0,
        minStock: c.minStock != null ? Number(c.minStock) : undefined,
        notes: c.notes ? String(c.notes) : undefined,
        pricePerUnit: 0,
      });
      matIds.add(id);
    }

    for (const [key, lines] of Object.entries(legacyCB)) {
      const raw = Array.isArray(lines) ? lines : [];
      const conv: BomLine[] = [];
      for (const l of raw) {
        const mid = String(l.consumableId || "").trim();
        const q = Number(l.qtyPerUnit);
        if (!mid || !Number.isFinite(q) || q <= 0) continue;
        conv.push({ materialId: mid, qtyPerUnit: q });
      }
      if (conv.length === 0) continue;
      const cur = catalogBoms[key] ? [...catalogBoms[key]] : [];
      catalogBoms[key] = mergeBomLines(cur, conv);
    }
  }

  return {
    rev: typeof parsed.rev === "number" ? parsed.rev : 0,
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date(0).toISOString(),
    materials,
    catalogBoms,
    catalogManualCosts:
      parsed.catalogManualCosts && typeof parsed.catalogManualCosts === "object"
        ? parsed.catalogManualCosts
        : {},
    catalogHidden:
      parsed.catalogHidden && typeof parsed.catalogHidden === "object"
        ? parsed.catalogHidden
        : {},
    catalogStock:
      parsed.catalogStock && typeof parsed.catalogStock === "object"
        ? parsed.catalogStock
        : {},
  };
}

async function readFromDisk(): Promise<AppStateFile> {
  await ensureFile();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return normalize(JSON.parse(raw) as Parameters<typeof normalize>[0]);
  } catch {
    return { ...empty };
  }
}

async function writeToDisk(state: AppStateFile) {
  await ensureFile();
  await fs.writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
}

async function withLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = g.__appLock!;
  let release: () => void = () => {};
  const next = new Promise<void>((res) => (release = res));
  g.__appLock = prev.then(() => next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function getStateDb(): Promise<AppStateFile> {
  if (!g.__appState) g.__appState = await readFromDisk();
  return g.__appState;
}

export async function putStateDb(input: AppStateShape): Promise<AppStateFile> {
  return withLock(async () => {
    const cur = g.__appState ?? (await readFromDisk());
    const next: AppStateFile = {
      rev: (cur.rev ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      materials: input.materials,
      catalogBoms: input.catalogBoms,
      catalogManualCosts: input.catalogManualCosts,
      catalogHidden: input.catalogHidden,
      catalogStock: input.catalogStock,
    };
    await writeToDisk(next);
    g.__appState = next;
    return next;
  });
}
