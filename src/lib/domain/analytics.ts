import { roundMoney } from './money'

/**
 * Today's takings by product category, largest first: the top `limit` categories by name
 * and everything else folded into one "other" row (category null), so a chart never needs
 * more than limit + 1 bars.
 */
export function rankCategories(lines: Array<{ category: string | null | undefined; revenue: number }>, limit = 5) {
  const totals = new Map<string, number>()
  for (const l of lines) {
    const key = (l.category ?? '').trim() || '—'
    totals.set(key, (totals.get(key) ?? 0) + l.revenue)
  }
  const sorted = [...totals.entries()].map(([category, revenue]) => ({ category, revenue: roundMoney(revenue) })).sort((a, b) => b.revenue - a.revenue)
  const top: Array<{ category: string | null; revenue: number }> = sorted.slice(0, limit)
  const rest = roundMoney(sorted.slice(limit).reduce((sum, c) => sum + c.revenue, 0))
  if (rest > 0) top.push({ category: null, revenue: rest })
  return top
}
