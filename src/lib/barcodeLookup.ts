/**
 * Online product enrichment for first-time inventory entry.
 *
 * Strictly offline-first: this is the ONLY place the app reaches the internet,
 * and only when adding a new product by barcode. Results are cached in the local
 * SQLite DB (/api/barcode-cache) so the same barcode is never fetched twice, and
 * the local product catalogue always takes priority (checked by the caller).
 *
 * Source: OpenFoodFacts — a free, open product database (no API key), well suited
 * to grocery/retail barcodes. Failures degrade silently to manual entry.
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
}

const OFF_TIMEOUT_MS = 7000

function normalizeSize(quantity?: string | null): string | undefined {
  const q = (quantity || '').trim()
  if (!q) return undefined
  // "330 ml" -> "330ml", "1 L" -> "1L", keep multipacks readable.
  return q.replace(/\s+/g, ' ').replace(/(\d)\s+(?=[a-zA-Z])/g, '$1').trim() || undefined
}

function cleanCategory(tags?: string[], categories?: string): string | undefined {
  if (Array.isArray(tags) && tags.length) {
    const last = tags[tags.length - 1] || ''
    const label = last.replace(/^[a-z]{2}:/, '').replace(/[-_]+/g, ' ').trim()
    if (label) return label.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  if (categories) {
    const first = categories.split(',')[0]?.trim()
    if (first) return first.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return undefined
}

/** Read a previously cached enrichment from the local DB. */
async function readCache(barcode: string): Promise<EnrichedProduct | null> {
  try {
    const res = await fetch(`/api/barcode-cache?barcode=${encodeURIComponent(barcode)}`)
    if (!res.ok) return null
    return (await res.json()) as EnrichedProduct
  } catch {
    return null
  }
}

/** Persist an enrichment to the local DB so it is never refetched. */
async function writeCache(barcode: string, data: EnrichedProduct): Promise<void> {
  try {
    await fetch('/api/barcode-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, data }),
    })
  } catch {
    /* cache write is best-effort */
  }
}

async function fetchOpenFoodFacts(barcode: string): Promise<EnrichedProduct | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS)
  try {
    const fields = [
      'product_name', 'product_name_fr', 'generic_name', 'brands',
      'quantity', 'categories_tags', 'categories',
      'image_front_small_url', 'image_url',
    ].join(',')
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const json: any = await res.json()
    if (json?.status !== 1 || !json.product) return null
    const p = json.product

    const brand = (p.brands || '').split(',')[0]?.trim() || undefined
    const name = (p.product_name || p.product_name_fr || p.generic_name || brand || '').trim()
    if (!name) return null

    return {
      barcode,
      name,
      size: normalizeSize(p.quantity),
      brand,
      category: cleanCategory(p.categories_tags, p.categories),
      description: (p.generic_name || '').trim() || undefined,
      image: p.image_front_small_url || p.image_url || undefined,
      source: 'openfoodfacts',
    }
  } catch {
    return null // network error, timeout, abort, bad JSON — fall back to manual
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Enrich a barcode for the Add-Product form.
 * 1) Local cache (instant, offline). 2) Online OpenFoodFacts (only if online),
 * cached on success. Returns null when nothing is found or the device is offline
 * — the caller then opens the plain manual form with the barcode pre-filled.
 */
export async function enrichBarcode(barcode: string): Promise<EnrichedProduct | null> {
  const code = (barcode || '').trim()
  if (!code) return null

  const cached = await readCache(code)
  if (cached) return cached

  // Skip the network entirely when offline.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null

  const online = await fetchOpenFoodFacts(code)
  if (online) {
    await writeCache(code, online)
    return online
  }
  return null
}
