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

function normalize(parsed: Partial<AppStateFile>): AppStateFile {
  return {
    rev: typeof parsed.rev === "number" ? parsed.rev : 0,
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date(0).toISOString(),
    materials: Array.isArray(parsed.materials) ? parsed.materials : [],
    catalogBoms:
      parsed.catalogBoms && typeof parsed.catalogBoms === "object"
        ? parsed.catalogBoms
        : {},
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
    return normalize(JSON.parse(raw) as Partial<AppStateFile>);
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
