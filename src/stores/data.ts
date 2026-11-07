import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  DatedNet,
  ManoteData,
  Player,
  Session,
  SessionResult,
  SessionWithResults,
} from '@/domain/types'
import { newId } from '@/domain/id'
import { loadData, saveData, clearStoredData } from '@/storage/persistence'
import {
  failure,
  normalizeNickname,
  normalizeNote,
  normalizeTitle,
  success,
  validateDuration,
  validatePlayedAt,
  validateSeatNets,
  validateSeatSet,
  type ManoteResult,
} from '@/domain/sessionValidator'
import { MAX_FRIENDS, MAX_SESSIONS, SEAT_SELF } from '@/domain/sessionRules'
import { DEFAULT_MINUTES } from '@/domain/sessionDuration'
import { statisticsOf, type PlayerStatistics } from '@/domain/statistics'
import { friendBadgesOf, opponentMatchesOf, type FriendBadge } from '@/domain/friendBadges'
import { toRowUi, type SessionRowUi } from '@/domain/sessionView'
import { rivalryOf, type OpponentMatch, type RivalryRecord } from '@/domain/rivalry'

/** 新建场次时对某个座位的输入。 */
export interface SeatResultInput {
  seat: number
  playerId: string
  netMinor: number
}

/** 新建一整场的草稿。id 由调用方生成，同次提交重试复用，避免连点重复记场。 */
export interface SessionDraft {
  id: string
  playedAt: number
  title: string
  note: string
  seats: SeatResultInput[]
  durationMinutes?: number
}

/** 修改一整场：只允许改标题、结束时间、时长、备注与各已记录座位的金额。 */
export interface SessionEdit {
  id: string
  expectedRevision: number
  playedAt: number
  title: string
  note: string
  netMinorBySeat: Map<number, number>
  durationMinutes: number
}

/** 回收站保留时长：30 天。 */
export const TRASH_RETENTION_MILLIS = 30 * 24 * 60 * 60 * 1000

