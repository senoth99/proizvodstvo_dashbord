import { NextRequest, NextResponse } from "next/server";
import {
  getStateDb,
  putStateDb,
  type AppStateShape,
} from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, PUT, OPTIONS",
  "access-control-allow-headers": "content-type",
} as const;

const json = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const data = await getStateDb();
    return json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/state GET] failed:", e);
    return json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const b = (body ?? {}) as Partial<AppStateShape>;
  const safe: AppStateShape = {
    materials: Array.isArray(b.materials) ? b.materials : [],
    consumables: Array.isArray(b.consumables) ? b.consumables : [],
    catalogBoms:
      b.catalogBoms && typeof b.catalogBoms === "object" ? b.catalogBoms : {},
    catalogConsumableBoms:
      b.catalogConsumableBoms &&
      typeof b.catalogConsumableBoms === "object"
        ? b.catalogConsumableBoms
        : {},
    catalogManualCosts:
      b.catalogManualCosts && typeof b.catalogManualCosts === "object"
        ? b.catalogManualCosts
        : {},
    catalogHidden:
      b.catalogHidden && typeof b.catalogHidden === "object"
        ? b.catalogHidden
        : {},
    catalogStock:
      b.catalogStock && typeof b.catalogStock === "object"
        ? b.catalogStock
        : {},
  };
  try {
    const data = await putStateDb(safe);
    return json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/state PUT] failed:", e);
    return json({ ok: false, error: msg }, { status: 500 });
  }
}
