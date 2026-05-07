import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface ProductionItem {
  id: string;
  name: string;
  qty: number;
  size?: string;
  imageUrl?: string | null;
  matchedName?: string | null;
  matchedSlug?: string | null;
  matchScore?: number | null;
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "production.json");

interface FileShape {
  items: ProductionItem[];
  lastPostAt: string | null;
}

const empty: FileShape = { items: [], lastPostAt: null };

const g = globalThis as unknown as { __prodLock?: Promise<void> };
g.__prodLock ??= Promise.resolve();

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readFile(): Promise<FileShape> {
  await ensureFile();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<FileShape>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      lastPostAt: parsed.lastPostAt ?? null,
    };
  } catch {
    return { ...empty };
  }
}

async function writeFile(state: FileShape) {
  await ensureFile();
  await fs.writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
}

async function withLock<T>(fn: (state: FileShape) => Promise<T> | T): Promise<T> {
  const prev = g.__prodLock!;
  let release: () => void = () => {};
  const next = new Promise<void>((res) => (release = res));
  g.__prodLock = prev.then(() => next);
  await prev;
  try {
    const state = await readFile();
    const result = await fn(state);
    await writeFile(state);
    return result;
  } finally {
    release();
  }
}

export async function getState(): Promise<FileShape> {
  return readFile();
}

export interface ItemPatch {
  name?: string;
  qty?: number;
  size?: string;
  notes?: string;
  imageUrl?: string | null;
  matchedName?: string | null;
  matchedSlug?: string | null;
  matchScore?: number | null;
}

const keyOf = (name: string, size?: string) =>
  `${(name || "").trim().toLowerCase()}::${(size || "").trim().toLowerCase()}`;

export interface IncomingItem {
  name: string;
  qty?: number | string;
  size?: string;
  notes?: string;
  imageUrl?: string;
  matchedName?: string | null;
  matchedSlug?: string | null;
  matchScore?: number | null;
  source?: string;
}

export interface IngestResult {
  added: number;
  merged: number;
  total: number;
}

export async function ingest(
  incoming: IncomingItem[],
  opts: { replace?: boolean } = {}
): Promise<IngestResult> {
  return withLock((state) => {
    if (opts.replace) state.items = [];
    let added = 0;
    let merged = 0;
    const index = new Map<string, ProductionItem>();
    for (const it of state.items) index.set(keyOf(it.name, it.size), it);
    const now = new Date().toISOString();
    for (const raw of incoming) {
      const name = (raw.name ?? "").toString().trim();
      if (!name) continue;
      const qty = Number(raw.qty);
      const finalQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const size = raw.size?.toString().trim() || undefined;
      const k = keyOf(name, size);
      const existing = index.get(k);
      if (existing) {
        existing.qty += finalQty;
        existing.updatedAt = now;
        if (raw.notes) existing.notes = raw.notes;
        if (raw.imageUrl !== undefined) existing.imageUrl = raw.imageUrl;
        if (raw.matchedName !== undefined) existing.matchedName = raw.matchedName;
        if (raw.matchedSlug !== undefined) existing.matchedSlug = raw.matchedSlug;
        if (raw.matchScore !== undefined) existing.matchScore = raw.matchScore;
        merged += 1;
      } else {
        const item: ProductionItem = {
          id: randomUUID().slice(0, 12),
          name,
          qty: finalQty,
          size,
          notes: raw.notes,
          imageUrl: raw.imageUrl ?? null,
          matchedName: raw.matchedName ?? null,
          matchedSlug: raw.matchedSlug ?? null,
          matchScore: raw.matchScore ?? null,
          source: raw.source,
          createdAt: now,
          updatedAt: now,
        };
        state.items.push(item);
        index.set(k, item);
        added += 1;
      }
    }
    state.lastPostAt = now;
    return { added, merged, total: state.items.length };
  });
}

export async function patchItem(id: string, patch: ItemPatch): Promise<ProductionItem | null> {
  return withLock((state) => {
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const cur = state.items[idx];
    const next: ProductionItem = {
      ...cur,
      ...patch,
      qty:
        patch.qty !== undefined && Number.isFinite(Number(patch.qty)) && Number(patch.qty) >= 0
          ? Number(patch.qty)
          : cur.qty,
      updatedAt: new Date().toISOString(),
    };
    state.items[idx] = next;
    return next;
  });
}

export async function removeItem(id: string): Promise<boolean> {
  return withLock((state) => {
    const before = state.items.length;
    state.items = state.items.filter((i) => i.id !== id);
    return state.items.length !== before;
  });
}

export async function clearAll(): Promise<void> {
  await withLock((state) => {
    state.items = [];
  });
}
