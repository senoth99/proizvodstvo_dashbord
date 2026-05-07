import { NextRequest, NextResponse } from "next/server";
import { patchItem, removeItem, type ItemPatch } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "PATCH, DELETE, OPTIONS",
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

export async function DELETE(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ok = await removeItem(id);
  return json({ ok });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let body: ItemPatch;
  try {
    body = (await req.json()) as ItemPatch;
  } catch {
    return json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const result = await patchItem(id, body);
  if (!result) return json({ ok: false, error: "not found" }, { status: 404 });
  return json({ ok: true, item: result });
}
