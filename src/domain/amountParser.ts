import { MIN_NET_MINOR, MAX_NET_MINOR } from './money'

/** 金额文本解析失败的原因，供 UI 给出针对性提示。 */
export type AmountParseFailure =
  /** 空串或只有空白。 */
  | 'EMPTY'
  /** 格式非法：单独符号、单独小数点、`1.`、指数记法、千位分隔符、内部空白等。 */
  | 'INVALID_FORMAT'
  /** 小数点后超过两位。 */
  | 'TOO_MANY_DECIMALS'
  /** 超出 ±1,000,000 分（即 ±10,000.00 元）。 */
  | 'OUT_OF_RANGE'

export type AmountParseResult =
  | { ok: true; minor: number }
  | { ok: false; reason: AmountParseFailure }

/**
 * 人民币元文本 → 整数分。
 *
 * 接受：`1`、`1.2`、`1.20`、`-5`、`-5.5`；两端空白会被去除。
 * 拒绝：空值、单独符号、单独小数点、`1.`、`1.001`、指数记法、千位分隔符、超界值。
 *
 * 全程手工解析为整数，不经过浮点数。
 */
export function parseAmount(text: string): AmountParseResult {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'EMPTY' }

  let index = 0
  const negative = trimmed[0] === '-'
  if (negative) {
    index = 1
    // 单独负号
    if (index === trimmed.length) return { ok: false, reason: 'INVALID_FORMAT' }
  }

  // 整数部分至少一位数字
  const integerStart = index
  while (index < trimmed.length && trimmed[index] >= '0' && trimmed[index] <= '9') index++
  const integerDigits = index - integerStart
  if (integerDigits === 0) return { ok: false, reason: 'INVALID_FORMAT' }

  // 可选的小数部分：`.` 后必须有 1～2 位数字
  let fractionDigits = 0
  if (index < trimmed.length && trimmed[index] === '.') {
    index++
    const fractionStart = index
    while (index < trimmed.length && trimmed[index] >= '0' && trimmed[index] <= '9') index++
    fractionDigits = index - fractionStart
    if (fractionDigits === 0) return { ok: false, reason: 'INVALID_FORMAT' }
    if (fractionDigits > 2) return { ok: false, reason: 'TOO_MANY_DECIMALS' }
  }

  // 仍有剩余字符 → 千位分隔符、指数记法、内部空白、第二个小数点等
  if (index !== trimmed.length) return { ok: false, reason: 'INVALID_FORMAT' }

  // 先用位数兜住溢出，再逐位累加
  if (integerDigits > 9) return { ok: false, reason: 'OUT_OF_RANGE' }

  let minor = 0
  for (let position = integerStart; position < integerStart + integerDigits; position++) {
    minor = minor * 10 + (trimmed.charCodeAt(position) - 48)
  }
  minor *= 100
  if (fractionDigits === 1) {
    minor += (trimmed.charCodeAt(index - 1) - 48) * 10
  } else if (fractionDigits === 2) {
    minor += (trimmed.charCodeAt(index - 2) - 48) * 10 + (trimmed.charCodeAt(index - 1) - 48)
  }
  if (negative) minor = -minor

  if (minor < MIN_NET_MINOR || minor > MAX_NET_MINOR) return { ok: false, reason: 'OUT_OF_RANGE' }
  return { ok: true, minor }
}
