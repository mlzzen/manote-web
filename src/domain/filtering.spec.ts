import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  applySearch,
  emptyFilters,
  isFilterActive,
  matchesFilters,
  outcomeOf,
  type SessionFilters,
} from './sessionFiltering'
import { groupByMonth } from './sessionGrouping'
import { timeSlotOfSession, toRowUi } from './sessionView'
import type { SessionRowUi } from './sessionView'
import { ts } from './testing/fixtures'

function row(overrides: Partial<SessionRowUi> = {}): SessionRowUi {
  return {
    id: 'a',
    title: '麻将对局',
    note: '',
    playedAt: ts(2026, 10, 5, 21, 30),
    timeSlot: 'EVENING',
    selfNetMinor: 100,
    opponentNames: ['老王'],
    opponentPlayerIds: ['p-wang'],
    durationMinutes: 240,
    ...overrides,
  }
}

const filters = (overrides: Partial<SessionFilters> = {}): SessionFilters => ({
  ...emptyFilters(),
  ...overrides,
})

describe('sessionFiltering', () => {
  it('treats an empty filter set as "no filtering"', () => {
    expect(isFilterActive(emptyFilters())).toBe(false)
    expect(applyFilters([row()], emptyFilters())).toHaveLength(1)
  })

  it('ANDs across groups and ORs within a group', () => {
    const rows = [
      row({ id: 'a', timeSlot: 'EVENING', selfNetMinor: 100 }),
      row({ id: 'b', timeSlot: 'MORNING', selfNetMinor: -100 }),
      row({ id: 'c', timeSlot: 'MORNING', selfNetMinor: 50 }),
    ]
    const next = filters({ timeSlots: new Set(['MORNING']), outcomes: new Set(['WIN']) })
    expect(applyFilters(rows, next).map((it) => it.id)).toEqual(['c'])
  })

  it('filters by year, month and day with narrowing semantics', () => {
    const rows = [row({ id: 'a', playedAt: ts(2026, 10, 5, 21, 0) }), row({ id: 'b', playedAt: ts(2025, 10, 5, 21, 0) })]
    expect(applyFilters(rows, filters({ year: 2026 })).map((it) => it.id)).toEqual(['a'])
    expect(applyFilters(rows, filters({ month: 10 })).map((it) => it.id)).toEqual(['a', 'b'])
    expect(applyFilters(rows, filters({ date: '2025-10-05' })).map((it) => it.id)).toEqual(['b'])
  })

  it('matches friends by id, not by nickname', () => {
    const rows = [row({ id: 'a', opponentPlayerIds: ['p-wang'] }), row({ id: 'b', opponentPlayerIds: ['p-li'] })]
    expect(applyFilters(rows, filters({ friendIds: new Set(['p-li']) })).map((it) => it.id)).toEqual(['b'])
  })

  it('classifies outcomes by sign', () => {
    expect(outcomeOf(1)).toBe('WIN')
    expect(outcomeOf(-1)).toBe('LOSS')
    expect(outcomeOf(0)).toBe('DRAW')
  })

  it('searches title, note and opponent names', () => {
    const rows = [
      row({ id: 'a', title: '周五夜战' }),
      row({ id: 'b', note: '通宵' }),
      row({ id: 'c', opponentNames: ['小李'] }),
    ]
    expect(applySearch(rows, '周五').map((it) => it.id)).toEqual(['a'])
    expect(applySearch(rows, '通宵').map((it) => it.id)).toEqual(['b'])
    expect(applySearch(rows, '小李').map((it) => it.id)).toEqual(['c'])
    expect(applySearch(rows, '  ').map((it) => it.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps rows that only fail an unused date dimension untouched', () => {
    expect(matchesFilters(row(), filters())).toBe(true)
  })
})

describe('sessionGrouping', () => {
  it('groups consecutive months without reordering rows', () => {
    const rows = [
      row({ id: 'a', playedAt: ts(2026, 10, 20, 20, 0) }),
      row({ id: 'b', playedAt: ts(2026, 10, 2, 20, 0) }),
      row({ id: 'c', playedAt: ts(2026, 9, 30, 20, 0) }),
    ]
    const groups = groupByMonth(rows)
    expect(groups.map((it) => it.yearMonth)).toEqual(['2026-10', '2026-09'])
    expect(groups[0].rows.map((it) => it.id)).toEqual(['a', 'b'])
    expect(groups[0].sessionCount).toBe(2)
  })

  it('sums the member nets per group', () => {
    const groups = groupByMonth([
      row({ id: 'a', selfNetMinor: 500 }),
      row({ id: 'b', selfNetMinor: -200 }),
    ])
    expect(groups[0].selfNetMinor).toBe(300)
  })
})

describe('time slot of a session', () => {
  it('uses the midpoint, not the end time', () => {
    // 17:30 打到 21:30：中点 19:30 -> 晚场
    const playedAt = ts(2026, 10, 5, 21, 30)
    expect(timeSlotOfSession(playedAt, 240)).toBe('EVENING')
    // 14:00 打到 18:30：中点 16:15 -> 下午场
    const afternoon = ts(2026, 10, 5, 18, 30)
    expect(timeSlotOfSession(afternoon, 270)).toBe('AFTERNOON')
    // 通宵到早上 6:00：中点 04:00 -> 仍算晚场
    const overnight = ts(2026, 10, 6, 6, 0)
    expect(timeSlotOfSession(overnight, 240)).toBe('EVENING')
  })

  it('exposes seat 0 as the self net', () => {
    const ui = toRowUi({
      session: {
        id: 's',
        title: '麻将对局',
        playedAt: ts(2026, 10, 5, 21, 0),
        durationMinutes: 240,
        note: '',
        createdAt: 0,
        updatedAt: 0,
        revision: 1,
        deletedAt: null,
      },
      results: [
        { sessionId: 's', seat: 0, playerId: 'self', nameSnapshot: '我', netMinor: 300 },
        { sessionId: 's', seat: 2, playerId: 'p', nameSnapshot: '老王', netMinor: -300 },
      ],
    })
    expect(ui.selfNetMinor).toBe(300)
    expect(ui.opponentNames).toEqual(['老王'])
  })
})
