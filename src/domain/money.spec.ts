import { describe, expect, it } from 'vitest'
import { describe as moneyDescribe, formatMinor, formatSigned, isWithinRange, outcomeLabel } from './money'
import { compactSignedYuan, signedYuan, yuan } from './uiText'

describe('money', () => {
  it('formats minor units with two decimals', () => {
    expect(formatMinor(1230)).toBe('12.30')
    expect(formatMinor(-500)).toBe('-5.00')
    expect(formatMinor(0)).toBe('0.00')
    expect(formatMinor(9)).toBe('0.09')
    expect(formatMinor(-9)).toBe('-0.09')
  })

  it('adds a plus sign only for positive signed values', () => {
    expect(formatSigned(1230)).toBe('+12.30')
    expect(formatSigned(-500)).toBe('-5.00')
    expect(formatSigned(0)).toBe('0.00')
  })

  it('describes outcomes in words, not only colour', () => {
    expect(moneyDescribe(1230)).toBe('赢 12.30 元')
    expect(moneyDescribe(-500)).toBe('输 5.00 元')
    expect(moneyDescribe(0)).toBe('持平 0.00 元')
  })

  it('enforces the ±10,000.00 range inclusively', () => {
    expect(isWithinRange(1_000_000)).toBe(true)
    expect(isWithinRange(-1_000_000)).toBe(true)
    expect(isWithinRange(1_000_001)).toBe(false)
    expect(isWithinRange(-1_000_001)).toBe(false)
  })

  it('labels outcomes neutrally', () => {
    expect(outcomeLabel(1)).toBe('赢')
    expect(outcomeLabel(-1)).toBe('输')
    expect(outcomeLabel(0)).toBe('持平')
  })
})

describe('uiText amounts', () => {
  it('prefixes the currency symbol', () => {
    expect(yuan(1230)).toBe('¥12.30')
    expect(yuan(-500)).toBe('¥-5.00')
  })

  it('signs positive amounts', () => {
    expect(signedYuan(1230)).toBe('+¥12.30')
    expect(signedYuan(-500)).toBe('-¥5.00')
    expect(signedYuan(0)).toBe('¥0.00')
  })

  it('compacts calendar-cell amounts', () => {
    expect(compactSignedYuan(12_000)).toBe('+120')
    expect(compactSignedYuan(-4550)).toBe('-45.5')
    expect(compactSignedYuan(123_000)).toBe('+1230')
    expect(compactSignedYuan(1_250_000)).toBe('+1.2万')
    expect(compactSignedYuan(0)).toBe('0')
  })
})
