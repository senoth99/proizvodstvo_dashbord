import { NextRequest, NextResponse } from "next/server";
import { setUrgentTarget } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
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

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const key =
    body && typeof body === "object" && "key" in body
      ? String((body as { key?: string }).key ?? "")
      : "";
  const qty =
    body && typeof body === "object" && "qty" in body
      ? Number((body as { qty?: number }).qty)
      : NaN;
  if (!key || !Number.isFinite(qty) || qty <= 0) {
    return json({ ok: false, error: "expected { key, qty > 0 }" }, { status: 400 });
  }
  await setUrgentTarget(key, qty);
  return json({ ok: true });
}

