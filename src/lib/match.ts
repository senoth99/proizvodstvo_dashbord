export const CATALOG_BASE = "https://api.cashercollection.com";

export function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(s: string): Set<string> {
  return new Set(
    normalizeName(s)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const denom = Math.min(A.size, B.size);
  return inter / denom;
}

export interface CatalogProduct {
  id: string | number;
  slug?: string;
  name: string;
  images?: string[];
  category?: { name?: string };
}

export interface MatchedProduct {
  id: string | number;
  slug?: string;
  name: string;
  imageUrl: string | null;
  score: number;
}

export function fullImage(path: string | undefined | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${CATALOG_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function findBestMatch(
  query: string,
  catalog: CatalogProduct[]
): MatchedProduct | null {
  if (!query || !catalog?.length) return null;
  const qNorm = normalizeName(query);
  if (!qNorm) return null;

  let best: { p: CatalogProduct; score: number } | null = null;
  for (const p of catalog) {
    const nameNorm = normalizeName(p.name);
    if (!nameNorm) continue;
    let score = similarity(qNorm, nameNorm);
    if (nameNorm === qNorm) score += 1;
    else if (nameNorm.includes(qNorm) || qNorm.includes(nameNorm)) score += 0.4;
    if (!best || score > best.score) best = { p, score };
  }
  if (!best || best.score < 0.34) return null;
  return {
    id: best.p.id,
    slug: best.p.slug,
    name: best.p.name,
    imageUrl: fullImage(best.p.images?.[0]),
    score: Math.round(best.score * 100) / 100,
  };
}
