/**
 * Automatic product identification for first-time inventory entry, powered by
 * the official Open Food Facts public API (no key, read-only, no auth).
 *
 * Strictly offline-first: this is the ONLY place the app reaches the internet,
 * and only when adding a new product by barcode. Lookups are cached in the local
 * SQLite DB (/api/barcode-cache) so a barcode is never fetched twice, and the
 * local product catalogue always takes priority (checked by the caller).
 *
 * Source order: Open Food Facts Algeria (French) → global Open Food Facts.
 */

export interface EnrichedProduct {
  barcode: string
  name: string
  size?: string
  brand?: string
  category?: string
  description?: string
  image?: string
  source: string
  confidence: number
}

const TIMEOUT_MS = 8000
/** Top match at/above this score is filled automatically without asking. */
export const AUTOFILL_CONFIDENCE = 0.7

const OFF_FIELDS = [
  'product_name', 'product_name_fr', 'generic_name', 'generic_name_fr', 'brands',
  'quantity', 'categories_tags', 'categories', 'image_front_small_url', 'image_url',
].join(',')

function normalizeSize(quantity?: string | null): string | undefined {
  const q = (quantity || '').trim()
  if (!q) return undefined
  return q.replace(/\s+/g, ' ').replace(/(\d)\s+(?=[a-zA-Z])/g, '$1').trim() || undefined
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function cleanCategory(tags?: string[], categories?: string): string | undefined {
  if (Array.isArray(tags) && tags.length) {
    // Most specific tag, dropping the language prefix (e.g. "fr:" / "en:").
    const last = tags[tags.length - 1] || ''
    const label = last.replace(/^[a-z]{2}:/, '').replace(/[-_]+/g, ' ').trim()
    if (label) return titleCase(label)
  }
  if (categories) {
    const parts = categories.split(',').map((s) => s.trim()).filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return titleCase(last)
  }
  return undefined
}

/** Completeness-based confidence in [0,1]. */
function scoreCandidate(c: Omit<EnrichedProduct, 'confidence'>): number {
  let s = 0
  if (c.name) s += 0.45
  if (c.brand) s += 0.2
  if (c.size) s += 0.15
  if (c.category) s += 0.1
  if (c.image) s += 0.1
  return Math.min(1, s)
}

/**
 * Look a barcode up on an Open Food Facts host. `frenchFirst` prefers the
 * French product name (used for the Algeria/French source).
 */
async function fromOpenFoodFacts(
  host: string,
  label: string,
  barcode: string,
  frenchFirst: boolean,
): Promise<EnrichedProduct | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const params = `lc=fr&cc=dz&fields=${OFF_FIELDS}`
    const res = await fetch(
      `https://${host}/api/v2/product/${encodeURIComponent(barcode)}.json?${params}`,
      { signal: controller.signal },
    )
    if (!res.ok) return null
    const json: any = await res.json()
    if (json?.status !== 1 || !json.product) return null
    const p = json.product

    const brand = (p.brands || '').split(',')[0]?.trim() || undefined
    const nameCandidates = frenchFirst
      ? [p.product_name_fr, p.product_name, p.generic_name_fr, p.generic_name, brand]
      : [p.product_name, p.product_name_fr, p.generic_name, p.generic_name_fr, brand]
    const name = nameCandidates.map((n) => (n || '').trim()).find(Boolean)
    if (!name) return null

    const base = {
      barcode,
      name,
      size: normalizeSize(p.quantity),
      brand,
      category: cleanCategory(p.categories_tags, p.categories),
      description: (p.generic_name_fr || p.generic_name || '').trim() || undefined,
      image: p.image_front_small_url || p.image_url || undefined,
      source: label,
    }
    return { ...base, confidence: scoreCandidate(base) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function readCache(barcode: string): Promise<EnrichedProduct[] | null> {
  try {
    const res = await fetch(`/api/barcode-cache?barcode=${encodeURIComponent(barcode)}`)
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data?.candidates) ? (data.candidates as EnrichedProduct[]) : null
  } catch {
    return null
  }
}

async function writeCache(barcode: string, candidates: EnrichedProduct[]): Promise<void> {
  try {
    await fetch('/api/barcode-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, data: { candidates } }),
    })
  } catch {
    /* best-effort */
  }
}

/**
 * Identify a product from its barcode. Order: local cache (instant, offline) →
 * Open Food Facts Algeria (French) → global Open Food Facts. Returns [] when the
 * device is offline or nothing matches, so the caller falls back to manual entry
 * with the barcode pre-filled. Successful lookups are cached locally.
 */
export async function identifyBarcode(barcode: string): Promise<EnrichedProduct[]> {
  const code = (barcode || '').trim()
  if (!code) return []

  const cached = await readCache(code)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return []

  // 1) Open Food Facts Algeria (French).
  let match = await fromOpenFoodFacts('dz-fr.openfoodfacts.org', 'openfoodfacts-dz', code, true)
  // 2) Global Open Food Facts.
  if (!match) match = await fromOpenFoodFacts('world.openfoodfacts.org', 'openfoodfacts', code, false)

  if (!match) return []
  const result = [match]
  await writeCache(code, result)
  return result
}
