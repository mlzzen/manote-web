import type { DatedNet, TrendPoint } from './types'

/**
 * 累计净额走势。
 *
 * 输入是各场的净额，输出是逐场累加后的折线点。任何一场被修改或删除，
 * 重算一遍即可得到新的走势，不存在第二份需要同步的累计数据。
 */
export function cumulativeTrend(items: DatedNet[]): TrendPoint[] {
  let running = 0
  return [...items]
    .sort((a, b) => a.playedAt - b.playedAt)
    .map((item) => {
      running += item.netMinor
      return { playedAt: item.playedAt, netMinor: item.netMinor, cumulativeMinor: running }
    })
}
