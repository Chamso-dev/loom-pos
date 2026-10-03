import { describe, expect, it } from 'vitest'
import { addDays, daysUntilExpiry, EXPIRY_SOON_DAYS, expiryStatus, localDay, needsExpiryAttention, toExpiryDay } from '..'

describe('expiry', () => {
  it('reads stored values as calendar days', () => {
    expect(toExpiryDay('2026-10-05')).toBe('2026-10-05')
    expect(toExpiryDay('2026-10-05T00:00:00.000Z')).toBe('2026-10-05')
    expect(toExpiryDay(new Date(Date.UTC(2026, 9, 5)))).toBe('2026-10-05')
    expect(toExpiryDay('2026-02-30')).toBeNull()
    expect(toExpiryDay('')).toBeNull()
    expect(toExpiryDay(null)).toBeNull()
  })

  it('counts whole days across months, years and leap days', () => {
    expect(daysUntilExpiry('2026-10-05', '2026-10-02')).toBe(3)
    expect(daysUntilExpiry('2026-10-01', '2026-10-02')).toBe(-1)
    expect(daysUntilExpiry('2027-01-01', '2026-12-31')).toBe(1)
    expect(daysUntilExpiry('2028-03-01', '2028-02-28')).toBe(2)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('is still good on its expiry day and expired the day after', () => {
    expect(expiryStatus('2026-10-02', '2026-10-02')).toEqual({ day: '2026-10-02', days: 0, state: 'today' })
    expect(expiryStatus('2026-10-01', '2026-10-02')?.state).toBe('expired')
    expect(expiryStatus(addDays('2026-10-02', EXPIRY_SOON_DAYS), '2026-10-02')?.state).toBe('soon')
    expect(expiryStatus(addDays('2026-10-02', EXPIRY_SOON_DAYS + 1), '2026-10-02')?.state).toBe('ok')
    expect(expiryStatus(null, '2026-10-02')).toBeNull()
  })

  it('flags only products that need attention', () => {
    expect(needsExpiryAttention('2026-10-01', '2026-10-02')).toBe(true)
    expect(needsExpiryAttention('2026-10-10', '2026-10-02')).toBe(true)
    expect(needsExpiryAttention('2027-01-01', '2026-10-02')).toBe(false)
    expect(needsExpiryAttention(undefined, '2026-10-02')).toBe(false)
  })

  it('uses the local calendar day', () => {
    expect(localDay(new Date(2026, 9, 2, 23, 30))).toBe('2026-10-02')
  })
})

import { rankCategories } from '..'

describe('rankCategories', () => {
  it('ranks categories by takings and folds the tail into one other row', () => {
    const lines = [
      { category: 'Épicerie', revenue: 500 }, { category: 'Crèmerie', revenue: 200 }, { category: 'Épicerie', revenue: 100.1 },
      { category: 'Boissons', revenue: 50 }, { category: 'Légumes', revenue: 40 }, { category: 'Fruits', revenue: 30 },
      { category: 'Entretien', revenue: 20 }, { category: 'Vrac', revenue: 10 },
    ]
    expect(rankCategories(lines)).toEqual([
      { category: 'Épicerie', revenue: 600.1 },
      { category: 'Crèmerie', revenue: 200 },
      { category: 'Boissons', revenue: 50 },
      { category: 'Légumes', revenue: 40 },
      { category: 'Fruits', revenue: 30 },
      { category: null, revenue: 30 },
    ])
  })
  it('has no other row when everything fits', () => {
    expect(rankCategories([{ category: 'A', revenue: 1 }], 5)).toEqual([{ category: 'A', revenue: 1 }])
    expect(rankCategories([])).toEqual([])
  })
})
