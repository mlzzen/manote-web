import { formatMinor } from './money'

/**
 * 界面上的展示文本与格式化。
 *
 * 金额一律经 money.ts 从整数分换算，不在这里做任何浮点运算。
 * 时间按浏览器本地时区显示，存储始终是 UTC epoch 毫秒。
 */

/** `¥12.30`（不带正号），列表与详情里的金额。 */
export function yuan(minor: number): string {
  return `¥${formatMinor(minor)}`
}

/**
 * `+¥12.30` / `-¥5.00` / `¥0.00`。
 * 正负号本身也表达输赢，因此颜色只是辅助，不是唯一线索。
 */
export function signedYuan(minor: number): string {
  if (minor > 0) return `+¥${formatMinor(minor)}`
  if (minor < 0) return `-¥${formatMinor(-minor)}`
  return `¥${formatMinor(0)}`
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

/** `2026.10.05`。 */
export function date(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${pad(d.getFullYear(), 4)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** `2026.10.05 21:30`。 */
export function dateTime(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${date(epochMillis)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 月历格子里那种极窄场合的金额：`+120`、`-45.5`、`+1.2万`。
 *
 * 去掉货币符号与千分位，元以下最多留一位，上万改用「万」。
 * 输赢的方向由正负号表达，颜色只是辅助。全程整数运算。
 */
export function compactSignedYuan(minor: number): string {
  const sign = minor > 0 ? '+' : minor < 0 ? '-' : ''
  const absolute = minor < 0 ? -minor : minor
  return sign + compactAmountBody(absolute)
}

function compactAmountBody(absolute: number): string {
  // 先折算到「角」，四舍五入：1 分以下在这个尺度上没有意义
  const tenths = Math.trunc((absolute + 5) / 10)
  if (tenths < 10_000) {
    if (tenths % 10 === 0) return String(tenths / 10)
    return `${Math.trunc(tenths / 10)}.${tenths % 10}`
  }
  // 千元以上只留整数元，格子才放得下
  if (tenths < 100_000) return String(Math.trunc((tenths + 5) / 10))
  const yuanValue = Math.trunc((absolute + 50) / 100)
  const whole = Math.trunc(yuanValue / 10_000)
  const decimal = Math.trunc((yuanValue % 10_000) / 1_000)
  return decimal === 0 ? `${whole}万` : `${whole}.${decimal}万`
}

/** `10.05`，用于紧凑列表。 */
export function monthDay(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** `14:30`。 */
export function timeOfDay(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 日期键（`2026-10-05`）→ `10.05`。 */
export function monthDayOfKey(dayKey: string): string {
  const [, month, day] = dayKey.split('-')
  return `${month}.${day}`
}

/** 日期键（`2026-10-05`）→ `2026.10.05`。 */
export function dateOfKey(dayKey: string): string {
  return dayKey.replace(/-/g, '.')
}

/** 年月键（`2026-10`）→ `2026年10月` / `October 2026`。 */
export function monthLabel(yearMonth: string, locale = 'zh-CN'): string {
  const [year, month] = yearMonth.split('-').map((it) => Number.parseInt(it, 10))
  if (locale.startsWith('zh')) return `${year}年${month}月`
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${monthNames[month - 1]} ${year}`
}

/**
 * `6/2`，柱状图横轴专用：**不补零**，也不带「月」「日」。
 * 十根柱子并排时每个槽位只有三四个字宽，`06.02` 会被裁掉一半。
 */
export function monthSlashDay(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 日期键 → 该日 0 点的本地时间戳。 */
export function dayKeyToMillis(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map((it) => Number.parseInt(it, 10))
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
}

/** 时间戳 → 本地日期键（`2026-10-05`）。 */
export function dayKeyOf(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * UUID 短串（前 8 位），用于区分同名麻友。
 * 只做展示与辨识，不作为标识使用——关联始终用完整 ID。
 */
export function shortId(id: string): string {
  return id.slice(0, 8)
}

/** 百分比取整（四舍五入），例如 1/10 → 10。 */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.trunc((part * 100 + Math.trunc(total / 2)) / total)
}

/** 星期的简称，跟随界面语言。 */
export function weekdayShort(epochMillis: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short' }).format(
    new Date(epochMillis),
  )
}

/** 顶栏上的「今天」，例如 `10.12 · 周一` / `10.12 · Mon`。 */
export function todayLabel(now: number, locale: string): string {
  return `${monthDay(now)} · ${weekdayShort(now, locale)}`
}

/**
 * 场次的时间区间，例如 `14:00 – 18:30`。
 *
 * 跨零点时把日期补上（`10.05 20:00 – 10.06 01:00`）——只写钟点的话，
 * 「20:00 – 01:00」会被读成一段倒退的时间。
 */
export function sessionClockRange(startedAt: number, playedAt: number): string {
  const sameDay = dayKeyOf(startedAt) === dayKeyOf(playedAt)
  const start = sameDay ? timeOfDay(startedAt) : `${monthDay(startedAt)} ${timeOfDay(startedAt)}`
  const end = sameDay ? timeOfDay(playedAt) : `${monthDay(playedAt)} ${timeOfDay(playedAt)}`
  return `${start} – ${end}`
}

/**
 * 时间区间加时长，例如 `14:00 – 18:30 · 4 小时`。
 *
 * 时段是按这一场的中点判定的，光看结束时间会显得自相矛盾，
 * 因此详情页与记一场的确认框都把区间写出来。
 */
export function sessionTimeRange(startedAt: number, playedAt: number, durationText: string): string {
  return `${sessionClockRange(startedAt, playedAt)} · ${durationText}`
}

/** 把本地日期与时分合成为时间戳。 */
export function combineDateAndTime(dayKey: string, hour: number, minute: number): number {
  const [year, month, day] = dayKey.split('-').map((it) => Number.parseInt(it, 10))
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}
