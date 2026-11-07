import { isWithinRange } from './money'
import { DEFAULT_TITLE, MAX_NOTE_LENGTH, MAX_NICKNAME_LENGTH, MAX_TITLE_LENGTH, MIN_NICKNAME_LENGTH, SEAT_COUNT, SEAT_SELF, textLength } from './sessionRules'
import { isValidDuration } from './sessionDuration'

/**
 * 业务错误码。全部为「可预期」的失败，调用方按码给出提示，
 * 不使用异常控制流程，也不静默吞掉失败。
 */
export type ManoteError =
  | 'INVALID_NICKNAME'
  | 'INVALID_NOTE'
  | 'INVALID_TITLE'
  | 'PLAYED_AT_IN_FUTURE'
  | 'INVALID_DURATION'
  | 'INVALID_SEAT_SET'
  | 'DUPLICATE_PLAYER'
  | 'SEAT_ZERO_NOT_SELF'
  | 'NON_SELF_SEAT_NOT_FRIEND'
  | 'FRIEND_ARCHIVED'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'SESSION_LIMIT_REACHED'
  | 'FRIEND_LIMIT_REACHED'
  | 'SESSION_ID_ALREADY_EXISTS'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_REVISION_CONFLICT'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_IS_SELF'
  | 'PLAYER_KIND_MISMATCH'
  | 'INTERNAL_STATE_CORRUPTED'

/** 写操作的统一返回类型。 */
export type ManoteResult<T> = { ok: true; value: T } | { ok: false; error: ManoteError }

export function success<T>(value: T): ManoteResult<T> {
  return { ok: true, value }
}

export function failure<T = never>(error: ManoteError): ManoteResult<T> {
  return { ok: false, error }
}

/** 成功时取值，失败时返回 null。 */
export function valueOrNull<T>(result: ManoteResult<T>): T | null {
  return result.ok ? result.value : null
}

/** 失败时取错误码，成功时返回 null。 */
export function errorOrNull<T>(result: ManoteResult<T>): ManoteError | null {
  return result.ok ? null : result.error
}

/**
 * 纯输入的格式与取值校验。
 *
 * 这里只做与存储无关的判断，因此同一份规则既能给 UI 做实时提示，
 * 也能在写入事务内重新执行（不用 UI 旧状态代替事务验证）。
 */

/** 标题：去除首尾空白；空白时用默认标题；超过 30 字报错。 */
export function normalizeTitle(raw: string): ManoteResult<string> {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return success(DEFAULT_TITLE)
  if (textLength(trimmed) > MAX_TITLE_LENGTH) return failure('INVALID_TITLE')
  return success(trimmed)
}

/** 备注：去除首尾空白，可为空；超过 100 字报错。 */
export function normalizeNote(raw: string): ManoteResult<string> {
  const trimmed = raw.trim()
  if (textLength(trimmed) > MAX_NOTE_LENGTH) return failure('INVALID_NOTE')
  return success(trimmed)
}

/** 麻友昵称：去除首尾空白，1～12 字。 */
export function normalizeNickname(raw: string): ManoteResult<string> {
  const trimmed = raw.trim()
  const length = textLength(trimmed)
  if (length < MIN_NICKNAME_LENGTH || length > MAX_NICKNAME_LENGTH) return failure('INVALID_NICKNAME')
  return success(trimmed)
}

/** 结束时间不得晚于提交时的设备当前时间，允许补录过去。 */
export function validatePlayedAt(playedAt: number, now: number): ManoteError | null {
  return playedAt > now ? 'PLAYED_AT_IN_FUTURE' : null
}

/** 时长必须在 0.5～24 小时之间（且为 0.1 小时的整数倍）。 */
export function validateDuration(minutes: number): ManoteError | null {
  return isValidDuration(minutes) ? null : 'INVALID_DURATION'
}

/**
 * 校验座位集合：非空、都落在 0～3 之内，且必须包含 seat 0。
 *
 * **不要求四个位置齐全**：一场可以只记录 1～4 个位置。
 */
export function validateSeatSet(seats: Iterable<number>): ManoteError | null {
  const list = [...seats]
  if (list.length === 0) return 'INVALID_SEAT_SET'
  let hasSelf = false
  for (const seat of list) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) return 'INVALID_SEAT_SET'
    if (seat === SEAT_SELF) hasSelf = true
  }
  return hasSelf ? null : 'INVALID_SEAT_SET'
}

/**
 * 校验各已记录座位的净金额：座位集合合法，且每个金额都在允许范围内。
 * **合计不要求为 0**：可以只记一部分人的输赢。
 */
export function validateSeatNets(netsBySeat: Map<number, number>): ManoteError | null {
  const seatError = validateSeatSet(netsBySeat.keys())
  if (seatError) return seatError
  for (const net of netsBySeat.values()) {
    if (!isWithinRange(net)) return 'AMOUNT_OUT_OF_RANGE'
  }
  return null
}

/** 已记录座位的合计（分），用于底部实时提示。 */
export function totalMinor(netsBySeat: Map<number, number>): number {
  let sum = 0
  for (const net of netsBySeat.values()) sum += net
  return sum
}

/** 单个座位的输入 → 带符号净额。零不受赢/输切换影响。 */
export function signedMinor(absoluteMinor: number, isWin: boolean): number {
  if (absoluteMinor === 0) return 0
  return isWin ? absoluteMinor : -absoluteMinor
}
