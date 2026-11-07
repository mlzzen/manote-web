import type { ManoteError } from '@/domain/sessionValidator'
import type { MessageKey } from './messages'

/** 业务错误码 → 文案键。集中在这里，避免每个页面各写一份映射。 */
const ERROR_KEYS: Record<ManoteError, MessageKey> = {
  INVALID_NICKNAME: 'error_invalid_nickname',
  INVALID_NOTE: 'error_invalid_note',
  INVALID_TITLE: 'error_invalid_title',
  PLAYED_AT_IN_FUTURE: 'error_played_at_in_future',
  INVALID_DURATION: 'error_invalid_duration',
  INVALID_SEAT_SET: 'error_invalid_seat_set',
  DUPLICATE_PLAYER: 'error_duplicate_player',
  SEAT_ZERO_NOT_SELF: 'error_seat_zero_not_self',
  NON_SELF_SEAT_NOT_FRIEND: 'error_non_self_seat_not_friend',
  FRIEND_ARCHIVED: 'error_friend_archived',
  AMOUNT_OUT_OF_RANGE: 'error_amount_out_of_range',
  SESSION_LIMIT_REACHED: 'error_session_limit_reached',
  FRIEND_LIMIT_REACHED: 'error_friend_limit_reached',
  SESSION_ID_ALREADY_EXISTS: 'error_session_id_already_exists',
  SESSION_NOT_FOUND: 'error_session_not_found',
  SESSION_REVISION_CONFLICT: 'error_session_revision_conflict',
  PLAYER_NOT_FOUND: 'error_player_not_found',
  PLAYER_IS_SELF: 'error_player_is_self',
  PLAYER_KIND_MISMATCH: 'error_player_kind_mismatch',
  INTERNAL_STATE_CORRUPTED: 'error_internal_state_corrupted',
}

export function errorKey(code: ManoteError): MessageKey {
  return ERROR_KEYS[code] ?? 'error_internal_state_corrupted'
}
