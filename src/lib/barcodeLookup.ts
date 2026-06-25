/**
 * Automatic product identification for first-time inventory entry.
 *
 * Strictly offline-first: this is the ONLY place the app reaches the internet,
 * and only when adding a new product by barcode. Results are cached in the local
 * SQLite DB (/api/barcode-cache) so a barcode is never fetched twice, and the
 * local product catalogue always takes priority (checked by the caller).
 *
 * Identification queries several FREE, key-less, CORS-open product databases in
 * parallel, scores every candidate by completeness, and returns them ranked best
 * first. High-confidence top match → auto-fill; otherwise the caller shows the
 * ranked shortlist. Any failure/timeout/offline degrades to manual entry.
 *
 * Sources:
 *  - Open*Facts family (food, products, beauty, pet food) — same API shape.
 *  - UPCitemdb trial endpoint — general retail catalogue.
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

const TIMEOUT_MS = 7000
/** Top match at/above this score is filled automatically without asking. */
export const AUTOFILL_CONFIDENCE = 0.7

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
    const last = tags[tags.length - 1] || ''
    const label = last.replace(/^[a-z]{2}:/, '').replace(/[-_]+/g, ' ').trim()
    if (label) return titleCase(label)
  }
  if (categories) {
    const first = categories.split(',')[0]?.trim()
    if (first) return titleCase(first)
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

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Open*Facts family — identical schema across food/products/beauty/pet hosts. */
async function fromOpenFacts(host: string, label: string, barcode: string): Promise<EnrichedProduct | null> {
  const fields = [
    'product_name', 'product_name_fr', 'generic_name', 'brands',
    'quantity', 'categories_tags', 'categories', 'image_front_small_url', 'image_url',
  ].join(',')
  const json = await fetchJson(`https://${host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`)
  if (json?.status !== 1 || !json.product) return null
  const p = json.product
  const brand = (p.brands || '').split(',')[0]?.trim() || undefined
  const name = (p.product_name || p.product_name_fr || p.generic_name || brand || '').trim()
  if (!name) return null
  const base = {
    barcode,
    name,
    size: normalizeSize(p.quantity),
    brand,
    category: cleanCategory(p.categories_tags, p.categories),
    description: (p.generic_name || '').trim() || undefined,
    image: p.image_front_small_url || p.image_url || undefined,
    source: label,
  }
  return { ...base, confidence: scoreCandidate(base) }
}

/** UPCitemdb free trial — general retail catalogue (may be rate-limited). */
async function fromUpcItemDb(barcode: string): Promise<EnrichedProduct[]> {
  const json = await fetchJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`)
  const items: any[] = Array.isArray(json?.items) ? json.items : []
  const out: EnrichedProduct[] = []
  for (const it of items.slice(0, 5)) {
    const name = (it.title || it.brand || '').trim()
    if (!name) continue
    const base = {
      barcode,
      name,
      size: normalizeSize(it.size),
      brand: (it.brand || '').trim() || undefined,
      category: it.category ? titleCase(String(it.category).split('>').pop()!.trim()) : undefined,
      description: (it.description || '').trim() || undefined,
      image: Array.isArray(it.images) && it.images.length ? it.images[0] : undefined,
      source: 'upcitemdb',
    }
    out.push({ ...base, confidence: scoreCandidate(base) })
  }
  return out
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
 * Identify a product from its barcode, ranked best-first.
 * 1) Local cache (instant, offline). 2) All online sources in parallel (only
 * when online), scored, de-duplicated, ranked, then cached. Returns [] when the
 * device is offline or nothing matches — the caller then falls back to manual
 * entry with the barcode pre-filled.
 */
export async function identifyBarcode(barcode: string): Promise<EnrichedProduct[]> {
  const code = (barcode || '').trim()
  if (!code) return []

  const cached = await readCache(code)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return []

  const results = await Promise.allSettled([
    fromOpenFacts('world.openfoodfacts.org', 'openfoodfacts', code),
    fromOpenFacts('world.openproductsfacts.org', 'openproductsfacts', code),
    fromOpenFacts('world.openbeautyfacts.org', 'openbeautyfacts', code),
    fromOpenFacts('world.openpetfoodfacts.org', 'openpetfoodfacts', code),
    fromUpcItemDb(code),
  ])

  const candidates: EnrichedProduct[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue
    if (Array.isArray(r.value)) candidates.push(...r.value)
    else candidates.push(r.value)
  }

  // De-duplicate by name+size, keeping the highest-scoring instance.
  const byKey = new Map<string, EnrichedProduct>()
  for (const c of candidates) {
    const key = `${c.name}|${c.size ?? ''}`.toLowerCase().replace(/\s+/g, '')
    const prev = byKey.get(key)
    if (!prev || c.confidence > prev.confidence) byKey.set(key, c)
  }
  const ranked = [...byKey.values()].sort((a, b) => b.confidence - a.confidence)

  if (ranked.length) await writeCache(code, ranked)
  return ranked
}
