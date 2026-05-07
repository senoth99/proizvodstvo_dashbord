/** Ключ спецификации в каталоге: slug или нормализованное имя (как в ProductsTab / production). */
export function normalizeBomKey(name: string): string {
  return (name || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase()
    .replace(/[«»"'`’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function productionBomKey(it: {
  matchedSlug?: string | null;
  matchedName?: string | null;
  name: string;
}): string {
  const slug = it.matchedSlug?.toString().trim();
  if (slug) return slug;
  return normalizeBomKey(it.matchedName ?? it.name);
}
