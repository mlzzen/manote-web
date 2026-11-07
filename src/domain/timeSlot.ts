/**
 * 一场对局属于一天中的哪个时段：早场 / 下午场 / 晚场。
 *
 * 判定看的是**这一场的中点**（结束时间 − 时长 ÷ 2），与日期无关。
 * 用中点而不是结束时间或开始时间，是因为一场牌局常常横跨两个时段：
 * 17:30 打到 21:30，按开始时间算成下午场、按结束时间算成晚场，
 * 而中点 19:30 说明它主要发生在晚上。
 *
 * 麻将局经常打到后半夜，因此 00:00–04:59 归入晚场，
 * 而不是切出一个几乎没人用的「凌晨场」。
 */

export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING'

/** 早场起点（含）。 */
export const MORNING_START_HOUR = 5

/** 下午场起点（含）。 */
export const AFTERNOON_START_HOUR = 12

/** 晚场起点（含），一直持续到次日早场起点。 */
export const EVENING_START_HOUR = 18

/**
 * 展示与统计的固定顺序：早场 → 下午场 → 晚场。
 * 各处都遍历这个列表，而不是依赖对象键顺序。
 */
export const TIME_SLOT_DISPLAY_ORDER: readonly TimeSlot[] = ['MORNING', 'AFTERNOON', 'EVENING']

/** 按 0–23 的整点判定，便于直接钉死边界。 */
export function timeSlotOfHour(hour: number): TimeSlot {
  if (hour >= EVENING_START_HOUR || hour < MORNING_START_HOUR) return 'EVENING'
  if (hour >= AFTERNOON_START_HOUR) return 'AFTERNOON'
  return 'MORNING'
}

/** 按时间戳与本地时区判定（浏览器时区与界面显示一致）。 */
export function timeSlotOf(epochMillis: number): TimeSlot {
  return timeSlotOfHour(new Date(epochMillis).getHours())
}
