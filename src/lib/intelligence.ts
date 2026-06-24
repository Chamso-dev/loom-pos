/**
 * LoomPOS Business Intelligence Engine
 * ------------------------------------
 * A pure, dependency-free analytics core shared by the offline (SQLite) and
 * server (Prisma) layers. It takes plain rows — products, orders, order items —
 * and derives actionable retail intelligence instead of raw CRUD numbers.
 *
 * The methods are original implementations adapted to this app's data model,
 * but grounded in established retail/ERP practice:
 *   - Reorder point = demand over lead time + safety stock  (inventory theory)
 *   - Safety stock from demand variability                  (service-level buffer)
 *   - Days of supply / sell-through / GMROI                 (retail KPIs)
 *   - ABC analysis (Pareto 80/20) by revenue contribution
 *   - XYZ analysis by demand variability (coefficient of variation)
 *   - RFM segmentation for customers
 *   - Linear-trend + moving-average blend for forecasting
 *
 * There is intentionally NO external data the model doesn't have (e.g. real
 * supplier lead times or expiry dates), so anything that would require it is
 * derived transparently from sales/stock outcomes and named honestly.
 */

// ----------------------------- Input shapes ------------------------------

export interface RawProduct {
  id: string
  name: string
  sku: string
  category: string
  supplier?: string | null
  costPrice: number
  sellingPrice: number
  gst: number
  stock: number
  createdAt?: string
}

export interface RawOrder {
  id: string
  date: string
  totalAmount: number
  gstAmount: number
  customerName?: string | null
  customerMobile?: string | null
}

export interface RawOrderItem {
  orderId: string
  productId: string
  quantity: number
  price: number
}

export interface IntelligenceInput {
  products: RawProduct[]
  orders: RawOrder[]
  items: RawOrderItem[]
  now?: number
}

// ----------------------------- Tunables ----------------------------------
// Sensible retail defaults; centralised so they are easy to reason about.
const ASSUMED_LEAD_TIME_DAYS = 5 // time from reorder to shelf
const REVIEW_PERIOD_DAYS = 7 // how often the owner reviews stock
const SAFETY_FACTOR = 1.5 // ~92% service level multiplier on demand sigma
const VELOCITY_WINDOW = 30 // primary demand window (days)
const TREND_WINDOW = 7 // recent window for trend vs the 30d baseline
const DEAD_STOCK_DAYS = 60 // no sale in this many days + stock on hand = dead
const OVERSTOCK_DAYS = 120 // more than this many days of cover = overstocked
const MS_PER_DAY = 86_400_000

// ----------------------------- Small math --------------------------------

const round = (n: number, dp = 2) => {
  const f = 10 ** dp
  return Math.round((Number.isFinite(n) ? n : 0) * f) / f
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0)

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1))
}

/** Ordinary least squares on (x,y) points → slope, intercept, r². */
function linearRegression(points: Array<{ x: number; y: number }>) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  let ssTot = 0
  let ssRes = 0
  for (const p of points) {
    ssTot += (p.y - my) ** 2
    const pred = slope * p.x + intercept
    ssRes += (p.y - pred) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  return { slope, intercept, r2 }
}

const dayKey = (d: string | number | Date) => new Date(d).toISOString().slice(0, 10)

// ----------------------------- Output shapes -----------------------------

export type AbcClass = 'A' | 'B' | 'C'
export type XyzClass = 'X' | 'Y' | 'Z'
export type StockStatus = 'out' | 'critical' | 'low' | 'healthy' | 'overstock' | 'dead'

export interface ProductIntel {
  id: string
  name: string
  sku: string
  category: string
  supplier: string
  stock: number
  costPrice: number
  sellingPrice: number
  marginPct: number
  unitsSold30: number
  unitsSold7: number
  velocityPerDay: number
  daysOfCover: number | null // null = effectively infinite (no sales)
  reorderPoint: number
  suggestedReorderQty: number
  revenue30: number
  profit30: number
  sellThroughPct: number
  gmroi: number
  forecastUnits7: number
  forecastUnits30: number
  lastSaleDaysAgo: number | null
  status: StockStatus
  abc: AbcClass
  xyz: XyzClass
  performanceScore: number
  trendPct: number // recent 7d run-rate vs 30d baseline, %
}

