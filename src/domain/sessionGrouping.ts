import type { SessionRowUi } from './sessionView'
import { dayKeyOf, monthLabel } from './uiText'

/** 场次列表按月分组后的一组。 */
export interface SessionMonthGroup {
  yearMonth: string
  /** 形如「2026年10月」。 */
  label: string
  /** 本组内的场次，顺序沿用传入顺序（playedAt 倒序）。 */
  rows: SessionRowUi[]
  sessionCount: number
  /** 本人这些场次的净额合计，分。 */
  selfNetMinor: number
}

/**
 * 场次列表的按月分组。
 *
 * 纯函数。只做「同月归一组」，**不重新排序**：顺序依旧由 playedAt 倒序决定，
 * 分组不偷偷改掉用户熟悉的排序。
 */
export function groupByMonth(rows: SessionRowUi[], locale = 'zh-CN'): SessionMonthGroup[] {
  const grouped = new Map<string, SessionRowUi[]>()
  for (const row of rows) {
    const key = dayKeyOf(row.playedAt).slice(0, 7)
    const list = grouped.get(key)
    if (list) list.push(row)
    else grouped.set(key, [row])
  }
  return [...grouped.entries()].map(([yearMonth, monthRows]) => ({
    yearMonth,
    label: monthLabel(yearMonth, locale),
    rows: monthRows,
    sessionCount: monthRows.length,
    selfNetMinor: monthRows.reduce((sum, it) => sum + it.selfNetMinor, 0),
  }))
}