function sortSessions(a: Session, b: Session): number {
  if (b.playedAt !== a.playedAt) return b.playedAt - a.playedAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const useDataStore = defineStore('manote', () => {
  const data = ref<ManoteData>(loadData())
  /** 最近一次落盘失败的原因；界面据此提示「数据没有改动」。 */
  const storageError = ref<string | null>(null)

  // ————————————————————— 写入 —————————————————————

  /** 先算好新状态、再整体落盘；落盘失败时保留内存中的旧状态。 */
  function commit(next: ManoteData): boolean {
    try {
      saveData(next)
      data.value = next
      storageError.value = null
      return true
    } catch (error) {
      storageError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  const STORAGE_FAILED = 'INTERNAL_STATE_CORRUPTED' as const

  // ————————————————————— 派生：档案 —————————————————————

  const allPlayers = computed<Player[]>(() => data.value.players)

  const self = computed<Player | null>(() => data.value.players.find((it) => it.kind === 'SELF') ?? null)

  const friends = computed<Player[]>(() =>
    data.value.players
      .filter((it) => it.kind === 'FRIEND')
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : 1)),
  )

  const activeFriends = computed<Player[]>(() => friends.value.filter((it) => it.archivedAt === null))

  const archivedFriendCount = computed<number>(() => friends.value.filter((it) => it.archivedAt !== null).length)

  function playerById(id: string): Player | null {
    return data.value.players.find((it) => it.id === id) ?? null
  }

  // ————————————————————— 派生：场次 —————————————————————

  const activeSessions = computed<Session[]>(() =>
    data.value.sessions.filter((it) => it.deletedAt === null).sort(sortSessions),
  )

  const trashedSessions = computed<Session[]>(() =>
    data.value.sessions
      .filter((it) => it.deletedAt !== null)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
  )

  const resultsBySessionId = computed<Map<string, SessionResult[]>>(() => {
    const map = new Map<string, SessionResult[]>()
    for (const result of data.value.sessionResults) {
      const list = map.get(result.sessionId)
      if (list) list.push(result)
      else map.set(result.sessionId, [result])
    }
    for (const list of map.values()) list.sort((a, b) => a.seat - b.seat)
    return map
  })

  /** 全部在场场次及其结果，按 playedAt 倒序、同时间按 ID 升序。 */
  const sessionsWithResults = computed<SessionWithResults[]>(() =>
    activeSessions.value.map((session) => ({
      session,
      results: resultsBySessionId.value.get(session.id) ?? [],
    })),
  )

  const trashWithResults = computed<SessionWithResults[]>(() =>
    trashedSessions.value.map((session) => ({
      session,
      results: resultsBySessionId.value.get(session.id) ?? [],
    })),
  )

  /** 全部在场场次的列表行（含时段判定），场次列表、首页与月历共用。 */
  const sessionRows = computed<SessionRowUi[]>(() => sessionsWithResults.value.map(toRowUi))

  function sessionWithResults(id: string): SessionWithResults | null {
    const session = data.value.sessions.find((it) => it.id === id)
    if (!session) return null
    return { session, results: resultsBySessionId.value.get(id) ?? [] }
  }

  /** 某位玩家参与过的全部在场场次（按 playedAt 倒序）。 */
  function sessionsOfPlayer(playerId: string): SessionWithResults[] {
    return sessionsWithResults.value.filter((item) => item.results.some((it) => it.playerId === playerId))
  }

  /** 每位玩家在 session_result 上的聚合（场数、净输赢），只算在场场次。 */
  const aggregates = computed<Map<string, { sessionCount: number; netMinor: number }>>(() => {
    const map = new Map<string, { sessionCount: number; netMinor: number }>()
    for (const item of sessionsWithResults.value) {
      for (const result of item.results) {
        const existing = map.get(result.playerId)
        if (existing) {
          existing.sessionCount++
          existing.netMinor += result.netMinor
        } else {
          map.set(result.playerId, { sessionCount: 1, netMinor: result.netMinor })
        }
      }
    }
    return map
  })

  /** 本人逐场的（结束时间，净额），按时间升序——统计、走势、连赢连输共用这一份。 */
  const selfDatedNets = computed<DatedNet[]>(() => {
    const list: DatedNet[] = []
    for (const item of sessionsWithResults.value) {
      const mine = item.results.find((it) => it.seat === SEAT_SELF)
      if (mine) list.push({ playedAt: item.session.playedAt, netMinor: mine.netMinor })
    }
    return list.sort((a, b) => a.playedAt - b.playedAt)
  })

  const selfStatistics = computed<PlayerStatistics>(() =>
    statisticsOf(selfDatedNets.value.map((it) => it.netMinor)),
  )

  /** 全场同场账：每一场里「我」与每位在座牌友的对照。 */
  const opponentMatches = computed<OpponentMatch[]>(() =>
    sessionsWithResults.value.flatMap((item) => opponentMatchesOf(item)),
  )

  const rivalryRecords = computed<RivalryRecord[]>(() => rivalryOf(opponentMatches.value))

  const friendBadges = computed<Map<string, Set<FriendBadge>>>(() => friendBadgesOf(opponentMatches.value))

  function statisticsOfPlayer(playerId: string): PlayerStatistics {
    const nets: number[] = []
    for (const item of sessionsWithResults.value) {
      const mine = item.results.find((it) => it.playerId === playerId)
      if (mine) nets.push(mine.netMinor)
    }
    return statisticsOf(nets)
  }

  function datedNetsOfPlayer(playerId: string): DatedNet[] {
    const list: DatedNet[] = []
    for (const item of sessionsWithResults.value) {
      const mine = item.results.find((it) => it.playerId === playerId)
      if (mine) list.push({ playedAt: item.session.playedAt, netMinor: mine.netMinor })
    }
    return list
  }

  // ————————————————————— 写入：档案 —————————————————————

  function persist(next: ManoteData): ManoteResult<true> {
    return commit(next) ? success(true) : failure(STORAGE_FAILED)
  }

  /** 幂等创建唯一的 SELF；已有则原样返回。 */
  function ensureSelf(nickname: string): ManoteResult<Player> {
    const count = data.value.players.filter((it) => it.kind === 'SELF').length
    if (count > 1) return failure('INTERNAL_STATE_CORRUPTED')
    if (count === 1) return success(self.value!)

    const now = Date.now()
    const player: Player = {
      id: newId(),
      kind: 'SELF',
      nickname,
      note: '',
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    const result = persist({ ...data.value, players: [...data.value.players, player] })
    return result.ok ? success(player) : failure(result.error)
  }

  function createFriend(rawNickname: string, rawNote: string): ManoteResult<string> {
    const nickname = normalizeNickname(rawNickname)
    if (!nickname.ok) return failure(nickname.error)
    const note = normalizeNote(rawNote)
    if (!note.ok) return failure(note.error)
    const friendCount = data.value.players.filter((it) => it.kind === 'FRIEND').length
    if (friendCount >= MAX_FRIENDS) return failure('FRIEND_LIMIT_REACHED')

    const now = Date.now()
    const friend: Player = {
      id: newId(),
      kind: 'FRIEND',
      nickname: nickname.value,
      note: note.value,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    const result = persist({ ...data.value, players: [...data.value.players, friend] })
    return result.ok ? success(friend.id) : failure(result.error)
  }

  function updateFriend(id: string, rawNickname: string, rawNote: string): ManoteResult<true> {
    const existing = playerById(id)
    if (!existing) return failure('PLAYER_NOT_FOUND')
    if (existing.kind === 'SELF') return failure('PLAYER_IS_SELF')
    const nickname = normalizeNickname(rawNickname)
    if (!nickname.ok) return failure(nickname.error)
    const note = normalizeNote(rawNote)
    if (!note.ok) return failure(note.error)

    const updated: Player = {
      ...existing,
      nickname: nickname.value,
      note: note.value,
      updatedAt: Date.now(),
    }
    return persist({
      ...data.value,
      players: data.value.players.map((it) => (it.id === id ? updated : it)),
    })
  }

  /** 本人只能改昵称，不能归档或删除。 */
  function renameSelf(rawNickname: string): ManoteResult<true> {
    const me = self.value
    if (!me) return failure('PLAYER_NOT_FOUND')
    const nickname = normalizeNickname(rawNickname)
    if (!nickname.ok) return failure(nickname.error)
    return persist({
      ...data.value,
      players: data.value.players.map((it) =>
        it.id === me.id ? { ...it, nickname: nickname.value, updatedAt: Date.now() } : it,
      ),
    })
  }

  function setFriendArchived(id: string, archived: boolean): ManoteResult<true> {
    const existing = playerById(id)
    if (!existing) return failure('PLAYER_NOT_FOUND')
    if (existing.kind === 'SELF') return failure('PLAYER_IS_SELF')
    if ((existing.archivedAt !== null) === archived) return success(true)
    const now = Date.now()
    return persist({
      ...data.value,
      players: data.value.players.map((it) =>
        it.id === id ? { ...it, archivedAt: archived ? now : null, updatedAt: now } : it,
      ),
    })
  }

  /** 同名麻友查询：仅用于新建时提示，是否继续由用户决定。 */
  function friendsByNickname(nickname: string): Player[] {
    const trimmed = nickname.trim()
    if (!trimmed) return []
    return friends.value.filter((it) => it.nickname === trimmed)
  }

  // ————————————————————— 写入：场次 —————————————————————

  function validateSeatInputs(seats: SeatResultInput[]): ReturnType<typeof validateSeatSet> {
    const numbers = seats.map((it) => it.seat)
    if (new Set(numbers).size !== numbers.length) return 'INVALID_SEAT_SET'
    const seatError = validateSeatSet(numbers)
    if (seatError) return seatError
    if (new Set(seats.map((it) => it.playerId)).size !== seats.length) return 'DUPLICATE_PLAYER'
    return null
  }

  /** 新建一整场：一次写入 Session 与每个已记录座位的 SessionResult。 */
  function createSession(draft: SessionDraft): ManoteResult<string> {
    const now = Date.now()
    const playedAtError = validatePlayedAt(draft.playedAt, now)
    if (playedAtError) return failure(playedAtError)

    const durationMinutes = draft.durationMinutes ?? DEFAULT_MINUTES
    const durationError = validateDuration(durationMinutes)
    if (durationError) return failure(durationError)

    const title = normalizeTitle(draft.title)
    if (!title.ok) return failure(title.error)
    const note = normalizeNote(draft.note)
    if (!note.ok) return failure(note.error)

    const seatError = validateSeatInputs(draft.seats)
    if (seatError) return failure(seatError)

    const netsBySeat = new Map(draft.seats.map((it) => [it.seat, it.netMinor]))
    const netsError = validateSeatNets(netsBySeat)
    if (netsError) return failure(netsError)

    if (data.value.sessions.some((it) => it.id === draft.id)) return failure('SESSION_ID_ALREADY_EXISTS')
    if (activeSessions.value.length >= MAX_SESSIONS) return failure('SESSION_LIMIT_REACHED')

    for (const input of draft.seats) {
      const player = playerById(input.playerId)
      if (!player) return failure('PLAYER_NOT_FOUND')
      if (input.seat === SEAT_SELF) {
        if (player.kind !== 'SELF') return failure('SEAT_ZERO_NOT_SELF')
      } else {
        if (player.kind !== 'FRIEND') return failure('NON_SELF_SEAT_NOT_FRIEND')
        if (player.archivedAt !== null) return failure('FRIEND_ARCHIVED')
      }
    }

    const session: Session = {
      id: draft.id,
      title: title.value,
      playedAt: draft.playedAt,
      durationMinutes,
      note: note.value,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deletedAt: null,
    }
    const results: SessionResult[] = draft.seats.map((input) => ({
      sessionId: draft.id,
      seat: input.seat,
      playerId: input.playerId,
      nameSnapshot: playerById(input.playerId)!.nickname,
      netMinor: input.netMinor,
    }))

    const result = persist({
      ...data.value,
      sessions: [...data.value.sessions, session],
      sessionResults: [...data.value.sessionResults, ...results],
    })
    return result.ok ? success(draft.id) : failure(result.error)
  }

  /** 修改整场：使用原 ID 原子替换结果，不新增场次、不叠加金额。 */
  function updateSession(edit: SessionEdit): ManoteResult<number> {
    const now = Date.now()
    const session = data.value.sessions.find((it) => it.id === edit.id)
    if (!session) return failure('SESSION_NOT_FOUND')
    // 已在回收站里的场次视同已删除，明确报「不存在」而不是「版本冲突」。
    if (session.deletedAt !== null) return failure('SESSION_NOT_FOUND')

    const playedAtError = validatePlayedAt(edit.playedAt, now)
    if (playedAtError) return failure(playedAtError)
    const durationError = validateDuration(edit.durationMinutes)
    if (durationError) return failure(durationError)
    const title = normalizeTitle(edit.title)
    if (!title.ok) return failure(title.error)
    const note = normalizeNote(edit.note)
    if (!note.ok) return failure(note.error)

    const existingResults = data.value.sessionResults.filter((it) => it.sessionId === edit.id)
    const existingSeats = new Set(existingResults.map((it) => it.seat))
    if (existingResults.length === 0 || existingSeats.size !== existingResults.length || validateSeatSet(existingSeats)) {
      return failure('INTERNAL_STATE_CORRUPTED')
    }
    // 人员与位置只读：提交的座位集合必须与保存时逐一对应。
    if (edit.netMinorBySeat.size !== existingSeats.size) return failure('INVALID_SEAT_SET')
    for (const seat of edit.netMinorBySeat.keys()) {
      if (!existingSeats.has(seat)) return failure('INVALID_SEAT_SET')
    }
    const netsError = validateSeatNets(edit.netMinorBySeat)
    if (netsError) return failure(netsError)

    if (session.revision !== edit.expectedRevision) return failure('SESSION_REVISION_CONFLICT')

    const updatedSession: Session = {
      ...session,
      title: title.value,
      playedAt: edit.playedAt,
      durationMinutes: edit.durationMinutes,
      note: note.value,
      updatedAt: now,
      revision: edit.expectedRevision + 1,
    }
    const updatedResults = existingResults.map((it) => ({
      ...it,
      netMinor: edit.netMinorBySeat.get(it.seat)!,
    }))

    const result = persist({
      ...data.value,
      sessions: data.value.sessions.map((it) => (it.id === edit.id ? updatedSession : it)),
      sessionResults: [
        ...data.value.sessionResults.filter((it) => it.sessionId !== edit.id),
        ...updatedResults,
      ],
    })
    return result.ok ? success(updatedSession.revision) : failure(result.error)
  }

  /** 删除整场 → 移入回收站（软删除）。 */
  function moveSessionsToTrash(sessionIds: string[]): ManoteResult<number> {
    const now = Date.now()
    const ids = new Set(sessionIds)
    let moved = 0
    const sessions = data.value.sessions.map((session) => {
      if (!ids.has(session.id) || session.deletedAt !== null) return session
      moved++
      return { ...session, deletedAt: now, updatedAt: now }
    })
    if (moved === 0) return failure('SESSION_NOT_FOUND')
    const result = persist({ ...data.value, sessions })
    return result.ok ? success(moved) : failure(result.error)
  }

  /** 从回收站还原：会重新占用一个在场名额。 */
  function restoreSession(sessionId: string): ManoteResult<true> {
    if (activeSessions.value.length >= MAX_SESSIONS) return failure('SESSION_LIMIT_REACHED')
    const session = data.value.sessions.find((it) => it.id === sessionId)
    if (!session || session.deletedAt === null) return failure('SESSION_NOT_FOUND')
    return persist({
      ...data.value,
      sessions: data.value.sessions.map((it) =>
        it.id === sessionId ? { ...it, deletedAt: null, updatedAt: Date.now() } : it,
      ),
    })
  }

  /** 从回收站彻底删除一场：清掉结果行再删场次。 */
  function purgeSessions(sessionIds: string[]): ManoteResult<number> {
    const ids = new Set(sessionIds)
    const removable = data.value.sessions.filter((it) => ids.has(it.id) && it.deletedAt !== null)
    if (removable.length === 0) return failure('SESSION_NOT_FOUND')
    const removableIds = new Set(removable.map((it) => it.id))
    const result = persist({
      players: data.value.players,
      sessions: data.value.sessions.filter((it) => !removableIds.has(it.id)),
      sessionResults: data.value.sessionResults.filter((it) => !removableIds.has(it.sessionId)),
    })
    return result.ok ? success(removable.length) : failure(result.error)
  }

  function emptyTrash(): ManoteResult<number> {
    const ids = trashedSessions.value.map((it) => it.id)
    if (ids.length === 0) return success(0)
    return purgeSessions(ids)
  }

  /** 清理移入回收站超过 30 天的场次。启动时调用一次。 */
  function purgeExpiredTrash(now = Date.now()): number {
    const expired = trashedSessions.value
      .filter((it) => it.deletedAt !== null && it.deletedAt < now - TRASH_RETENTION_MILLIS)
      .map((it) => it.id)
    if (expired.length === 0) return 0
    const result = purgeSessions(expired)
    return result.ok ? result.value : 0
  }

  /** 整体替换本机数据（导入备份时使用）。调用方已校验过内容。 */
  function replaceAll(next: ManoteData): ManoteResult<true> {
    return persist({
      players: [...next.players],
      sessions: [...next.sessions],
      sessionResults: [...next.sessionResults],
    })
  }

  /** 清空全部本机数据（回到「刚安装」的状态，随后会重新创建本人档案）。 */
  function eraseAll(): void {
    clearStoredData()
    data.value = { players: [], sessions: [], sessionResults: [] }
    storageError.value = null
  }

  return {
    // state
    data,
    storageError,
    // derived
    allPlayers,
    self,
    friends,
    activeFriends,
    archivedFriendCount,
    activeSessions,
    trashedSessions,
    sessionsWithResults,
    trashWithResults,
    sessionRows,
    aggregates,
    selfDatedNets,
    selfStatistics,
    opponentMatches,
    rivalryRecords,
    friendBadges,
    // lookups
    playerById,
    sessionWithResults,
    sessionsOfPlayer,
    statisticsOfPlayer,
    datedNetsOfPlayer,
    friendsByNickname,
    // writes
    ensureSelf,
    createFriend,
    updateFriend,
    renameSelf,
    setFriendArchived,
    createSession,
    updateSession,
    moveSessionsToTrash,
    restoreSession,
    purgeSessions,
    emptyTrash,
    purgeExpiredTrash,
    replaceAll,
    eraseAll,
  }
})
