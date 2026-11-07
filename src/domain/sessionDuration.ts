/**
 * 一场对局的时长。
 *
 * 表格里只存**结束时间**与时长——打完这一刻是确定的，用户不必回忆几点开局；
 * 这一场的「中点」由两者算出，早场 / 下午场 / 晚场按中点落在哪一段判定。
 *
 * 时长本身不参与任何金额与统计计算，它只影响时段归类。
 */

/** 1 小时 = 60 分钟。 */
export const MINUTES_PER_HOUR = 60

/**
 * 输入粒度：0.1 小时 = 6 分钟。
 *
 * 时长一律是它的整数倍——解析入口只接受一位小数，反写回输入框时才能精确还原。
 */
export const MINUTES_PER_TENTH_HOUR = 6

/** 用户没填时按 4 小时算。 */
export const DEFAULT_MINUTES = 4 * MINUTES_PER_HOUR

/** 下限 0.5 小时：再短不像一场麻将，多半是填错了。 */
export const MIN_MINUTES = 30

/** 上限 24 小时：超过一天的「一局」不可能存在。 */
export const MAX_MINUTES = 24 * MINUTES_PER_HOUR

const MILLIS_PER_MINUTE = 60_000

/**
 * 时长是否合法：落在 0.5～24 小时之间，且是输入粒度（6 分钟）的整数倍。
 */
export function isValidDuration(minutes: number): boolean {
  return minutes >= MIN_MINUTES && minutes <= MAX_MINUTES && minutes % MINUTES_PER_TENTH_HOUR === 0
}

/**
 * 由结束时间与时长倒推开始时间。
 *
 * 只做减法，不碰时区：存储全程是 UTC epoch 毫秒。
 */
export function startAt(playedAt: number, durationMinutes: number): number {
  return playedAt - durationMinutes * MILLIS_PER_MINUTE
}

/**
 * 这一场的中点。时段是按它判定的。
 *
 * 用中点而不是开始时间，是因为一场横跨 17:00 的牌局（17:30 打到 21:30）
 * 既不是纯粹的下午场也不是纯粹的晚场，中点落在哪一段就是「主要发生在哪一段」。
 */
export function midpointAt(playedAt: number, durationMinutes: number): number {
  return playedAt - (durationMinutes * MILLIS_PER_MINUTE) / 2
}

/**
 * 分钟 → 「小时」文本：240 -> `4`、270 -> `4.5`、30 -> `0.5`。
 * 不四舍五入；合法值一定是 6 分钟的整数倍。
 */
export function formatHours(minutes: number): string {
  const hours = Math.trunc(minutes / MINUTES_PER_HOUR)
  const rest = minutes % MINUTES_PER_HOUR
  if (rest === 0) return String(hours)
  return `${hours}.${rest / MINUTES_PER_TENTH_HOUR}`
}
