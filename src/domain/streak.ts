import type { DatedNet } from './types'

/** 某一自然日的净额合计（分）。 */
export interface DayNet {
  /** 本地时区下的自然日，形如 `2026-10-05`。 */
  day: string
  /** 该日各场净额之和，分。 */
  netMinor: number
  /** 该日记录的场数。 */
  sessionCount: number
}

/**
 * 连输 / 连赢与单日极值。
 *
 * 持平（净额 = 0）既不算赢也不算输，会把当前连胜与连败**同时切断**。
 */
export interface StreakStats {
  currentWinStreak: number
  currentLossStreak: number
  longestWinStreak: number
  longestLossStreak: number
  bestDay: DayNet | null
  worstDay: DayNet | null
}

export const EMPTY_STREAKS: StreakStats = {
  currentWinStreak: 0,
  currentLossStreak: 0,
  longestWinStreak: 0,
  longestLossStreak: 0,
  bestDay: null,
  worstDay: null,
}

/** 时间戳 → 本地时区下的日期键，形如 `2026-10-05`。 */
export function localDayKey(epochMillis: number): string {
  const date = new Date(epochMillis)
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

/**
 * 计算连赢/连输与单日极值。
 *
 * 日期分组一律按浏览器时区，与界面显示同源，
 * 不会出现「单日最佳」指向一个界面上并不存在的日期。
 */
export function streaksOf(items: DatedNet[]): StreakStats {
  if (items.length === 0) return EMPTY_STREAKS

  const ordered = [...items].sort((a, b) => a.playedAt - b.playedAt)

  let longestWin = 0
  let longestLoss = 0
  let runWin = 0
  let runLoss = 0
  for (const item of ordered) {
    if (item.netMinor > 0) {
      runWin++
      runLoss = 0
    } else if (item.netMinor < 0) {
      runLoss++
      runWin = 0
    } else {
      // 持平把两条连续记录都打断
      runWin = 0
      runLoss = 0
    }
    if (runWin > longestWin) longestWin = runWin
    if (runLoss > longestLoss) longestLoss = runLoss
  }

  // 按日期升序分组求和；同额时 maxBy/minBy 命中的是最早的一天，结果稳定可复现
  const byDay = new Map<string, { netMinor: number; sessionCount: number }>()
  for (const item of ordered) {
    const key = localDayKey(item.playedAt)
    const existing = byDay.get(key)
    if (existing) {
      existing.netMinor += item.netMinor
      existing.sessionCount++
    } else {
      byDay.set(key, { netMinor: item.netMinor, sessionCount: 1 })
    }
  }
  const days: DayNet[] = [...byDay.entries()]
    .map(([day, value]) => ({ day, netMinor: value.netMinor, sessionCount: value.sessionCount }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))

  let bestDay: DayNet | null = null
  let worstDay: DayNet | null = null
  for (const day of days) {
    if (bestDay === null || day.netMinor > bestDay.netMinor) bestDay = day
    if (worstDay === null || day.netMinor < worstDay.netMinor) worstDay = day
  }

  return {
    currentWinStreak: runWin,
    currentLossStreak: runLoss,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    bestDay,
    worstDay,
  }
}
