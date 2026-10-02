/**
 * In-browser stand-in for the LoomPOS API, used only by the single-file demo build.
 * Every amount goes through the same shared rules as the real server
 * (src/lib/domain): pricing, TVA, payment settlement, refunds and repayments.
 * Only storage differs: the data lives in memory and resets on reload.
 */
import {
  allocateRepayment,
  dayKeyOf,
  includedTax,
  isUnitCode,
  isValidQuantity,
  normalizeAlgerianPhone,
  orderStatus,
  PAYMENT_METHOD_CODES,
  priceSale,
  refundValue,
  roundMoney,
  roundQuantity,
  SETTLING_METHOD_CODES,
  settlePayments,
  splitRefund,
  sumMoney,
  UNIT_CODES,
  UNITS,
  type PaymentInput,
} from './domain'
import { demoCustomers, demoHourWeights, demoProducts, demoStore, demoSuppliers } from './data'

class HttpError extends Error {
  constructor(public status: number, public code: string, public details?: Record<string, unknown>) {
    super(code)
  }
}

type Row = Record<string, any>
let counter = 0
const id = () => `demo-${(++counter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const iso = (d: Date) => d.toISOString()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const db = {
  users: [
    { id: 'u-admin', employeeId: 'admin', name: 'Samir Benyahia', role: 'ADMIN', phone: '0550123456', isActive: true, createdAt: iso(new Date()), password: 'admin123' },
    { id: 'u-cashier', employeeId: 'cashier', name: 'Lina Meziane', role: 'CASHIER', phone: '0661987654', isActive: true, createdAt: iso(new Date()), password: 'cashier123' },
  ] as Row[],
  settings: {
    id: '1',
    ...demoStore,
    currency: 'DZD',
    language: 'ar',
    defaultPaymentMethod: 'CASH',
    receiptWidth: 80,
    receiptShowTax: true,
    cashierPassword: null as string | null,
  } as Row,
  products: [] as Row[],
  customers: [] as Row[],
  suppliers: [] as Row[],
  orders: [] as Row[],
  payments: [] as Row[],
  refunds: [] as Row[],
  purchases: [] as Row[],
  supplierPayments: [] as Row[],
}

// ---------------------------------------------------------------------------------- seed

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]

function seedData() {
  const now = new Date()
  db.suppliers = demoSuppliers.map((s) => ({ id: id(), ...s, notes: null, balance: 0, createdAt: iso(now), updatedAt: iso(now) }))
  db.products = demoProducts.map((p) => ({
    id: id(),
    size: null,
    color: null,
    supplier: null,
    ...p,
    supplierId: db.suppliers.find((s) => s.name === p.supplier)?.id ?? null,
    createdAt: iso(now),
    updatedAt: iso(now),
  }))
  db.customers = demoCustomers.map((c) => ({ id: id(), ...c, address: null, notes: null, balance: 0, createdAt: iso(now), updatedAt: iso(now) }))

  const weights = Object.entries(demoHourWeights)
  const total = weights.reduce((a, [, w]) => a + w, 0)
  const pickHour = () => {
    let r = rand() * total
    for (const [h, w] of weights) if ((r -= w) < 0) return Number(h)
    return 18
  }
  const dates: Date[] = []
  for (let back = 7; back >= 0; back--) {
    const day = new Date(now)
    day.setDate(day.getDate() - back)
    const n = 26 + Math.floor(rand() * 16)
    for (let i = 0; i < n; i++) {
      const d = new Date(day)
      d.setHours(pickHour(), Math.floor(rand() * 60), Math.floor(rand() * 60), 0)
      if (d <= now) dates.push(d)
    }
  }
  dates.sort((a, b) => +a - +b)
  const sellable = db.products.filter((p) => p.stock > 0)
  for (const date of dates) {
    const lines = [...sellable]
      .sort(() => rand() - 0.5)
      .slice(0, 1 + Math.floor(rand() * 4))
      .map((p) => ({
        productId: p.id,
        quantity: roundQuantity(p.unit === 'kg' ? 0.5 + Math.floor(rand() * 8) * 0.25 : p.unit === 'g' ? 250 + Math.floor(rand() * 6) * 50 : 1 + Math.floor(rand() * 2), p.unit),
      }))
    const totals = priceSale(
      lines.map((l) => {
        const p = db.products.find((x) => x.id === l.productId)!
        return { unitPrice: p.sellingPrice, quantity: l.quantity, unit: p.unit, taxRate: p.taxRate }
      })
    )
    const roll = rand()
    let customerId: string | null = null
    let payments: PaymentInput[]
    if (roll < 0.52) payments = [{ method: 'CASH', amount: pick([totals.total, ...[100, 500, 1000, 2000].map((s) => Math.ceil(totals.total / s) * s)]) }]
    else if (roll < 0.68) payments = [{ method: 'CIB', amount: totals.total, reference: `TPE-${4000 + db.orders.length}` }]
    else if (roll < 0.78) payments = [{ method: 'EDAHABIA', amount: totals.total }]
    else if (roll < 0.88) payments = [{ method: 'BARIDIMOB', amount: totals.total, reference: `BM-${7000 + db.orders.length}` }]
    else if (roll < 0.92) payments = [{ method: 'TRANSFER', amount: totals.total }]
    else {
      customerId = pick(db.customers.slice(0, 4)).id
      const cash = roundMoney(Math.floor((totals.total * rand() * 0.5) / 100) * 100)
      payments = [...(cash > 0 ? [{ method: 'CASH' as const, amount: cash }] : []), { method: 'CREDIT', amount: roundMoney(totals.total - cash) }]
    }
    try {
      createOrder({ items: lines, payments, customerId }, pick(db.users).id, date, { ignoreStock: true })
    } catch {
      /* skip a generated sale that does not settle */
    }
  }
  // One delivery still partly owed.
  const mitidja = db.suppliers[0]
  const sem = db.products.find((p) => p.sku === 'SEM-SIM-5')!
  const twoDaysAgo = new Date(now.getTime() - 2 * 864e5)
  const purchase = { id: id(), purchaseNo: 'ACH-0001', supplierId: mitidja.id, reference: 'BL-4471', date: iso(twoDaysAgo), totalAmount: 11200, amountPaid: 5000, balanceDue: 6200, userId: 'u-admin', items: [{ id: id(), productId: sem.id, quantity: 20, unitCost: 560 }] }
  db.purchases.push(purchase)
  db.supplierPayments.push({ id: id(), supplierId: mitidja.id, purchaseId: purchase.id, method: 'CASH', amount: 5000, reference: null, userId: 'u-admin', createdAt: iso(twoDaysAgo) })
  mitidja.balance = 6200
  // Stock levels in the catalogue are "now", after the generated sales.
  for (const p of db.products) p.stock = demoProducts.find((d) => d.sku === p.sku)!.stock
}

// ---------------------------------------------------------------------------- helpers

const userView = ({ password, ...u }: Row) => u
const settingsView = ({ cashierPassword, ...s }: Row) => ({ ...s, hasCashierPassword: Boolean(cashierPassword) })
const number = (prefix: string, n: number) => `${prefix}-${String(n + 1).padStart(4, '0')}`

function orderView(o: Row) {
  const u = db.users.find((x) => x.id === o.userId)
  return {
    ...clone(o),
    items: o.items.map((i: Row) => ({ ...clone(i), product: clone(db.products.find((p) => p.id === i.productId)) })),
    payments: db.payments.filter((p) => p.orderId === o.id).map(clone),
    customer: o.customerId ? clone(db.customers.find((c) => c.id === o.customerId)) : null,
    processedBy: u ? { name: u.name, employeeId: u.employeeId, isActive: u.isActive, role: u.role } : null,
    refunds: db.refunds.filter((r) => r.orderId === o.id).map(clone),
  }
}

function auth(headers: Headers, admin = false) {
  const token = headers.get('Authorization')?.replace('Bearer ', '')
  const user = db.users.find((u) => token === `demo-token-${u.id}`)
  if (!user || !user.isActive) throw new HttpError(401, 'UNAUTHORIZED')
  if (admin && user.role !== 'ADMIN') throw new HttpError(403, 'ADMIN_REQUIRED')
  return user
}

function phoneOrNull(value: unknown) {
  if (!value) return null
  const phone = normalizeAlgerianPhone(String(value))
  if (!phone) throw new HttpError(400, 'INVALID_PHONE')
  return phone
}

const startOfDay = (daysAgo = 0) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

// -------------------------------------------------------------------------------- sales

function createOrder(input: Row, userId: string, date = new Date(), options: { ignoreStock?: boolean } = {}) {
  if (!Array.isArray(input.items) || !input.items.length) throw new HttpError(400, 'VALIDATION')
  const merged = new Map<string, number>()
  for (const i of input.items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + Number(i.quantity))
  const lines = [...merged.entries()].map(([productId, quantity]) => {
    const product = db.products.find((p) => p.id === productId)
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND')
    if (!isValidQuantity(quantity, product.unit)) throw new HttpError(400, 'INVALID_QUANTITY', { product: product.name })
    const q = roundQuantity(quantity, product.unit)
    if (!options.ignoreStock && product.stock + 1e-9 < q) {
      throw new HttpError(409, 'INSUFFICIENT_STOCK', { product: product.name, available: product.stock, unit: product.unit })
    }
    return { product, quantity: q }
  })
  const totals = priceSale(
    lines.map(({ product, quantity }) => ({ unitPrice: product.sellingPrice, quantity, unit: product.unit, taxRate: product.taxRate, costPrice: product.costPrice })),
    input.discount ?? null
  )

  let customer = input.customerId ? db.customers.find((c) => c.id === input.customerId) : null
  if (input.customerId && !customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND')
  if (!customer && input.newCustomer?.name) {
    const phone = phoneOrNull(input.newCustomer.phone)
    customer = (phone && db.customers.find((c) => c.phone === phone)) || null
    if (!customer) {
      customer = { id: id(), name: input.newCustomer.name, phone, address: null, notes: null, creditLimit: null, balance: 0, createdAt: iso(date), updatedAt: iso(date) }
      db.customers.push(customer)
    }
  }

  const payments = (input.payments ?? []).filter((p: Row) => (PAYMENT_METHOD_CODES as string[]).includes(p.method))
  const settlement = settlePayments(totals.total, payments, Boolean(customer))
  if (settlement.errors.length) throw new HttpError(400, settlement.errors[0], { remaining: settlement.remaining, total: totals.total })
  if (customer && settlement.balanceDue > 0 && customer.creditLimit != null && roundMoney(customer.balance + settlement.balanceDue) - customer.creditLimit > 0.004) {
    throw new HttpError(400, 'CREDIT_LIMIT_EXCEEDED', { limit: customer.creditLimit, balance: customer.balance })
  }

  const methods = new Set(settlement.applied.map((p) => p.method))
  if (settlement.balanceDue > 0) methods.add('CREDIT')
  const order: Row = {
    id: id(),
    invoiceNo: number('INV', db.orders.length),
    date: iso(date),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    totalAmount: totals.total,
    taxAmount: totals.taxAmount,
    amountPaid: settlement.amountPaid,
    changeGiven: settlement.change,
    balanceDue: settlement.balanceDue,
    refundedAmount: 0,
    status: orderStatus({ totalAmount: totals.total, refundedAmount: 0, balanceDue: settlement.balanceDue }),
    paymentMethod: methods.size === 1 ? [...methods][0] : 'SPLIT',
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? input.customerName ?? null,
    customerMobile: customer?.phone ?? null,
    userId,
    items: lines.map(({ product, quantity }) => ({
      id: id(),
      productId: product.id,
      quantity,
      unit: product.unit,
      price: product.sellingPrice,
      costPrice: product.costPrice,
      taxRate: product.taxRate,
      refundedQuantity: 0,
    })),
  }
  db.orders.push(order)
  for (const { product, quantity } of lines) product.stock = roundQuantity(product.stock - quantity, product.unit)
  for (const p of settlement.applied.filter((p) => p.method !== 'CREDIT')) {
    db.payments.push({
      id: id(),
      kind: 'SALE',
      method: p.method,
      amount: p.amount,
      tendered: p.tendered && p.tendered !== p.amount ? p.tendered : null,
      reference: p.reference ?? null,
      orderId: order.id,
      customerId: customer?.id ?? null,
      userId,
      createdAt: iso(date),
    })
  }
  if (customer && settlement.balanceDue > 0) customer.balance = roundMoney(customer.balance + settlement.balanceDue)
  return order
}

function refund(order: Row, input: Row, userId: string) {
  const value = refundValue(order as any, order.items, input.items ?? [])
  if (value.error) throw new HttpError(400, value.error)
  const method = (SETTLING_METHOD_CODES as string[]).includes(input.method) ? input.method : 'CASH'
  const restock = input.restock !== false
  const { toCredit, paidOut } = splitRefund(value.amount, order.balanceDue)
  const record = {
    id: id(),
    refundNo: number('RF', db.refunds.length),
    orderId: order.id,
    amount: value.amount,
    toCredit,
    paidOut,
    method,
    reason: input.reason ?? null,
    restock,
    userId,
    createdAt: iso(new Date()),
    items: value.lines.map((l) => ({ id: id(), ...l })),
  }
  db.refunds.push(record)
  for (const line of value.lines) {
    const item = order.items.find((i: Row) => i.id === line.orderItemId)
    item.refundedQuantity = roundQuantity(item.refundedQuantity + line.quantity, item.unit)
    if (restock) {
      const p = db.products.find((x) => x.id === item.productId)
      if (p) p.stock = roundQuantity(p.stock + line.quantity, p.unit)
    }
  }
  order.refundedAmount = roundMoney(order.refundedAmount + value.amount)
  order.balanceDue = roundMoney(order.balanceDue - toCredit)
  order.status = orderStatus(order as any)
  if (toCredit > 0 && order.customerId) {
    const c = db.customers.find((x) => x.id === order.customerId)
    if (c) c.balance = Math.max(0, roundMoney(c.balance - toCredit))
  }
  return { refund: clone(record), order: orderView(order) }
}

// ------------------------------------------------------------------------------ reports

function report(from: Date, to: Date, groupBy: 'day' | 'month') {
  const keyOf = (d: Date) => (groupBy === 'day' ? dayKeyOf(d) : dayKeyOf(d).slice(0, 7))
  const inRange = (s: string) => {
    const d = new Date(s)
    return d >= from && d < to
  }
  const buckets = new Map<string, Row>()
  const bucket = (s: string) => {
    const key = keyOf(new Date(s))
    if (!buckets.has(key)) buckets.set(key, { period: key, orders: 0, gross: 0, discounts: 0, sales: 0, refunds: 0, net: 0, tax: 0, cost: 0, profit: 0, creditGiven: 0, purchases: 0 })
    return buckets.get(key)!
  }
  for (const o of db.orders.filter((o) => inRange(o.date))) {
    const b = bucket(o.date)
    const cost = sumMoney(o.items.map((i: Row) => i.quantity * i.costPrice))
    b.orders += 1
    b.gross += o.subtotal
    b.discounts += o.discountAmount
    b.sales += o.totalAmount
    b.tax += o.taxAmount
    b.cost += cost
    b.profit += o.totalAmount - o.taxAmount - cost
    b.creditGiven += Math.max(0, o.totalAmount - o.amountPaid)
  }
  const refunds = db.refunds.filter((r) => inRange(r.createdAt))
  for (const r of refunds) {
    const b = bucket(r.createdAt)
    b.refunds += r.amount
    const order = db.orders.find((o) => o.id === r.orderId)!
    for (const item of r.items) {
      const oi = order.items.find((i: Row) => i.id === item.orderItemId)
      const tax = includedTax(item.amount, oi.taxRate)
      const costBack = r.restock ? item.quantity * oi.costPrice : 0
      b.tax -= tax
      b.cost -= costBack
      b.profit -= item.amount - tax - costBack
    }
  }
  for (const p of db.purchases.filter((p) => inRange(p.date))) bucket(p.date).purchases += p.totalAmount
  const keys = ['gross', 'discounts', 'sales', 'refunds', 'tax', 'cost', 'profit', 'creditGiven', 'purchases']
  const rows = [...buckets.values()]
    .map((b) => {
      for (const k of keys) b[k] = roundMoney(b[k])
      b.net = roundMoney(b.sales - b.refunds)
      return b
    })
    .sort((a, b) => a.period.localeCompare(b.period))
  const totals: Row = { period: 'total', orders: 0, net: 0 }
  for (const k of keys) totals[k] = 0
  for (const r of rows) {
    totals.orders += r.orders
    for (const k of [...keys, 'net']) totals[k] = roundMoney(totals[k] + r[k])
  }
  const sum = (list: Row[], amount = 'amount') => {
    const m = new Map<string, number>()
    for (const x of list) m.set(x.method, roundMoney((m.get(x.method) ?? 0) + x[amount]))
    return [...m.entries()].map(([method, value]) => ({ method, amount: value })).sort((a, b) => b.amount - a.amount)
  }
  const payments = db.payments.filter((p) => inRange(p.createdAt))
  const moneyIn = sum(payments)
  const refundsOut = sum(refunds.filter((r) => r.paidOut > 0), 'paidOut')
  const supplierPayments = sum(db.supplierPayments.filter((p) => inRange(p.createdAt)))
  const cashIn = moneyIn.find((m) => m.method === 'CASH')?.amount ?? 0
  const cashRefunded = refundsOut.find((m) => m.method === 'CASH')?.amount ?? 0
  const cashToSuppliers = supplierPayments.find((m) => m.method === 'CASH')?.amount ?? 0
  return {
    rows,
    totals,
    moneyIn,
    refundsOut,
    supplierPayments,
    repayments: sumMoney(payments.filter((p) => p.kind === 'REPAYMENT').map((p) => p.amount)),
    cash: { in: cashIn, refunded: cashRefunded, toSuppliers: cashToSuppliers, expected: roundMoney(cashIn - cashRefunded - cashToSuppliers) },
    outstanding: {
      customers: sumMoney(db.customers.map((c) => c.balance)),
      suppliers: sumMoney(db.suppliers.map((s) => s.balance)),
    },
  }
}

function today() {
  const start = startOfDay()
  const since = startOfDay(7)
  const todayKey = dayKeyOf(start)
  const todayByHour: number[] = new Array(24).fill(0)
  const pastDays: Record<string, number[]> = {}
  const week: Record<string, { amount: number; orders: number }> = {}
  for (const o of db.orders) {
    const d = new Date(o.date)
    if (d < since) continue
    const key = dayKeyOf(d)
    if (key === todayKey) todayByHour[d.getHours()] += o.totalAmount
    else (pastDays[key] ??= new Array(24).fill(0))[d.getHours()] += o.totalAmount
    const w = (week[key] ??= { amount: 0, orders: 0 })
    w.amount += o.totalAmount
    w.orders += 1
  }
  const days = Object.values(pastDays)
  const byProduct = new Map<string, Row>()
  for (const o of db.orders.filter((o) => new Date(o.date) >= start)) {
    for (const i of o.items) {
      const p = db.products.find((x) => x.id === i.productId)!
      const e = byProduct.get(p.id) ?? { productId: p.id, name: p.name, size: p.size, color: p.color, sku: p.sku, unit: i.unit, quantity: 0, revenue: 0 }
      e.quantity = roundQuantity(e.quantity + i.quantity, i.unit)
      e.revenue = roundMoney(e.revenue + i.price * i.quantity)
      byProduct.set(p.id, e)
    }
  }
  return {
    todayByHour,
    averageByHour: todayByHour.map((_, h) => (days.length ? days.reduce((s, d) => s + d[h], 0) / days.length : 0)),
    comparedDays: days.length,
    week: Array.from({ length: 7 }, (_, i) => {
      const key = dayKeyOf(startOfDay(6 - i))
      return { date: key, amount: roundMoney(week[key]?.amount ?? 0), orders: week[key]?.orders ?? 0 }
    }),
    topItems: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  }
}

// ------------------------------------------------------------------------------- router

const contains = (value: unknown, q: string) => String(value ?? '').toLowerCase().includes(q.toLowerCase())

async function route(method: string, path: string, query: URLSearchParams, body: Row, headers: Headers): Promise<[number, unknown]> {
  const seg = path.split('/').filter(Boolean)
  const at = (i: number) => seg[i]
  const is = (m: string, pattern: string) => {
    if (m !== method) return false
    const parts = pattern.split('/').filter(Boolean)
    return parts.length === seg.length && parts.every((p, i) => p.startsWith(':') || p === seg[i])
  }

  // Auth and staff
  if (is('POST', 'auth/login')) {
    const user = db.users.find((u) => u.employeeId === body.employeeId && u.isActive)
    const shared = user?.role === 'CASHIER' && db.settings.cashierPassword && body.password === db.settings.cashierPassword
    if (!user || (user.password !== body.password && !shared)) throw new HttpError(401, 'INVALID_CREDENTIALS')
    return [200, { user: userView(user), token: `demo-token-${user.id}` }]
  }
  if (is('POST', 'auth/change-password')) {
    const user = db.users.find((u) => u.employeeId === body.employeeId)
    if (!user || user.password !== body.currentPassword) throw new HttpError(401, 'WRONG_CURRENT_PASSWORD')
    user.password = body.newPassword
    return [200, { message: 'ok' }]
  }
  if (is('GET', 'users')) return auth(headers, true), [200, db.users.map(userView)]
  if (is('POST', 'users')) {
    auth(headers, true)
    if (db.users.some((u) => u.employeeId === body.employeeId)) throw new HttpError(409, 'EMPLOYEE_ID_TAKEN')
    const user = { id: id(), createdAt: iso(new Date()), isActive: true, ...body, phone: phoneOrNull(body.phone) }
    db.users.unshift(user)
    return [201, userView(user)]
  }
  if (is('PUT', 'users/:id')) {
    auth(headers, true)
    const user = db.users.find((u) => u.id === at(1))!
    Object.assign(user, body, body.phone !== undefined ? { phone: phoneOrNull(body.phone) } : {})
    return [200, userView(user)]
  }
  if (is('POST', 'users/:id/reset-token')) return auth(headers, true), [200, { token: 'demo-reset' }]
  if (is('POST', 'users/:id/reset-password')) {
    const user = db.users.find((u) => u.id === at(1))!
    user.password = body.newPassword
    return [200, { message: 'ok' }]
  }

  // Products
  if (is('GET', 'products')) {
    const search = query.get('search') ?? ''
    const page = Number(query.get('page') ?? 1)
    const limit = Number(query.get('limit') ?? 50)
    const all = db.products
      .filter((p) => !search || [p.name, p.sku, p.barcode, p.category].some((v) => contains(v, search)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const products = all.slice((page - 1) * limit, page * limit).map(clone)
    return [200, { products, total: all.length, page, limit, hasMore: page * limit < all.length }]
  }
  if (is('POST', 'products') || is('PUT', 'products/:id')) {
    const user = auth(headers)
    if (user.role !== 'ADMIN') {
      const admin = db.users.find((u) => u.role === 'ADMIN')
      if (headers.get('x-admin-verification-key') !== admin?.password) throw new HttpError(403, 'ADMIN_VERIFICATION_REQUIRED')
    }
    const current = method === 'PUT' ? db.products.find((p) => p.id === at(1)) : null
    const unit = body.unit ?? current?.unit ?? 'piece'
    if (!isUnitCode(unit)) throw new HttpError(400, 'VALIDATION')
    const clash = (k: 'sku' | 'barcode') => body[k] && db.products.find((p) => p[k] === body[k] && p.id !== current?.id)
    if (clash('sku')) throw new HttpError(409, 'SKU_TAKEN', { product: clash('sku').name })
    if (clash('barcode')) throw new HttpError(409, 'BARCODE_TAKEN', { product: clash('barcode').name })
    const data = { ...body, unit, ...(body.stock !== undefined ? { stock: roundQuantity(body.stock, unit) } : {}), updatedAt: iso(new Date()) }
    if (current) return Object.assign(current, data), [200, clone(current)]
    const product = { id: id(), size: null, color: null, supplier: null, supplierId: null, taxRate: 0, createdAt: iso(new Date()), ...data }
    db.products.push(product)
    return [201, clone(product)]
  }
  if (is('DELETE', 'products/:id')) {
    auth(headers)
    if (db.orders.some((o) => o.items.some((i: Row) => i.productId === at(1)))) throw new HttpError(409, 'PRODUCT_HAS_SALES')
    db.products = db.products.filter((p) => p.id !== at(1))
    return [204, null]
  }
  if (is('GET', 'inventory/low-stock')) {
    const threshold = (p: Row) => UNITS[isUnitCode(p.unit) ? p.unit : 'piece'].lowStockAt
    return [200, db.products.filter((p) => p.stock <= threshold(p)).sort((a, b) => a.stock / threshold(a) - b.stock / threshold(b)).slice(0, 10).map(clone)]
  }

  // Settings
  if (is('GET', 'settings')) return [200, settingsView(db.settings)]
  if (is('PUT', 'settings')) {
    auth(headers, true)
    const { cashierPassword, hasCashierPassword, ...rest } = body
    if (rest.phone) rest.phone = phoneOrNull(rest.phone)
    Object.assign(db.settings, rest)
    if (cashierPassword !== undefined) db.settings.cashierPassword = cashierPassword || null
    return [200, settingsView(db.settings)]
  }

  // Sales
  if (is('POST', 'orders')) return [201, orderView(createOrder(body, auth(headers).id))]
  if (is('GET', 'orders')) {
    const search = query.get('search') ?? ''
    const methods = query.getAll('methods')
    const status = query.get('status')
    const start = query.get('startDate') ? new Date(`${query.get('startDate')}T00:00:00`) : null
    const end = query.get('endDate') ? new Date(`${query.get('endDate')}T23:59:59.999`) : null
    const page = Number(query.get('page') ?? 1)
    const limit = Number(query.get('limit') ?? 50)
    const all = db.orders
      .filter((o) => !search || [o.invoiceNo, o.customerName, o.customerMobile].some((v) => contains(v, search.replace(/\s/g, ''))) || contains(o.customerName, search))
      .filter((o) => !start || new Date(o.date) >= start)
      .filter((o) => !end || new Date(o.date) <= end)
      .filter((o) => !status || o.status === status)
      .filter((o) => !query.get('customerId') || o.customerId === query.get('customerId'))
      .filter((o) => !methods.length || db.payments.some((p) => p.orderId === o.id && methods.includes(p.method)) || (methods.includes('CREDIT') && o.totalAmount - o.amountPaid > 0.004))
      .sort((a, b) => b.date.localeCompare(a.date))
    const orders = all.slice((page - 1) * limit, page * limit).map((o) => {
      const view = orderView(o)
      return { ...view, payments: view.payments.map((p: Row) => ({ method: p.method, amount: p.amount })), _count: { items: o.items.length } }
    })
    return [200, { orders, total: all.length, page, limit, hasMore: page * limit < all.length }]
  }
  if (is('GET', 'orders/:id')) {
    const order = db.orders.find((o) => o.id === at(1))
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND')
    return [200, orderView(order)]
  }
  if (is('POST', 'orders/:id/refunds')) {
    const user = auth(headers)
    const order = db.orders.find((o) => o.id === at(1))
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND')
    return [201, refund(order, body, user.id)]
  }

  // Customers
  if (is('GET', 'customers')) {
    auth(headers)
    const search = query.get('search') ?? ''
    const list = db.customers
      .filter((c) => !search || contains(c.name, search) || contains(c.phone, search.replace(/\s/g, '')))
      .filter((c) => query.get('owing') !== '1' || c.balance > 0)
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
    const owing = db.customers.filter((c) => c.balance > 0)
    return [200, { customers: list.slice(0, Number(query.get('limit') ?? 50)).map(clone), totalOwed: sumMoney(owing.map((c) => c.balance)), owingCount: owing.length }]
  }
  if (is('POST', 'customers') || is('PUT', 'customers/:id')) {
    auth(headers)
    const current = method === 'PUT' ? db.customers.find((c) => c.id === at(1)) : null
    const phone = body.phone !== undefined ? phoneOrNull(body.phone) : current?.phone ?? null
    const taken = phone && db.customers.find((c) => c.phone === phone && c.id !== current?.id)
    if (taken) throw new HttpError(409, 'PHONE_TAKEN', { name: taken.name })
    if (current) return Object.assign(current, body, { phone, updatedAt: iso(new Date()) }), [200, clone(current)]
    const customer = { id: id(), address: null, notes: null, creditLimit: null, balance: 0, createdAt: iso(new Date()), updatedAt: iso(new Date()), ...body, phone }
    db.customers.push(customer)
    return [201, clone(customer)]
  }
  if (is('GET', 'customers/:id')) {
    auth(headers)
    const customer = db.customers.find((c) => c.id === at(1))
    if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND')
    const orders = db.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50).map(clone)
    const repayments = db.payments.filter((p) => p.customerId === customer.id && p.kind === 'REPAYMENT').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone)
    return [200, { customer: clone(customer), orders, repayments }]
  }
  if (is('POST', 'customers/:id/payments')) {
    const user = auth(headers)
    const customer = db.customers.find((c) => c.id === at(1))
    if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND')
    const amount = roundMoney(Number(body.amount))
    if (!(amount > 0) || !(SETTLING_METHOD_CODES as string[]).includes(body.method)) throw new HttpError(400, 'INVALID_AMOUNT')
    if (amount - customer.balance > 0.004) throw new HttpError(400, 'AMOUNT_EXCEEDS_BALANCE', { balance: customer.balance })
    const unpaid = db.orders.filter((o) => o.customerId === customer.id && o.balanceDue > 0).sort((a, b) => a.date.localeCompare(b.date))
    const { allocations } = allocateRepayment(amount, unpaid as any)
    for (const a of allocations) {
      const o = db.orders.find((x) => x.id === a.id)!
      o.balanceDue = roundMoney(o.balanceDue - a.amount)
      o.status = orderStatus(o as any)
    }
    const payment = { id: id(), kind: 'REPAYMENT', method: body.method, amount, tendered: null, reference: body.reference ?? null, orderId: allocations.length === 1 ? allocations[0].id : null, customerId: customer.id, userId: user.id, createdAt: iso(new Date()) }
    db.payments.push(payment)
    customer.balance = Math.max(0, roundMoney(customer.balance - amount))
    return [201, { payment, customer: clone(customer), allocations }]
  }

  // Suppliers and purchases
  if (is('GET', 'suppliers')) {
    auth(headers)
    const search = query.get('search') ?? ''
    return [200, { suppliers: db.suppliers.filter((s) => !search || contains(s.name, search)).sort((a, b) => b.balance - a.balance).map(clone), totalOwed: sumMoney(db.suppliers.map((s) => s.balance)) }]
  }
  if (is('POST', 'suppliers') || is('PUT', 'suppliers/:id')) {
    auth(headers, true)
    const current = method === 'PUT' ? db.suppliers.find((s) => s.id === at(1)) : null
    const data = { ...body, ...(body.phone !== undefined ? { phone: phoneOrNull(body.phone) } : {}) }
    if (current) return Object.assign(current, data), [200, clone(current)]
    const supplier = { id: id(), address: null, notes: null, phone: null, balance: 0, createdAt: iso(new Date()), updatedAt: iso(new Date()), ...data }
    db.suppliers.push(supplier)
    return [201, clone(supplier)]
  }
  if (is('GET', 'suppliers/:id')) {
    auth(headers)
    const supplier = db.suppliers.find((s) => s.id === at(1))
    if (!supplier) throw new HttpError(404, 'SUPPLIER_NOT_FOUND')
    return [200, {
      supplier: clone(supplier),
      purchases: db.purchases.filter((p) => p.supplierId === supplier.id).map((p) => ({ ...clone(p), _count: { items: p.items.length } })),
      payments: db.supplierPayments.filter((p) => p.supplierId === supplier.id).map(clone),
    }]
  }
  if (is('POST', 'suppliers/:id/payments')) {
    const user = auth(headers, true)
    const supplier = db.suppliers.find((s) => s.id === at(1))
    if (!supplier) throw new HttpError(404, 'SUPPLIER_NOT_FOUND')
    const amount = roundMoney(Number(body.amount))
    if (amount - supplier.balance > 0.004) throw new HttpError(400, 'AMOUNT_EXCEEDS_BALANCE', { balance: supplier.balance })
    const unpaid = db.purchases.filter((p) => p.supplierId === supplier.id && p.balanceDue > 0).sort((a, b) => a.date.localeCompare(b.date))
    for (const a of allocateRepayment(amount, unpaid as any).allocations) {
      const p = db.purchases.find((x) => x.id === a.id)!
      p.balanceDue = roundMoney(p.balanceDue - a.amount)
      p.amountPaid = roundMoney(p.amountPaid + a.amount)
    }
    db.supplierPayments.push({ id: id(), supplierId: supplier.id, purchaseId: null, method: body.method, amount, reference: body.reference ?? null, userId: user.id, createdAt: iso(new Date()) })
    supplier.balance = Math.max(0, roundMoney(supplier.balance - amount))
    return [201, { supplier: clone(supplier) }]
  }
  if (is('GET', 'purchases')) {
    auth(headers)
    const purchases = [...db.purchases]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((p) => ({ ...clone(p), supplier: p.supplierId ? { id: p.supplierId, name: db.suppliers.find((s) => s.id === p.supplierId)?.name } : null, _count: { items: p.items.length } }))
    return [200, { purchases, total: purchases.length, hasMore: false }]
  }
  if (is('POST', 'purchases')) {
    const user = auth(headers, true)
    const supplier = body.supplierId ? db.suppliers.find((s) => s.id === body.supplierId) : null
    if (body.supplierId && !supplier) throw new HttpError(404, 'SUPPLIER_NOT_FOUND')
    const lines = (body.items ?? []).map((i: Row) => {
      const product = db.products.find((p) => p.id === i.productId)
      if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND')
      if (!isValidQuantity(i.quantity, product.unit)) throw new HttpError(400, 'INVALID_QUANTITY', { product: product.name })
      return { product, quantity: roundQuantity(i.quantity, product.unit), unitCost: roundMoney(i.unitCost) }
    })
    const totalAmount = sumMoney(lines.map((l: Row) => l.quantity * l.unitCost))
    const amountPaid = Math.min(roundMoney(Number(body.amountPaid ?? 0)), totalAmount)
    const balanceDue = roundMoney(totalAmount - amountPaid)
    if (balanceDue > 0 && !supplier) throw new HttpError(400, 'SUPPLIER_REQUIRED_FOR_BALANCE')
    const purchase = {
      id: id(),
      purchaseNo: number('ACH', db.purchases.length),
      supplierId: supplier?.id ?? null,
      reference: body.reference ?? null,
      date: iso(new Date()),
      totalAmount,
      amountPaid,
      balanceDue,
      userId: user.id,
      items: lines.map((l: Row) => ({ id: id(), productId: l.product.id, quantity: l.quantity, unitCost: l.unitCost })),
    }
    db.purchases.push(purchase)
    for (const l of lines) {
      l.product.stock = roundQuantity(l.product.stock + l.quantity, l.product.unit)
      if (body.updateCostPrice !== false) l.product.costPrice = l.unitCost
    }
    if (amountPaid > 0) db.supplierPayments.push({ id: id(), supplierId: supplier?.id ?? null, purchaseId: purchase.id, method: body.paymentMethod ?? 'CASH', amount: amountPaid, reference: null, userId: user.id, createdAt: iso(new Date()) })
    if (supplier && balanceDue > 0) supplier.balance = roundMoney(supplier.balance + balanceDue)
    return [201, { ...clone(purchase), supplier: clone(supplier) }]
  }

  // Reports
  if (is('GET', 'reports')) {
    auth(headers, true)
    const [fy, fm, fd] = (query.get('from') ?? '').split('-').map(Number)
    const [ty, tm, td] = (query.get('to') ?? '').split('-').map(Number)
    return [200, report(new Date(fy, fm - 1, fd), new Date(ty, tm - 1, td + 1), query.get('groupBy') === 'month' ? 'month' : 'day')]
  }
  if (is('GET', 'analytics/summary')) {
    const r = report(startOfDay(), new Date(Date.now() + 60_000), 'day')
    const t = r.totals
    return [200, { revenue: t.sales, net: t.net, tax: t.tax, orders: t.orders, discounts: t.discounts, refunds: t.refunds, profit: t.profit, creditGiven: t.creditGiven, repayments: r.repayments, payments: r.moneyIn, refundsOut: r.refundsOut, cash: r.cash, outstanding: r.outstanding }]
  }
  if (is('GET', 'analytics/today')) return [200, today()]

  throw new HttpError(404, 'NOT_FOUND')
}

/** Routes fetch('/api/...') to the in-memory API. Everything else goes to the network. */
export function installMockApi() {
  seedData()
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init)
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 80))
    const headers = new Headers(init.headers)
    const body = init.body ? JSON.parse(String(init.body)) : {}
    try {
      const [status, data] = await route((init.method ?? 'GET').toUpperCase(), url.pathname.slice(5), url.searchParams, body, headers)
      return status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    } catch (error) {
      const e = error instanceof HttpError ? error : new HttpError(500, 'SERVER_ERROR')
      if (!(error instanceof HttpError)) console.error(error)
      return new Response(JSON.stringify({ error: e.code, code: e.code, details: e.details }), { status: e.status, headers: { 'Content-Type': 'application/json' } })
    }
  }
}

// Unused here but kept typed against the real unit list, so a new unit fails the demo build.
export const SUPPORTED_UNITS = UNIT_CODES
