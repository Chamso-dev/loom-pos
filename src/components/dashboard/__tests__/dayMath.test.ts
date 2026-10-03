import { describe, expect, it } from 'vitest'
import { hourLabel, localDate } from '../dayMath'

describe('dashboard date helpers', () => {
  it('labels hours on the 24-hour clock', () => {
    expect([hourLabel(0), hourLabel(9), hourLabel(15), hourLabel(24)]).toEqual(['00:00', '09:00', '15:00', '00:00'])
  })

  it('parses date keys without a UTC shift', () => {
    expect(localDate('2026-10-01').getDate()).toBe(1)
  })
})
