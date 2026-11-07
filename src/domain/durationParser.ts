import { MINUTES_PER_HOUR, MINUTES_PER_TENTH_HOUR, isValidDuration } from './sessionDuration'

/** 时长文本解析失败的原因，供 UI 给出针对性提示。 */
export type DurationParseFailure =
  | 'EMPTY'
  | 'INVALID_FORMAT'
  | 'TOO_MANY_DECIMALS'
  | 'OUT_OF_RANGE'

export type DurationParseResult =
  | { ok: true; minutes: number }
  | { ok: false; reason: DurationParseFailure }

/**
 * 「小时」文本 → 整数分钟。
 *
 * 接受：`4`、`4.5`、`0.5`；两端空白会被去除。
 * 拒绝：空值、单独小数点、`4.`、`4.55`、负数、指数记法、非数字字符、超出 0.5～24 小时。
 *
 * 0.1 小时恰好是 6 分钟，用浮点会引入 `4.2 × 60 = 251.999…` 这类误差。
 */
export function parseDuration(text: string): DurationParseResult {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'EMPTY' }

  let index = 0
  const integerStart = index
  while (index < trimmed.length && trimmed[index] >= '0' && trimmed[index] <= '9') index++
  const integerDigits = index - integerStart
  // 负号、小数点开头、字母开头都落在这里
  if (integerDigits === 0) return { ok: false, reason: 'INVALID_FORMAT' }

  // 可选的小数部分：`.` 后必须有数字，且最多一位
  let tenths = 0
  if (index < trimmed.length && trimmed[index] === '.') {
    index++
    const fractionStart = index
    while (index < trimmed.length && trimmed[index] >= '0' && trimmed[index] <= '9') index++
    const fractionDigits = index - fractionStart
    if (fractionDigits === 0) return { ok: false, reason: 'INVALID_FORMAT' }
    if (fractionDigits > 1) return { ok: false, reason: 'TOO_MANY_DECIMALS' }
    tenths = trimmed.charCodeAt(fractionStart) - 48
  }

  // 仍有剩余字符 → 内部空白、第二个小数点、单位后缀等
  if (index !== trimmed.length) return { ok: false, reason: 'INVALID_FORMAT' }

  // 先用位数兜住溢出，再逐位累加
  if (integerDigits > 3) return { ok: false, reason: 'OUT_OF_RANGE' }

  let hours = 0
  for (let position = integerStart; position < integerStart + integerDigits; position++) {
    hours = hours * 10 + (trimmed.charCodeAt(position) - 48)
  }
  const minutes = hours * MINUTES_PER_HOUR + tenths * MINUTES_PER_TENTH_HOUR

  if (!isValidDuration(minutes)) return { ok: false, reason: 'OUT_OF_RANGE' }
  return { ok: true, minutes }
}
