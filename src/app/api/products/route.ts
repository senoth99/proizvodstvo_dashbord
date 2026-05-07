import { NextResponse } from "next/server";
import { fullImage } from "@/lib/match";
import { getCatalog, getCatalogMeta } from "@/lib/server/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
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

function shape(catalog: Awaited<ReturnType<typeof getCatalog>>) {
  return catalog.map((p) => ({
    id: String(p.id),
    slug: p.slug ?? null,
    name: p.name,
    category: p.category?.name ?? null,
    imageUrl: fullImage(p.images?.[0] ?? null),
  }));
}

export async function GET() {
  const data = await getCatalog();
  return json({
    ...getCatalogMeta(),
    items: shape(data),
  });
}

export async function POST() {
  const data = await getCatalog(true);
  return json({
    ...getCatalogMeta(),
    items: shape(data),
  });
}
