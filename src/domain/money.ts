/**
 * 金额换算与显示。
 *
 * 金额一律以整数「分」保存和计算，禁止浮点中转。
 */

/** 1 元 = 100 分。 */
export const MINOR_PER_YUAN = 100

/** 单人单场净金额范围：±1,000,000 分，即 ±10,000.00 元，含端点。 */
export const MAX_NET_MINOR = 1_000_000
export const MIN_NET_MINOR = -MAX_NET_MINOR

/**
 * 转成两位小数的元，例如 1230 -> "12.30"、-500 -> "-5.00"、0 -> "0.00"。
 * 用于表格与详情，不带正号。
 */
export function formatMinor(minor: number): string {
  const negative = minor < 0
  const absolute = negative ? -minor : minor
  const yuan = Math.trunc(absolute / MINOR_PER_YUAN)
  const cents = absolute % MINOR_PER_YUAN
  return `${negative ? '-' : ''}${yuan}.${String(cents).padStart(2, '0')}`
}

/**
 * 带符号的元，例如 1230 -> "+12.30"、-500 -> "-5.00"、0 -> "0.00"。
 * 用于四人合计提示。
 */
export function formatSigned(minor: number): string {
  return minor > 0 ? `+${formatMinor(minor)}` : formatMinor(minor)
}

/**
 * 文字化输赢：正数「赢 12.30 元」、负数「输 5.00 元」、零「持平 0.00 元」。
 * 输赢同时用文字表达，不能只依赖颜色。
 */
export function describe(minor: number): string {
  if (minor > 0) return `赢 ${formatMinor(minor)} 元`
  if (minor < 0) return `输 ${formatMinor(-minor)} 元`
  return '持平 0.00 元'
}

/** 该净金额是否落在允许范围内（含端点）。 */
export function isWithinRange(minor: number): boolean {
  return minor >= MIN_NET_MINOR && minor <= MAX_NET_MINOR
}

/** 赢、输、持平的中性表述。 */
export function outcomeLabel(minor: number): string {
  if (minor > 0) return '赢'
  if (minor < 0) return '输'
  return '持平'
}
