import { describe, expect, it } from 'vitest'
import { rankSeats } from './ranking'
import { suggestSettlement } from './settlement'
import { averageNetMinor, divideRounded, netMinorOf, statisticsOf, timeSlotStatisticsOf, winRatePercent } from './statistics'
import { extremesOf } from './sessionExtremes'
import { cumulativeTrend } from './trend'
import { timeSlotOfHour } from './timeSlot'
import { midnight, ts } from './testing/fixtures'

describe('ranking', () => {
  it('uses competition ranking so ties share a place', () => {
    const ranks = rankSeats([
      { seat: 0, netMinor: 500 },
      { seat: 1, netMinor: -200 },
      { seat: 2, netMinor: 500 },
      { seat: 3, netMinor: -800 },
    ])
    expect(ranks).toEqual([
      { seat: 0, rank: 1 },
      { seat: 2, rank: 1 },
      { seat: 1, rank: 3 },
      { seat: 3, rank: 4 },
    ])
  })
})

describe('settlement', () => {
  it('matches debtors and creditors greedily by size', () => {
    const transfers = suggestSettlement([
      { seat: 0, netMinor: 900 },
      { seat: 1, netMinor: -600 },
      { seat: 2, netMinor: -300 },
      { seat: 3, netMinor: 0 },
    ])
    expect(transfers).toEqual([
      { fromSeat: 1, toSeat: 0, amountMinor: 600 },
      { fromSeat: 2, toSeat: 0, amountMinor: 300 },
    ])
  })

  it('returns nothing when everybody is level', () => {
    expect(
      suggestSettlement([
        { seat: 0, netMinor: 0 },
        { seat: 1, netMinor: 0 },
      ]),
    ).toEqual([])
  })

  it('never emits more than three transfers for four seats', () => {
    const transfers = suggestSettlement([
      { seat: 0, netMinor: 100 },
      { seat: 1, netMinor: 200 },
      { seat: 2, netMinor: -150 },
      { seat: 3, netMinor: -150 },
    ])
    expect(transfers.length).toBeLessThanOrEqual(3)
    expect(transfers.reduce((sum, it) => sum + it.amountMinor, 0)).toBe(300)
  })
})

describe('divideRounded', () => {
  it('rounds half away from zero', () => {
    expect(divideRounded(10, 4)).toBe(3) // 2.5 -> 3
    expect(divideRounded(-10, 4)).toBe(-3) // -2.5 -> -3
    expect(divideRounded(7, 3)).toBe(2) // 2.33 -> 2
    expect(divideRounded(-7, 3)).toBe(-2) // -2.33 -> -2
    expect(divideRounded(5, 5)).toBe(1)
  })
})

describe('statistics', () => {
  const stats = statisticsOf([500, -200, 0, 300, -100])

  it('counts wins, losses and draws', () => {
    expect(stats.sessionCount).toBe(5)
    expect(stats.winCount).toBe(2)
    expect(stats.lossCount).toBe(2)
    expect(stats.drawCount).toBe(1)
  })

  it('accumulates winnings and losses separately', () => {
    expect(stats.winMinor).toBe(800)
    expect(stats.lossMinor).toBe(300)
    expect(netMinorOf(stats)).toBe(500)
  })

  it('computes the rounded average', () => {
    expect(averageNetMinor(stats)).toBe(100)
    expect(averageNetMinor(statisticsOf([]))).toBe(0)
  })

  it('keeps draws in the win-rate denominator', () => {
    // 2 wins out of 5 sessions -> 40%
    expect(winRatePercent(stats)).toBe(40)
  })

  it('always returns three time slots in display order', () => {
    const slots = timeSlotStatisticsOf(new Map([['EVENING', [100, -100]]]))
    expect(slots.map((it) => it.slot)).toEqual(['MORNING', 'AFTERNOON', 'EVENING'])
    expect(slots[0].statistics.sessionCount).toBe(0)
    expect(slots[2].statistics.sessionCount).toBe(2)
  })
})

describe('timeSlotOfHour', () => {
  it('puts late night into the evening slot', () => {
    expect(timeSlotOfHour(4)).toBe('EVENING')
    expect(timeSlotOfHour(5)).toBe('MORNING')
    expect(timeSlotOfHour(11)).toBe('MORNING')
    expect(timeSlotOfHour(12)).toBe('AFTERNOON')
    expect(timeSlotOfHour(17)).toBe('AFTERNOON')
    expect(timeSlotOfHour(18)).toBe('EVENING')
    expect(timeSlotOfHour(23)).toBe('EVENING')
  })
})

describe('sessionExtremes', () => {
  it('ignores draws and keeps the earliest tie', () => {
    const extremes = extremesOf([
      { playedAt: ts(2026, 10, 2, 18, 0), netMinor: 300 },
      { playedAt: ts(2026, 10, 1, 18, 0), netMinor: 300 },
      { playedAt: ts(2026, 10, 3, 18, 0), netMinor: -400 },
      { playedAt: ts(2026, 10, 4, 18, 0), netMinor: 0 },
    ])
    expect(extremes.bestWin?.playedAt).toBe(ts(2026, 10, 1, 18, 0))
    expect(extremes.worstLoss?.netMinor).toBe(-400)
  })

  it('returns null on both sides when every session is a draw', () => {
    expect(extremesOf([{ playedAt: ts(2026, 10, 1, 18, 0), netMinor: 0 }])).toEqual({
      bestWin: null,
      worstLoss: null,
    })
  })
})

describe('cumulativeTrend', () => {
  it('accumulates in chronological order', () => {
    const points = cumulativeTrend([
      { playedAt: ts(2026, 10, 3, 20, 0), netMinor: -100 },
      { playedAt: ts(2026, 10, 1, 20, 0), netMinor: 200 },
      { playedAt: ts(2026, 10, 2, 20, 0), netMinor: 50 },
    ])
    expect(points.map((it) => it.cumulativeMinor)).toEqual([200, 250, 150])
  })

  it('returns an empty list for no sessions', () => {
    expect(cumulativeTrend([])).toEqual([])
    expect(midnight(2026, 10, 1)).toBeGreaterThan(0)
  })
})
