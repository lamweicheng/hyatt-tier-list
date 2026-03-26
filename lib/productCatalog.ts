const STORAGE_KEY = "forecast-management.productCatalog.v1";

function normalizeName(name: string) {
  return name.trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function loadProductCatalog(fallback: string[] = []) {
  if (typeof window === "undefined") return uniqueSorted(fallback.map(normalizeName).filter(Boolean));

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return uniqueSorted(fallback.map(normalizeName).filter(Boolean));

    const parsed = JSON.parse(raw);
    const stored = Array.isArray(parsed) ? parsed : [];

    return uniqueSorted(
      [...fallback, ...stored]
        .map((v) => (typeof v === "string" ? normalizeName(v) : ""))
        .filter(Boolean)
    );
  } catch {
    return uniqueSorted(fallback.map(normalizeName).filter(Boolean));
  }
}

export function upsertProductToCatalog(name: string, fallback: string[] = []) {
  const normalized = normalizeName(name);
  if (!normalized) return loadProductCatalog(fallback);

  const next = uniqueSorted([...loadProductCatalog(fallback), normalized]);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  return next;
}