export interface BusinessIntelligence {
  generatedAt: string
  headline: {
    revenueToday: number
    ordersToday: number
    gstToday: number
    revenue30: number
    profit30: number
    avgOrderValue: number
  }
  inventoryHealth: {
    score: number
    grade: string
    skuCount: number
    outOfStock: number
    needsReorder: number
    deadStock: number
    overstock: number
    inventoryCostValue: number
    inventoryRetailValue: number
    deadStockCapital: number
    breakdown: Array<{ label: string; impact: number }>
  }
  revenueForecast: {
    next7Days: number
    dailyHistory: Array<{ date: string; amount: number }>
    dailyForecast: Array<{ date: string; amount: number }>
    confidence: number // 0..1 (regression r²)
  }
  salesTrend: {
    direction: 'rising' | 'falling' | 'stable'
    changePct: number
    recentDailyAvg: number
    priorDailyAvg: number
  }
  restockSuggestions: Array<
    Pick<ProductIntel, 'id' | 'name' | 'sku' | 'stock' | 'velocityPerDay' | 'daysOfCover' | 'suggestedReorderQty' | 'status'> & {
      estimatedCost: number
      priority: number
    }
  >
  deadStock: Array<Pick<ProductIntel, 'id' | 'name' | 'sku' | 'stock' | 'lastSaleDaysAgo'> & { tiedCapital: number }>
  topPerformers: ProductIntel[]
  underPerformers: ProductIntel[]
  abcMix: { A: number; B: number; C: number; aRevenueShare: number }
  categoryPerformance: Array<{ category: string; revenue: number; profit: number; units: number; marginPct: number }>
  customers: {
    tracked: number
    segments: Record<string, number>
    top: Array<{ key: string; name: string; orders: number; spend: number; recencyDays: number; valueScore: number; segment: string }>
  }
  suppliers: Array<{ name: string; products: number; revenue: number; profit: number; sellThroughPct: number; deadItems: number; performanceScore: number }>
  products: ProductIntel[]
}

// ----------------------------- Engine ------------------------------------

