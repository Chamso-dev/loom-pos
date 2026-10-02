import { describe, expect, it } from 'vitest'
import { hourLabel, localDate, shapeDay } from '../dayMath'

const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m)
const today = Array(24).fill(0)
today[11] = 100
today[13] = 50
const avg = Array(24).fill(0)
avg[10] = 40
avg[12] = 60
avg[19] = 100

describe('dashboard day shape', () => {
  it('labels hours on the 24-hour clock', () => {
    expect([hourLabel(0), hourLabel(9), hourLabel(15), hourLabel(24)]).toEqual(['00:00', '09:00', '15:00', '00:00'])
  })

  it('parses date keys without a UTC shift', () => {
    expect(localDate('2026-10-01').getDate()).toBe(1)
  })

  it('spans the hours the shop trades', () => {
    const s = shapeDay(today, avg, at(13, 30))
    expect([s.start, s.end, s.nowAt]).toEqual([10, 20, 13.5])
    expect(s.todayPoints).toEqual([[10, 0], [11, 0], [12, 100], [13, 100], [13.5, 150]])
    expect(s.averageByNow).toBe(100)
  })

  it('clamps to closing time late in the evening', () => {
    const s = shapeDay(today, avg, at(23, 20))
    expect([s.nowAt, s.todayPoints.at(-1), s.averageByNow, s.averageTotal]).toEqual([20, [20, 150], 200, 200])
  })

  it('has one point before opening and defaults with no data', () => {
    expect(shapeDay(Array(24).fill(0), avg, at(8)).todayPoints).toEqual([[10, 0]])
    const empty = shapeDay(Array(24).fill(0), Array(24).fill(0), at(14))
    expect([empty.start, empty.end]).toEqual([10, 21])
  })
})
