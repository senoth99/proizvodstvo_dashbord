import { NextRequest, NextResponse } from "next/server";
import { findBestMatch } from "@/lib/match";
import { proxyImage } from "@/lib/img";
import { getCatalog } from "@/lib/server/catalog";
import {
  clearAll,
  getState,
  ingest,
  type IncomingItem,
  type ProductionItem,
} from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, PATCH, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
} as const;

const json = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function shapeItem(it: ProductionItem): ProductionItem {
  return { ...it, imageUrl: proxyImage(it.imageUrl ?? null) };
}

export async function GET() {
  const state = await getState();
  return json({
    ok: true,
    ...state,
    items: state.items.map(shapeItem),
  });
}

interface IncomingPayload {
  items?: unknown;
  products?: unknown;
  data?: unknown;
  list?: unknown;
  replace?: unknown;
  source?: unknown;
}

const ITEMS_KEYS = ["items", "products", "data", "list"] as const;

function parseItems(body: unknown): IncomingItem[] | null {
  if (Array.isArray(body)) return body as IncomingItem[];
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  for (const key of ITEMS_KEYS) {
    const v = obj[key];
    if (Array.isArray(v)) return v as IncomingItem[];
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length && typeof v[0] === "object")
      return v as IncomingItem[];
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const items = parseItems(body);
  if (!items) {
    return json(
      {
        ok: false,
        error:
          "expected JSON array OR object with one of keys: items / products / data / list. Each entry must have at least { name }.",
      },
      { status: 400 }
    );
  }

  const source =
    body && typeof body === "object" && "source" in body
      ? String((body as IncomingPayload).source ?? "")
      : undefined;

  const catalog = await getCatalog().catch(() => []);

  const enriched: IncomingItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const raw = it as IncomingItem;
    const name = String(raw.name ?? "").trim();
    if (!name) continue;
    const m = findBestMatch(name, catalog);
    enriched.push({
      ...raw,
      name,
      source,
      imageUrl: raw.imageUrl ?? m?.imageUrl ?? undefined,
      matchedName: m?.name ?? null,
      matchedSlug: m?.slug ?? null,
      matchScore: m?.score ?? null,
    });
  }

  try {
    const result = await ingest(enriched, { replace: true });
    return json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/production POST] ingest failed:", e);
    return json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  await clearAll();
  return json({ ok: true });
}
