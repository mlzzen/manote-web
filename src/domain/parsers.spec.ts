import { describe, expect, it } from 'vitest'
import { parseAmount } from './amountParser'
import { parseDuration } from './durationParser'
import { formatHours, isValidDuration, midpointAt, startAt } from './sessionDuration'

describe('parseAmount', () => {
  it('accepts plain and signed decimals', () => {
    expect(parseAmount('1')).toEqual({ ok: true, minor: 100 })
    expect(parseAmount('1.2')).toEqual({ ok: true, minor: 120 })
    expect(parseAmount('1.20')).toEqual({ ok: true, minor: 120 })
    expect(parseAmount('-5')).toEqual({ ok: true, minor: -500 })
    expect(parseAmount('-5.5')).toEqual({ ok: true, minor: -550 })
    expect(parseAmount(' 12.34 ')).toEqual({ ok: true, minor: 1234 })
  })

  it('rejects empty input', () => {
    expect(parseAmount('   ')).toEqual({ ok: false, reason: 'EMPTY' })
  })

  it('rejects malformed shapes', () => {
    for (const text of ['-', '.', '1.', '.5', '1.2.3', '1,000', '1 000', '1e3', '+5', 'abc', '--1']) {
      expect(parseAmount(text), text).toEqual({ ok: false, reason: 'INVALID_FORMAT' })
    }
  })

  it('rejects more than two decimals', () => {
    expect(parseAmount('1.001')).toEqual({ ok: false, reason: 'TOO_MANY_DECIMALS' })
  })

  it('enforces the range inclusively', () => {
    expect(parseAmount('10000.00')).toEqual({ ok: true, minor: 1_000_000 })
    expect(parseAmount('-10000.00')).toEqual({ ok: true, minor: -1_000_000 })
    expect(parseAmount('10000.01')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
    expect(parseAmount('9999999999')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
  })

  it('never goes through floating point', () => {
    // 0.29 * 100 在浮点下是 28.999999999999996
    expect(parseAmount('0.29')).toEqual({ ok: true, minor: 29 })
  })
})

describe('parseDuration', () => {
  it('accepts hours with at most one decimal', () => {
    expect(parseDuration('4')).toEqual({ ok: true, minutes: 240 })
    expect(parseDuration('4.5')).toEqual({ ok: true, minutes: 270 })
    expect(parseDuration('0.5')).toEqual({ ok: true, minutes: 30 })
    expect(parseDuration('24')).toEqual({ ok: true, minutes: 1440 })
  })

  it('rejects empty input', () => {
    expect(parseDuration('')).toEqual({ ok: false, reason: 'EMPTY' })
  })

  it('rejects malformed input', () => {
    for (const text of ['.', '4.', '-4', '4h', '4 5', '4.5.5']) {
      expect(parseDuration(text), text).toEqual({ ok: false, reason: 'INVALID_FORMAT' })
    }
  })

  it('rejects two decimals', () => {
    expect(parseDuration('4.55')).toEqual({ ok: false, reason: 'TOO_MANY_DECIMALS' })
  })

  it('enforces 0.5–24 hours', () => {
    expect(parseDuration('0.4')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
    expect(parseDuration('25')).toEqual({ ok: false, reason: 'OUT_OF_RANGE' })
  })
})

describe('sessionDuration', () => {
  it('only accepts 0.5–24h in 6-minute steps', () => {
    expect(isValidDuration(240)).toBe(true)
    expect(isValidDuration(30)).toBe(true)
    expect(isValidDuration(29)).toBe(false)
    expect(isValidDuration(1440)).toBe(true)
    expect(isValidDuration(1446)).toBe(false)
    expect(isValidDuration(0)).toBe(false)
    expect(isValidDuration(240 + 3)).toBe(false)
  })

  it('formats hours exactly, without rounding', () => {
    expect(formatHours(240)).toBe('4')
    expect(formatHours(270)).toBe('4.5')
    expect(formatHours(30)).toBe('0.5')
  })

  it('derives start and midpoint from the end time', () => {
    const end = 1_000_000_000
    expect(startAt(end, 240)).toBe(end - 240 * 60_000)
    expect(midpointAt(end, 240)).toBe(end - 120 * 60_000)
  })
})
