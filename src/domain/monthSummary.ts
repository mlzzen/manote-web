import type { DatedNet } from './types'
import { statisticsOf, type PlayerStatistics, winRatePercent } from './statistics'
import { localDayKey, type DayNet } from './streak'

/**
 * 某个月的逐日战况与月度合计。
 *
 * `days` 里只有**真的打过的那几天**。没有记录的日子不在表里，
 * 界面据此把格子画成空白，而不是画一个「0 元」——
 * 「这天没打」和「这天打了但持平」是两件事。
 */
export interface MonthSummary {
  /** 形如 `2026-10`。 */
  yearMonth: string
  /** 键是自然日（`2026-10-05`），值是该日合计；按日期升序。 */
  days: Map<string, DayNet>
  statistics: PlayerStatistics
  /** 本月净额最高的一天（不要求为正）；一天都没记时为 null。 */
  bestDay: DayNet | null
  /** 本月净额最低的一天（不要求为负）；一天都没记时为 null。 */
  worstDay: DayNet | null
}

/** `2026-10` */
export function yearMonthKey(epochMillis: number): string {
  return localDayKey(epochMillis).slice(0, 7)
}

/** `2026-10`，由年月数字拼出。 */
export function yearMonthOf(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

export function emptyMonthSummary(yearMonth: string): MonthSummary {
  return {
    yearMonth,
    days: new Map(),
    statistics: statisticsOf([]),
    bestDay: null,
    worstDay: null,
  }
}

/**
 * 把各场净额按月归拢成逐日战况。
 *
 * 日期与月份一律按浏览器时区划分，与界面显示同源，
 * 不会出现「列表里 10 月 1 日的场次，月历里找不到」。
 */
export function monthSummaryOf(items: DatedNet[], yearMonth: string): MonthSummary {
  const grouped = new Map<string, number[]>()
  const monthNets: number[] = []
  for (const item of items) {
    const day = localDayKey(item.playedAt)
    if (day.slice(0, 7) !== yearMonth) continue
    const list = grouped.get(day)
    if (list) list.push(item.netMinor)
    else grouped.set(day, [item.netMinor])
    // 月度统计按**场**算，不按天算：一天里赢一场输一场，那是「一胜一负」，
    // 不是「一个持平日」。两者只在按天汇总时才会合并。
    monthNets.push(item.netMinor)
  }
  if (grouped.size === 0) return emptyMonthSummary(yearMonth)

  // 按日期升序遍历：同额时「最佳 / 最差单日」命中的是最早的一天
  const days = new Map<string, DayNet>()
  for (const day of [...grouped.keys()].sort()) {
    const nets = grouped.get(day)!
    days.set(day, { day, netMinor: nets.reduce((sum, it) => sum + it, 0), sessionCount: nets.length })
  }

  let bestDay: DayNet | null = null
  let worstDay: DayNet | null = null
  for (const day of days.values()) {
    if (bestDay === null || day.netMinor > bestDay.netMinor) bestDay = day
    if (worstDay === null || day.netMinor < worstDay.netMinor) worstDay = day
  }

  return {
    yearMonth,
    days,
    statistics: statisticsOf(monthNets),
    bestDay,
    worstDay,
  }
}

/** 本月场数。 */
export function monthSessionCount(summary: MonthSummary): number {
  return summary.statistics.sessionCount
}

/** 本月净额，分。 */
export function monthNetMinor(summary: MonthSummary): number {
  return summary.statistics.winMinor - summary.statistics.lossMinor
}

/** 本月胜率（百分数，四舍五入；分母含持平场）。 */
export function monthWinRatePercent(summary: MonthSummary): number {
  return winRatePercent(summary.statistics)
}
