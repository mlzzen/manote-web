import type { ManoteData, Player, PlayerKind, Session, SessionResult } from '@/domain/types'
import { isWithinRange } from '@/domain/money'
import { isCanonicalUuid } from '@/domain/id'
import { MAX_FRIENDS, MAX_SESSIONS, SEAT_COUNT, SEAT_SELF } from '@/domain/sessionRules'
import { normalizeNickname, normalizeNote, normalizeTitle } from '@/domain/sessionValidator'
import { DEFAULT_MINUTES, isValidDuration } from '@/domain/sessionDuration'

/**
 * JSON 全量备份的文件结构。
 *
 * 字段与 Android 版的三张表一一对应，与协议版本 3 保持兼容，
 * 因此 Android 导出的备份可以在 Web 版导入，反之亦然。
 */
export interface BackupFile {
  schemaVersion: number
  appVersion: string
  exportedAt: number
  players: BackupPlayer[]
  sessions: BackupSession[]
  sessionResults: BackupSessionResult[]
}

export interface BackupPlayer {
  id: string
  kind: string
  nickname: string
  note: string
  archivedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface BackupSession {
  id: string
  title: string
  playedAt: number
  durationMinutes: number
  note: string
  createdAt: number
  updatedAt: number
  revision: number
}

export interface BackupSessionResult {
  sessionId: string
  seat: number
  playerId: string
  nameSnapshot: string
  netMinor: number
}

/** 协议版本，与数据库版本相互独立。 */
export const PROTOCOL_VERSION = 3

/** 文件上限 20 MiB。 */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

export function buildBackup(data: ManoteData, appVersion: string, exportedAt = Date.now()): BackupFile {
  return {
    schemaVersion: PROTOCOL_VERSION,
    appVersion,
    exportedAt,
    // 回收站里的场次不写进备份：否则换台设备导入后会凭空多出几场已删掉的记录。
    players: data.players.map(toBackupPlayer),
    sessions: data.sessions.filter((it) => it.deletedAt === null).map(toBackupSession),
    sessionResults: data.sessionResults
      .filter((it) => {
        const session = data.sessions.find((s) => s.id === it.sessionId)
        return session !== undefined && session.deletedAt === null
      })
      .map(toBackupResult),
  }
}

function toBackupPlayer(player: Player): BackupPlayer {
  return {
    id: player.id,
    kind: player.kind,
    nickname: player.nickname,
    note: player.note,
    archivedAt: player.archivedAt,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  }
}

function toBackupSession(session: Session): BackupSession {
  return {
    id: session.id,
    title: session.title,
    playedAt: session.playedAt,
    durationMinutes: session.durationMinutes,
    note: session.note,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    revision: session.revision,
  }
}

function toBackupResult(result: SessionResult): BackupSessionResult {
  return {
    sessionId: result.sessionId,
    seat: result.seat,
    playerId: result.playerId,
    nameSnapshot: result.nameSnapshot,
    netMinor: result.netMinor,
  }
}

export function encodeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

/** 备份文件名用导出时间，不含昵称等用户文本。 */
export function suggestedBackupFileName(exportedAt = Date.now()): string {
  const d = new Date(exportedAt)
  const pad = (v: number) => String(v).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `manote-backup_${stamp}.json`
}

/**
 * 解析失败时返回 null，由调用方按「格式不正确」拒绝。
 *
 * 缺 `durationMinutes` 的场次要按 **4 小时**补齐，而不是判成非法时长：
 * Android 版用 kotlinx.serialization，它默认不输出「等于默认值」的字段
 * （`encodeDefaults = false`），因此时长恰好是默认 4 小时的场次在文件里
 * **整个字段都不存在**——而 4 小时正是绝大多数场次的取值。
 * 协议这边对应的规则本来就是「不填按 4 小时算」，所以补默认值是还原语义，
 * 不是猜测性修补；字段存在但取值非法（例如 250 分钟）仍然照旧拒绝。
 */
export function decodeBackup(text: string): BackupFile | null {
  try {
    // 有的编辑器/工具会写 UTF-8 BOM，JSON.parse 不接受它
    const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
    if (typeof parsed !== 'object' || parsed === null) return null
    const file = parsed as Partial<BackupFile>
    if (!Array.isArray(file.players) || !Array.isArray(file.sessions) || !Array.isArray(file.sessionResults)) {
      return null
    }
    if (typeof file.schemaVersion !== 'number' || typeof file.exportedAt !== 'number') return null
    return {
      schemaVersion: file.schemaVersion,
      appVersion: typeof file.appVersion === 'string' ? file.appVersion : '',
      exportedAt: file.exportedAt,
      players: file.players.map(normalizePlayer),
      sessions: file.sessions.map(normalizeSession),
      sessionResults: file.sessionResults as BackupSessionResult[],
    }
  } catch {
    return null
  }
}

function normalizePlayer(raw: BackupPlayer): BackupPlayer {
  return {
    id: raw.id,
    kind: raw.kind,
    nickname: raw.nickname,
    note: raw.note,
    // 可空字段被省略时按「未归档」读，与 Kotlin 端的 null 默认一致
    archivedAt: typeof raw.archivedAt === 'number' ? raw.archivedAt : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

function normalizeSession(raw: BackupSession): BackupSession {
  return {
    id: raw.id,
    title: raw.title,
    playedAt: raw.playedAt,
    // 见上方注释：缺省即默认 4 小时
    durationMinutes:
      typeof raw.durationMinutes === 'number' ? raw.durationMinutes : DEFAULT_MINUTES,
    note: raw.note,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    revision: raw.revision,
  }
}

/** 备份被拒绝的原因。 */
export type BackupRejectReason =
  | 'UNSUPPORTED_VERSION'
  | 'TOO_LARGE'
  | 'MALFORMED'
  | 'INVALID_SELF'
  | 'INVALID_ID'
  | 'ORPHAN_REFERENCE'
  | 'INCOMPLETE_SEATS'
  | 'KIND_MISMATCH'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'INVALID_TEXT'
  | 'INVALID_TIME'
  | 'INVALID_DURATION'
  | 'INVALID_REVISION'
  | 'LIMIT_EXCEEDED'

/** 导入前展示的信息：将覆盖的场数、牌友数，以及导入后的本人昵称。 */
export interface BackupSummary {
  sessionCount: number
  friendCount: number
  selfNickname: string
}

export type BackupCheck =
  | { ok: true; summary: BackupSummary; data: ManoteData }
  | { ok: false; reason: BackupRejectReason }

function playerKindOf(kind: string): PlayerKind | null {
  if (kind === 'SELF') return 'SELF'
  if (kind === 'FRIEND') return 'FRIEND'
  return null
}

function isNormalizedNickname(raw: unknown): boolean {
  return typeof raw === 'string' && raw === raw.trim() && normalizeNickname(raw).ok
}

function isNormalizedNote(raw: unknown): boolean {
  return typeof raw === 'string' && raw === raw.trim() && normalizeNote(raw).ok
}

function isNormalizedTitle(raw: unknown): boolean {
  return typeof raw === 'string' && raw.trim().length > 0 && raw === raw.trim() && normalizeTitle(raw).ok
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

/**
 * 备份内容的纯校验。
 *
 * 全部在内存里完成，任何一条不通过就整体拒绝，**不做修补、不做部分导入**——
 * 这是「坏备份不改原库」的前提。
 *
 * 校验的是「数据是否自洽」，而不是「是否满足新建时的输入限制」：
 * 只记录部分座位、合计不为 0 的场次都算合法，否则用户自己的备份会被自己的校验挡在门外。
 */
export function validateBackup(file: BackupFile): BackupCheck {
  if (file.schemaVersion !== PROTOCOL_VERSION) return { ok: false, reason: 'UNSUPPORTED_VERSION' }

  // 无法识别的 kind 先拒掉，后面所有按 kind 的判断才不会有空档。
  if (file.players.some((it) => playerKindOf(it.kind) === null)) return { ok: false, reason: 'MALFORMED' }
  const friends = file.players.filter((it) => playerKindOf(it.kind) === 'FRIEND')
  if (file.sessions.length > MAX_SESSIONS || friends.length > MAX_FRIENDS) {
    return { ok: false, reason: 'LIMIT_EXCEEDED' }
  }

  // —— 档案表 ——
  const playerIds = new Set<string>()
  for (const player of file.players) {
    if (!isCanonicalUuid(player.id) || playerIds.has(player.id)) return { ok: false, reason: 'INVALID_ID' }
    playerIds.add(player.id)
  }
  for (const player of file.players) {
    if (!isNormalizedNickname(player.nickname) || !isNormalizedNote(player.note)) {
      return { ok: false, reason: 'INVALID_TEXT' }
    }
    if (!isValidPlayerTimes(player)) return { ok: false, reason: 'INVALID_TIME' }
    // 本人不能归档。
    if (playerKindOf(player.kind) === 'SELF' && player.archivedAt !== null) {
      return { ok: false, reason: 'INVALID_SELF' }
    }
  }
  const selves = file.players.filter((it) => playerKindOf(it.kind) === 'SELF')
  if (selves.length !== 1) return { ok: false, reason: 'INVALID_SELF' }

  // —— 场次表 ——
  const sessionIds = new Set<string>()
  for (const session of file.sessions) {
    if (!isCanonicalUuid(session.id) || sessionIds.has(session.id)) return { ok: false, reason: 'INVALID_ID' }
    sessionIds.add(session.id)
  }
  for (const session of file.sessions) {
    if (!isNormalizedTitle(session.title) || !isNormalizedNote(session.note)) {
      return { ok: false, reason: 'INVALID_TEXT' }
    }
    if (!isNumber(session.revision) || session.revision <= 0) return { ok: false, reason: 'INVALID_REVISION' }
    if (!isNumber(session.durationMinutes) || !isValidDuration(session.durationMinutes)) {
      return { ok: false, reason: 'INVALID_DURATION' }
    }
    if (!isValidSessionTimes(session)) return { ok: false, reason: 'INVALID_TIME' }
  }

  // —— 结果表：外键、座位、文本、金额 ——
  const kindById = new Map(file.players.map((it) => [it.id, playerKindOf(it.kind)]))
  const seatKeys = new Set<string>()
  const playerKeys = new Set<string>()
  const resultsBySession = new Map<string, BackupSessionResult[]>()

  for (const result of file.sessionResults) {
    if (!sessionIds.has(result.sessionId) || !playerIds.has(result.playerId)) {
      return { ok: false, reason: 'ORPHAN_REFERENCE' }
    }
    if (!isNumber(result.seat) || result.seat < 0 || result.seat >= SEAT_COUNT) {
      return { ok: false, reason: 'INCOMPLETE_SEATS' }
    }
    const seatKey = `${result.sessionId}|${result.seat}`
    if (seatKeys.has(seatKey)) return { ok: false, reason: 'INCOMPLETE_SEATS' }
    seatKeys.add(seatKey)
    const playerKey = `${result.sessionId}|${result.playerId}`
    if (playerKeys.has(playerKey)) return { ok: false, reason: 'INCOMPLETE_SEATS' }
    playerKeys.add(playerKey)
    if (!isNormalizedNickname(result.nameSnapshot)) return { ok: false, reason: 'INVALID_TEXT' }
    if (!isNumber(result.netMinor) || !isWithinRange(result.netMinor)) {
      return { ok: false, reason: 'AMOUNT_OUT_OF_RANGE' }
    }
    const list = resultsBySession.get(result.sessionId)
    if (list) list.push(result)
    else resultsBySession.set(result.sessionId, [result])
  }

  // —— 逐场检查：至少一条结果、必含 seat 0、类型匹配 ——
  for (const session of file.sessions) {
    const rows = resultsBySession.get(session.id) ?? []
    if (rows.length === 0 || !rows.some((it) => it.seat === SEAT_SELF)) {
      return { ok: false, reason: 'INCOMPLETE_SEATS' }
    }
    for (const row of rows) {
      const expected: PlayerKind = row.seat === SEAT_SELF ? 'SELF' : 'FRIEND'
      if (kindById.get(row.playerId) !== expected) return { ok: false, reason: 'KIND_MISMATCH' }
    }
  }

  // 到这里内容自洽，组装成内存数据。
  const data: ManoteData = {
    players: file.players.map((it) => ({
      id: it.id,
      kind: playerKindOf(it.kind)!,
      nickname: it.nickname,
      note: it.note,
      archivedAt: it.archivedAt ?? null,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    })),
    sessions: file.sessions.map((it) => ({
      id: it.id,
      title: it.title,
      playedAt: it.playedAt,
      durationMinutes: it.durationMinutes,
      note: it.note,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      revision: it.revision,
      deletedAt: null,
    })),
    sessionResults: file.sessionResults.map((it) => ({
      sessionId: it.sessionId,
      seat: it.seat,
      playerId: it.playerId,
      nameSnapshot: it.nameSnapshot,
      netMinor: it.netMinor,
    })),
  }

  return {
    ok: true,
    summary: {
      sessionCount: file.sessions.length,
      friendCount: friends.length,
      selfNickname: selves[0].nickname,
    },
    data,
  }
}

function isValidPlayerTimes(player: BackupPlayer): boolean {
  if (!isNumber(player.createdAt) || !isNumber(player.updatedAt)) return false
  if (player.createdAt < 0 || player.updatedAt < 0) return false
  if (player.updatedAt < player.createdAt) return false
  const archivedAt = player.archivedAt
  if (archivedAt !== null && archivedAt !== undefined) {
    if (!isNumber(archivedAt) || archivedAt < 0 || archivedAt < player.createdAt) return false
  }
  return true
}

function isValidSessionTimes(session: BackupSession): boolean {
  if (!isNumber(session.createdAt) || !isNumber(session.updatedAt) || !isNumber(session.playedAt)) return false
  if (session.createdAt < 0 || session.updatedAt < 0 || session.playedAt < 0) return false
  if (session.updatedAt < session.createdAt) return false
  // 结束时间不可能晚于这条记录最后一次被修改的时间。
  if (session.playedAt > session.updatedAt) return false
  return true
}