export function computeIntelligence(input: IntelligenceInput): BusinessIntelligence {
  const now = input.now ?? Date.now()
  const products = input.products ?? []
  const orders = input.orders ?? []
  const items = input.items ?? []

  const orderById = new Map(orders.map((o) => [o.id, o]))
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const todayMs = startToday.getTime()

  // ---- Per-product aggregation from order items (joined to order dates) ----
  interface Agg {
    units30: number
    units7: number
    unitsAll: number
    revenue30: number
    profit30: number
    lastSaleMs: number
    weeklyUnits: Map<number, number> // week index → units, for XYZ variability
  }
  const agg = new Map<string, Agg>()
  const ensure = (id: string): Agg => {
    let a = agg.get(id)
    if (!a) {
      a = { units30: 0, units7: 0, unitsAll: 0, revenue30: 0, profit30: 0, lastSaleMs: 0, weeklyUnits: new Map() }
      agg.set(id, a)
    }
    return a
  }
  const productById = new Map(products.map((p) => [p.id, p]))

  for (const it of items) {
    const order = orderById.get(it.orderId)
    if (!order) continue
    const ts = new Date(order.date).getTime()
    if (!Number.isFinite(ts)) continue
    const ageDays = (now - ts) / MS_PER_DAY
    const a = ensure(it.productId)
    a.unitsAll += it.quantity
    if (ts > a.lastSaleMs) a.lastSaleMs = ts
    const week = Math.floor(ageDays / 7)
    a.weeklyUnits.set(week, (a.weeklyUnits.get(week) || 0) + it.quantity)

    if (ageDays <= VELOCITY_WINDOW) {
      a.units30 += it.quantity
      a.revenue30 += it.price * it.quantity
      const prod = productById.get(it.productId)
      const cost = prod ? prod.costPrice : 0
      a.profit30 += (it.price - cost) * it.quantity
    }
    if (ageDays <= TREND_WINDOW) a.units7 += it.quantity
  }

  // ---- Build per-product intelligence ----
  const intel: ProductIntel[] = products.map((p) => {
    const a = agg.get(p.id)
    const units30 = a?.units30 ?? 0
    const units7 = a?.units7 ?? 0
    const velocity = units30 / VELOCITY_WINDOW
    const revenue30 = a?.revenue30 ?? 0
    const profit30 = a?.profit30 ?? 0
    const margin = p.sellingPrice - p.costPrice
    const marginPct = p.sellingPrice > 0 ? margin / p.sellingPrice : 0

    // Demand variability (sigma of weekly demand) → safety stock.
    const weekly = a ? [...a.weeklyUnits.values()] : []
    const weeklySigma = stddev(weekly)
    const dailySigma = weeklySigma / 7
    const safetyStock = Math.ceil(SAFETY_FACTOR * dailySigma * Math.sqrt(ASSUMED_LEAD_TIME_DAYS))
    const reorderPoint = Math.ceil(velocity * ASSUMED_LEAD_TIME_DAYS + safetyStock)

    // Order up to cover the review period + lead time, then net out on-hand.
    const targetLevel = velocity * (REVIEW_PERIOD_DAYS + ASSUMED_LEAD_TIME_DAYS) + safetyStock
    const suggestedReorderQty = Math.max(0, Math.ceil(targetLevel - p.stock))

    const daysOfCover = velocity > 0 ? p.stock / velocity : null
    const lastSaleDaysAgo = a && a.lastSaleMs > 0 ? Math.floor((now - a.lastSaleMs) / MS_PER_DAY) : null
    const sellThrough = units30 + p.stock > 0 ? units30 / (units30 + p.stock) : 0
    const avgInventoryCost = Math.max(p.stock * p.costPrice, 1)
    const gmroi = profit30 / avgInventoryCost

    // 7d run-rate vs 30d baseline → momentum.
    const baselineDaily = velocity
    const recentDaily = units7 / TREND_WINDOW
    const trendPct = baselineDaily > 0 ? ((recentDaily - baselineDaily) / baselineDaily) * 100 : recentDaily > 0 ? 100 : 0

    // Trend-adjusted demand forecast.
    const trendFactor = clamp(1 + (trendPct / 100) * 0.5, 0.5, 1.8) / 1 // dampened
    const forecastUnits7 = round(velocity * 7 * trendFactor, 1)
    const forecastUnits30 = round(velocity * 30 * trendFactor, 1)

    // Status classification.
    let status: StockStatus
    const noRecentSale = !lastSaleDaysAgo || lastSaleDaysAgo >= DEAD_STOCK_DAYS
    if (p.stock <= 0) status = 'out'
    else if (units30 === 0 && noRecentSale) status = 'dead'
    else if (p.stock <= reorderPoint && velocity > 0) status = p.stock <= reorderPoint / 2 ? 'critical' : 'low'
    else if (daysOfCover !== null && daysOfCover > OVERSTOCK_DAYS) status = 'overstock'
    else status = 'healthy'

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category || 'Uncategorised',
      supplier: p.supplier || 'Unspecified',
      stock: p.stock,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      marginPct: round(marginPct * 100, 1),
      unitsSold30: units30,
      unitsSold7: units7,
      velocityPerDay: round(velocity, 3),
      daysOfCover: daysOfCover === null ? null : round(daysOfCover, 1),
      reorderPoint,
      suggestedReorderQty,
      revenue30: round(revenue30),
      profit30: round(profit30),
      sellThroughPct: round(sellThrough * 100, 1),
      gmroi: round(gmroi, 2),
      forecastUnits7,
      forecastUnits30,
      lastSaleDaysAgo,
      status,
      abc: 'C',
      xyz: 'Z',
      performanceScore: 0,
      trendPct: round(trendPct, 1),
    }
  })

  // ---- ABC (Pareto on 30d revenue) ----
  const byRevenue = [...intel].sort((a, b) => b.revenue30 - a.revenue30)
  const totalRevenue = sum(byRevenue.map((p) => p.revenue30))
  let cumulative = 0
  for (const p of byRevenue) {
    cumulative += p.revenue30
    const share = totalRevenue > 0 ? cumulative / totalRevenue : 1
    p.abc = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C'
  }

  // ---- XYZ (demand variability, coefficient of variation of weekly units) ----
  for (const p of intel) {
    const a = agg.get(p.id)
    const weekly = a ? [...a.weeklyUnits.values()] : []
    if (weekly.length < 2 || mean(weekly) === 0) {
      p.xyz = 'Z'
      continue
    }
    const cv = stddev(weekly) / mean(weekly)
    p.xyz = cv < 0.5 ? 'X' : cv <= 1 ? 'Y' : 'Z'
  }

  // ---- Product performance score (0..100) ----
  const maxVelocity = Math.max(...intel.map((p) => p.velocityPerDay), 0.0001)
  const maxRevenue = Math.max(...intel.map((p) => p.revenue30), 1)
  for (const p of intel) {
    const velocityScore = (p.velocityPerDay / maxVelocity) * 100
    const revenueScore = (p.revenue30 / maxRevenue) * 100
    const marginScore = clamp((p.marginPct / 50) * 100) // 50%+ margin = full marks
    const sellThroughScore = clamp(p.sellThroughPct)
    const recencyScore = p.lastSaleDaysAgo === null ? 0 : clamp(100 - (p.lastSaleDaysAgo / DEAD_STOCK_DAYS) * 100)
    p.performanceScore = round(
      clamp(0.3 * velocityScore + 0.25 * revenueScore + 0.2 * marginScore + 0.15 * sellThroughScore + 0.1 * recencyScore),
      0,
    )
  }

  // ---- Inventory health score ----
  const skuCount = intel.length || 1
  const outOfStock = intel.filter((p) => p.status === 'out').length
  const needsReorder = intel.filter((p) => p.status === 'low' || p.status === 'critical').length
  const deadCount = intel.filter((p) => p.status === 'dead').length
  const overstockCount = intel.filter((p) => p.status === 'overstock').length
  const avgSellThrough = mean(intel.map((p) => p.sellThroughPct))

  const pen = {
    out: Math.min(30, (outOfStock / skuCount) * 100 * 0.6),
    reorder: Math.min(15, (needsReorder / skuCount) * 100 * 0.3),
    dead: Math.min(25, (deadCount / skuCount) * 100 * 0.5),
    over: Math.min(15, (overstockCount / skuCount) * 100 * 0.3),
  }
  const sellThroughReward = clamp((avgSellThrough / 60) * 15, 0, 15)
  const healthScore = round(clamp(100 - pen.out - pen.reorder - pen.dead - pen.over - (15 - sellThroughReward)), 0)
  const grade = healthScore >= 85 ? 'Excellent' : healthScore >= 70 ? 'Good' : healthScore >= 50 ? 'Fair' : 'At Risk'

  const inventoryCostValue = sum(products.map((p) => p.stock * p.costPrice))
  const inventoryRetailValue = sum(products.map((p) => p.stock * p.sellingPrice))
  const deadStockList = intel
    .filter((p) => p.status === 'dead')
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, lastSaleDaysAgo: p.lastSaleDaysAgo, tiedCapital: round(p.stock * p.costPrice) }))
    .sort((a, b) => b.tiedCapital - a.tiedCapital)
  const deadStockCapital = sum(deadStockList.map((d) => d.tiedCapital))

  // ---- Daily revenue series + forecast ----
  const dailyMap = new Map<string, number>()
  const horizonStart = now - 30 * MS_PER_DAY
  for (const o of orders) {
    const ts = new Date(o.date).getTime()
    if (ts >= horizonStart) dailyMap.set(dayKey(o.date), (dailyMap.get(dayKey(o.date)) || 0) + o.totalAmount)
  }
  const dailyHistory: Array<{ date: string; amount: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayMs - i * MS_PER_DAY)
    const key = dayKey(d)
    dailyHistory.push({ date: key, amount: round(dailyMap.get(key) || 0) })
  }
  const regPoints = dailyHistory.map((d, i) => ({ x: i, y: d.amount }))
  const reg = linearRegression(regPoints)
  const movingAvg = mean(dailyHistory.slice(-7).map((d) => d.amount))
  const dailyForecast: Array<{ date: string; amount: number }> = []
  for (let i = 1; i <= 7; i++) {
    const trendVal = reg.slope * (29 + i) + reg.intercept
    // Blend trend with the 7-day moving average; weight trend by its fit (r²).
    const blended = clamp(reg.r2, 0, 1) * trendVal + (1 - clamp(reg.r2, 0, 1)) * movingAvg
    const d = new Date(todayMs + i * MS_PER_DAY)
    dailyForecast.push({ date: dayKey(d), amount: round(Math.max(0, blended)) })
  }
  const forecastNext7 = round(sum(dailyForecast.map((d) => d.amount)))

  // ---- Sales trend (recent 7d vs prior 7d daily average) ----
  const recent7 = dailyHistory.slice(-7).map((d) => d.amount)
  const prior7 = dailyHistory.slice(-14, -7).map((d) => d.amount)
  const recentAvg = mean(recent7)
  const priorAvg = mean(prior7)
  const changePct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : recentAvg > 0 ? 100 : 0
  const direction = changePct > 7 ? 'rising' : changePct < -7 ? 'falling' : 'stable'

  // ---- Restock suggestions (prioritised) ----
  const restock = intel
    .filter((p) => p.suggestedReorderQty > 0 && (p.status === 'out' || p.status === 'critical' || p.status === 'low'))
    .map((p) => {
      const urgency = p.status === 'out' ? 100 : p.daysOfCover !== null ? clamp(100 - (p.daysOfCover / ASSUMED_LEAD_TIME_DAYS) * 50) : 50
      const priority = round(0.6 * urgency + 0.4 * p.performanceScore, 0)
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        velocityPerDay: p.velocityPerDay,
        daysOfCover: p.daysOfCover,
        suggestedReorderQty: p.suggestedReorderQty,
        status: p.status,
        estimatedCost: round(p.suggestedReorderQty * p.costPrice),
        priority,
      }
    })
    .sort((a, b) => b.priority - a.priority)

  // ---- Category performance ----
  const catMap = new Map<string, { revenue: number; profit: number; units: number }>()
  for (const p of intel) {
    const c = catMap.get(p.category) || { revenue: 0, profit: 0, units: 0 }
    c.revenue += p.revenue30
    c.profit += p.profit30
    c.units += p.unitsSold30
    catMap.set(p.category, c)
  }
  const categoryPerformance = [...catMap.entries()]
    .map(([category, v]) => ({
      category,
      revenue: round(v.revenue),
      profit: round(v.profit),
      units: v.units,
      marginPct: v.revenue > 0 ? round((v.profit / v.revenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // ---- Customer RFM ----
  const custMap = new Map<string, { name: string; orders: number; spend: number; lastMs: number }>()
  for (const o of orders) {
    const key = (o.customerMobile || '').trim() || (o.customerName || '').trim()
    if (!key) continue // walk-in / cash customer, not trackable
    const ts = new Date(o.date).getTime()
    const c = custMap.get(key) || { name: o.customerName || key, orders: 0, spend: 0, lastMs: 0 }
    c.orders += 1
    c.spend += o.totalAmount
    if (ts > c.lastMs) c.lastMs = ts
    if (o.customerName) c.name = o.customerName
    custMap.set(key, c)
  }
  const custList = [...custMap.entries()].map(([key, c]) => {
    const recencyDays = Math.floor((now - c.lastMs) / MS_PER_DAY)
    return { key, ...c, recencyDays }
  })
  const maxSpend = Math.max(...custList.map((c) => c.spend), 1)
  const maxFreq = Math.max(...custList.map((c) => c.orders), 1)
  const scoredCustomers = custList.map((c) => {
    const rScore = clamp(100 - (c.recencyDays / 90) * 100) // seen recently = high
    const fScore = (c.orders / maxFreq) * 100
    const mScore = (c.spend / maxSpend) * 100
    const valueScore = round(clamp(0.3 * rScore + 0.3 * fScore + 0.4 * mScore), 0)
    let segment: string
    if (valueScore >= 75) segment = 'Champion'
    else if (fScore >= 50 && rScore >= 40) segment = 'Loyal'
    else if (rScore < 30 && c.orders > 1) segment = 'At Risk'
    else if (c.orders === 1 && rScore >= 60) segment = 'New'
    else segment = 'Occasional'
    return { key: c.key, name: c.name, orders: c.orders, spend: round(c.spend), recencyDays: c.recencyDays, valueScore, segment }
  })
  const segments: Record<string, number> = {}
  for (const c of scoredCustomers) segments[c.segment] = (segments[c.segment] || 0) + 1

  // ---- Supplier performance (derived from product outcomes) ----
  const supMap = new Map<string, { products: number; revenue: number; profit: number; sell: number[]; dead: number }>()
  for (const p of intel) {
    const s = supMap.get(p.supplier) || { products: 0, revenue: 0, profit: 0, sell: [], dead: 0 }
    s.products += 1
    s.revenue += p.revenue30
    s.profit += p.profit30
    s.sell.push(p.sellThroughPct)
    if (p.status === 'dead') s.dead += 1
    supMap.set(p.supplier, s)
  }
  const maxSupRevenue = Math.max(...[...supMap.values()].map((s) => s.revenue), 1)
  const suppliers = [...supMap.entries()]
    .map(([name, s]) => {
      const sellThrough = mean(s.sell)
      const revenueScore = (s.revenue / maxSupRevenue) * 100
      const marginScore = s.revenue > 0 ? clamp((s.profit / s.revenue) / 0.5 * 100) : 0
      const deadPenalty = (s.dead / s.products) * 100
      const performanceScore = round(clamp(0.4 * sellThrough + 0.3 * revenueScore + 0.3 * marginScore - 0.3 * deadPenalty), 0)
      return {
        name,
        products: s.products,
        revenue: round(s.revenue),
        profit: round(s.profit),
        sellThroughPct: round(sellThrough, 1),
        deadItems: s.dead,
        performanceScore,
      }
    })
    .sort((a, b) => b.performanceScore - a.performanceScore)

  // ---- Headline numbers ----
  const todaysOrders = orders.filter((o) => new Date(o.date).getTime() >= todayMs)
  const revenueToday = round(sum(todaysOrders.map((o) => o.totalAmount)))
  const gstToday = round(sum(todaysOrders.map((o) => o.gstAmount)))
  const revenue30 = round(sum(intel.map((p) => p.revenue30)))
  const profit30 = round(sum(intel.map((p) => p.profit30)))
  const orders30 = orders.filter((o) => new Date(o.date).getTime() >= horizonStart)
  const avgOrderValue = orders30.length ? round(sum(orders30.map((o) => o.totalAmount)) / orders30.length) : 0

  const ranked = [...intel].sort((a, b) => b.performanceScore - a.performanceScore)
  const sellingProducts = ranked.filter((p) => p.unitsSold30 > 0 || p.status !== 'dead')

  const aCount = intel.filter((p) => p.abc === 'A').length
  const aRevenue = sum(intel.filter((p) => p.abc === 'A').map((p) => p.revenue30))

  return {
    generatedAt: new Date(now).toISOString(),
    headline: { revenueToday, ordersToday: todaysOrders.length, gstToday, revenue30, profit30, avgOrderValue },
    inventoryHealth: {
      score: healthScore,
      grade,
      skuCount: intel.length,
      outOfStock,
      needsReorder,
      deadStock: deadCount,
      overstock: overstockCount,
      inventoryCostValue: round(inventoryCostValue),
      inventoryRetailValue: round(inventoryRetailValue),
      deadStockCapital,
      breakdown: [
        { label: 'Out of stock', impact: -round(pen.out, 1) },
        { label: 'Needs reorder', impact: -round(pen.reorder, 1) },
        { label: 'Dead stock', impact: -round(pen.dead, 1) },
        { label: 'Overstock', impact: -round(pen.over, 1) },
        { label: 'Sell-through', impact: round(sellThroughReward, 1) },
      ],
    },
    revenueForecast: { next7Days: forecastNext7, dailyHistory, dailyForecast, confidence: round(clamp(reg.r2, 0, 1), 2) },
    salesTrend: { direction, changePct: round(changePct, 1), recentDailyAvg: round(recentAvg), priorDailyAvg: round(priorAvg) },
    restockSuggestions: restock.slice(0, 25),
    deadStock: deadStockList.slice(0, 25),
    topPerformers: ranked.slice(0, 5),
    underPerformers: sellingProducts.slice(-5).reverse(),
    abcMix: {
      A: aCount,
      B: intel.filter((p) => p.abc === 'B').length,
      C: intel.filter((p) => p.abc === 'C').length,
      aRevenueShare: totalRevenue > 0 ? round((aRevenue / totalRevenue) * 100, 1) : 0,
    },
    categoryPerformance,
    customers: {
      tracked: scoredCustomers.length,
      segments,
      top: scoredCustomers.sort((a, b) => b.valueScore - a.valueScore).slice(0, 10),
    },
    suppliers,
    products: intel,
  }
}

/**
 * Predictive low-stock list used by the notifications bell.
 * Replaces the naive `stock <= 10` rule with reorder-point logic: a product is
 * flagged when on-hand stock has fallen to or below its demand-based reorder
 * point, or it is already out of stock with recent demand.
 */
export function predictiveLowStock(input: IntelligenceInput, limit = 20) {
  const intel = computeIntelligence(input).products
  return intel
    .filter((p) => p.status === 'out' || p.status === 'critical' || p.status === 'low')
    .sort((a, b) => {
      const rank = (s: StockStatus) => (s === 'out' ? 0 : s === 'critical' ? 1 : 2)
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
      return (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9)
    })
    .slice(0, limit)
}
