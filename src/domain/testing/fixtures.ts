/**
 * 测试用的时间构造器。
 *
 * 一律按**本地时区**构造，断言也按本地时区读回，两边同源。
 * 不要在测试里写死 UTC 时间戳——那会让测试只在某个时区下通过。
 */

/** 本地时区下的某一天某一时刻。月份从 1 开始，与人类写法一致。 */
export function ts(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

/** 本地时区某一天的 0 点。 */
export function midnight(year: number, month: number, day: number): number {
  return ts(year, month, day, 0, 0)
}

/** 本地时区下的日期键 `2026-10-05`。 */
export function dayKey(epochMillis: number): string {
  const date = new Date(epochMillis)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
