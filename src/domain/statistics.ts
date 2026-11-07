import type { TimeSlot } from './timeSlot'
import { TIME_SLOT_DISPLAY_ORDER } from './timeSlot'

/**
 * 个人跨场统计。
 *
 * 全部由已保存场次的净金额实时计算，不另存手工累计，也不维护独立账本。
 */
export interface PlayerStatistics {
  /** 已记录场数 = 该玩家参与的 Session 数。 */
  sessionCount: number
  winCount: number
  lossCount: number
  drawCount: number
  /** 累计赢钱 = 各场正净金额之和。 */
  winMinor: number
  /** 累计输钱 = 各场负净金额绝对值之和，非负。 */
  lossMinor: number
}

export const EMPTY_STATISTICS: PlayerStatistics = {
  sessionCount: 0,
  winCount: 0,
  lossCount: 0,
  drawCount: 0,
  winMinor: 0,
  lossMinor: 0,
}

/** 净输赢 = 累计赢钱 - 累计输钱。 */
export function netMinorOf(statistics: PlayerStatistics): number {
  return statistics.winMinor - statistics.lossMinor
}

/**
 * 场均净输赢 = 净输赢 ÷ 场数，四舍五入到分。
 * 没有场次时为 0，避免除零；全程整数运算。
 */
export function averageNetMinor(statistics: PlayerStatistics): number {
  if (statistics.sessionCount === 0) return 0
  return divideRounded(netMinorOf(statistics), statistics.sessionCount)
}

/**
 * 由某位玩家的各场净金额（分）计算统计。
 * 赢场数 + 输场数 + 持平场数恒等于已记录场数。
 */
export function statisticsOf(netMinors: number[]): PlayerStatistics {
  let winCount = 0
  let lossCount = 0
  let drawCount = 0
  let winMinor = 0
  let lossMinor = 0
  for (const net of netMinors) {
    if (net > 0) {
      winCount++
      winMinor += net
    } else if (net < 0) {
      lossCount++
      lossMinor += -net
    } else {
      drawCount++
    }
  }
  return {
    sessionCount: netMinors.length,
    winCount,
    lossCount,
    drawCount,
    winMinor,
    lossMinor,
  }
}

/**
 * 整数除法，四舍五入（.5 向远离零的方向进位），不经过浮点。
 *
 * 负数必须单独走一遍，否则 `(value + divisor / 2) / divisor` 会把 -1.5 读成 -1。
 */
export function divideRounded(value: number, divisor: number): number {
  const half = Math.trunc(divisor / 2)
  return value >= 0 ? Math.trunc((value + half) / divisor) : -Math.trunc((-value + half) / divisor)
}

/** 某个时段（早场 / 下午场 / 晚场）的个人统计。 */
export interface TimeSlotStatistics {
  slot: TimeSlot
  statistics: PlayerStatistics
}

/** 该时段胜率，百分数取整（四舍五入）。分母含持平场。 */
export function winRatePercent(statistics: PlayerStatistics): number {
  if (statistics.sessionCount === 0) return 0
  return Math.trunc((statistics.winCount * 100 + Math.trunc(statistics.sessionCount / 2)) / statistics.sessionCount)
}

/**
 * 由「时段 → 该时段各场净额」生成三个时段的统计。
 * 返回值恒为三条，顺序固定为早 / 下午 / 晚；缺失的时段补成 0 场。
 */
export function timeSlotStatisticsOf(netMinorsBySlot: Map<TimeSlot, number[]>): TimeSlotStatistics[] {
  return TIME_SLOT_DISPLAY_ORDER.map((slot) => ({
    slot,
    statistics: statisticsOf(netMinorsBySlot.get(slot) ?? []),
  }))
}

/** 三个时段都是空的统计，用作还没读到数据时的初值。 */
export function blankTimeSlotStatistics(): TimeSlotStatistics[] {
  return timeSlotStatisticsOf(new Map())
}
