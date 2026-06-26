/**
 * App-controlled product identification backend.
 *
 * Identifies a retail product from its barcode using Google's official
 * Programmable Search (Custom Search JSON API) plus OpenFoodFacts as a clean
 * structured source, and returns normalized fields the POS form expects. The
 * Google API key lives ONLY in this backend's environment — it is never shipped
 * to the device and never shown to the user.
 *
 * Deploy this as a serverless function (Vercel/Netlify/Cloudflare-style:
 * `(req, res)` handler) and set these environment variables:
 *   GOOGLE_API_KEY  — Google Cloud API key with "Custom Search API" enabled
 *   GOOGLE_CX       — Programmable Search Engine ID (cx), set to search the
 *                     whole web
 * Then point the app at it by building with
 *   VITE_IDENTIFY_ENDPOINT=https://<your-deployment>/api/identify
 *
 * Request:  GET /api/identify?barcode=<ean/upc>
 * Response: { found, name, brand, category, size, image, description,
 *             confidence, source }
 */

const UNIT_RE = /(\d+(?:[.,]\d+)?)\s?(kg|g|mg|l|cl|ml|oz|lb|cl|kg)\b/i

function normalizeSize(s) {
  if (!s) return undefined
  const m = String(s).match(UNIT_RE)
  if (!m) return undefined
  return `${m[1].replace(',', '.')}${m[2].toLowerCase()}`
}

function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase())
}

// Strip trailing site/store suffixes like " | Carrefour" or " - Walmart.com".
function cleanName(title) {
  if (!title) return ''
  let t = String(title).split(/\s[|–—-]\s/)[0].trim()
  t = t.replace(/\s*\b(buy|price|online|delivery)\b.*$/i, '').trim()
  return t
}

async function fetchJson(url, ms = 7000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fromOpenFoodFacts(barcode) {
  const fields = 'product_name,brands,quantity,categories,categories_tags,image_front_small_url,image_url,generic_name'
  const j = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`)
  if (!j || j.status !== 1 || !j.product) return null
  const p = j.product
  const brand = (p.brands || '').split(',')[0]?.trim() || undefined
  const name = (p.product_name || p.generic_name || brand || '').trim()
  if (!name) return null
  let category
  if (Array.isArray(p.categories_tags) && p.categories_tags.length) {
    category = titleCase(p.categories_tags[p.categories_tags.length - 1].replace(/^[a-z]{2}:/, '').replace(/[-_]+/g, ' '))
  } else if (p.categories) {
    category = titleCase(p.categories.split(',')[0].trim())
  }
  return {
    name,
    brand,
    category,
    size: normalizeSize(p.quantity),
    image: p.image_front_small_url || p.image_url || undefined,
    description: (p.generic_name || '').trim() || undefined,
    source: 'openfoodfacts',
  }
}

async function fromGoogle(barcode) {
  const key = process.env.GOOGLE_API_KEY
  const cx = process.env.GOOGLE_CX
  if (!key || !cx) return null
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&num=5&q=${encodeURIComponent(barcode)}`
  const j = await fetchJson(url, 9000)
  const items = Array.isArray(j?.items) ? j.items : []
  if (!items.length) return null

  // Prefer a result that exposes structured product metadata.
  for (const it of items) {
    const pm = it.pagemap || {}
    const product = Array.isArray(pm.product) ? pm.product[0] : undefined
    const meta = Array.isArray(pm.metatags) ? pm.metatags[0] : undefined
    const name = cleanName(product?.name || meta?.['og:title'] || it.title)
    if (!name) continue
    const haystack = `${it.title || ''} ${it.snippet || ''} ${product?.description || ''}`
    return {
      name,
      brand: (product?.brand || meta?.['product:brand'] || meta?.['og:brand'] || '').trim() || undefined,
      category: undefined,
      size: normalizeSize(product?.size) || normalizeSize(haystack),
      image: (Array.isArray(pm.cse_image) && pm.cse_image[0]?.src) || product?.image || meta?.['og:image'] || undefined,
      description: (it.snippet || '').trim() || undefined,
      source: 'google',
    }
  }
  return null
}

function score(c) {
  let s = 0
  if (c.name) s += 0.45
  if (c.brand) s += 0.2
  if (c.size) s += 0.15
  if (c.category) s += 0.1
  if (c.image) s += 0.1
  return Math.min(1, s)
}

// Merge two candidates field-by-field (primary wins, secondary fills gaps).
function merge(primary, secondary) {
  if (!secondary) return primary
  if (!primary) return secondary
  return {
    name: primary.name || secondary.name,
    brand: primary.brand || secondary.brand,
    category: primary.category || secondary.category,
    size: primary.size || secondary.size,
    image: primary.image || secondary.image,
    description: primary.description || secondary.description,
    source: `${primary.source}+${secondary.source}`,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const barcode = String((req.query?.barcode ?? '') || '').trim()
  if (!barcode) return res.status(400).json({ found: false, error: 'barcode required' })

  try {
    const [off, google] = await Promise.all([fromOpenFoodFacts(barcode), fromGoogle(barcode)])
    // Prefer the richer of the two as primary, fill gaps from the other.
    let best = null
    if (off && google) best = score(off) >= score(google) ? merge(off, google) : merge(google, off)
    else best = off || google

    if (!best || !best.name) return res.status(200).json({ found: false })
    return res.status(200).json({ found: true, barcode, confidence: score(best), ...best })
  } catch {
    return res.status(200).json({ found: false })
  }
}
