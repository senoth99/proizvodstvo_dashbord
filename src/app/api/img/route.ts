import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ALLOWED_IMAGE_HOSTS } from "@/lib/img";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_DIR = path.join(process.cwd(), ".data", "img-cache");

const LONG_CACHE = "public, max-age=31536000, immutable";

const inflight = new Map<string, Promise<{ buf: Buffer; type: string }>>();

function keyOf(url: string): string {
  return createHash("sha1").update(url).digest("hex");
}

async function readCache(
  key: string
): Promise<{ buf: Buffer; type: string } | null> {
  try {
    const meta = JSON.parse(
      await fs.readFile(path.join(CACHE_DIR, `${key}.meta.json`), "utf8")
    ) as { type?: string };
    const buf = await fs.readFile(path.join(CACHE_DIR, `${key}.bin`));
    return { buf, type: meta.type || "application/octet-stream" };
  } catch {
    return null;
  }
}

async function writeCache(key: string, buf: Buffer, type: string) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, `${key}.bin`), buf);
  await fs.writeFile(
    path.join(CACHE_DIR, `${key}.meta.json`),
    JSON.stringify({ type }),
    "utf8"
  );
}

async function fetchAndCache(
  key: string,
  url: string
): Promise<{ buf: Buffer; type: string }> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      throw new Error("upstream " + r.status);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get("content-type") ?? "application/octet-stream";
    await writeCache(key, buf, type);
    return { buf, type };
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.host)) {
    return new NextResponse("host not allowed", { status: 403 });
  }
  const key = keyOf(url);
  const etag = `"${key}"`;

  const ifNone = req.headers.get("if-none-match");
  if (ifNone && ifNone === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { "cache-control": LONG_CACHE, etag },
    });
  }

  let entry = await readCache(key);
  if (!entry) {
    try {
      entry = await fetchAndCache(key, url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[/api/img] fetch failed:", msg);
      return new NextResponse(msg, { status: 502 });
    }
  }

  const body = new Uint8Array(entry.buf);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": entry.type,
      "cache-control": LONG_CACHE,
      etag,
    },
  });
}
