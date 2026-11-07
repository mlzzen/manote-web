import type { SessionRowUi } from './sessionView'
import type { TimeSlot } from './timeSlot'
import type { Player } from './types'
import { dayKeyOf } from './uiText'

/** 本人这一场的结果分类，供「输赢」筛选使用。 */
export type SessionOutcome = 'WIN' | 'LOSS' | 'DRAW'

export function outcomeOf(netMinor: number): SessionOutcome {
  if (netMinor > 0) return 'WIN'
  if (netMinor < 0) return 'LOSS'
  return 'DRAW'
}

/**
 * 场次列表的筛选条件。
 *
 * **每一组留空即「不限」**，没有「全部」这种特殊态——空集合与 null 就是全部。
 * 组与组之间是「且」，组内多选是「或」。
 */
export interface SessionFilters {
  timeSlots: Set<TimeSlot>
  year: number | null
  month: number | null
  /** 某一天，形如 `2026-10-05`。 */
  date: string | null
  friendIds: Set<string>
  outcomes: Set<SessionOutcome>
}

export function emptyFilters(): SessionFilters {
  return {
    timeSlots: new Set(),
    year: null,
    month: null,
    date: null,
    friendIds: new Set(),
    outcomes: new Set(),
  }
}

/** 生效的组数（不是选项数），供顶栏按钮上的小圆点与「重置」使用。 */
export function activeGroupCount(filters: SessionFilters): number {
  return [
    filters.timeSlots.size > 0,
    filters.year !== null || filters.month !== null || filters.date !== null,
    filters.friendIds.size > 0,
    filters.outcomes.size > 0,
  ].filter(Boolean).length
}

export function isFilterActive(filters: SessionFilters): boolean {
  return activeGroupCount(filters) > 0
}

/**
 * 单行是否命中全部条件。
 *
 * 时间一律按浏览器时区判断，与列表显示同一套时区，
 * 不会出现「列表显示 10 月 5 日、却被 10 月 4 日的筛选漏掉」。
 */
export function matchesFilters(row: SessionRowUi, filters: SessionFilters): boolean {
  if (filters.timeSlots.size > 0 && !filters.timeSlots.has(row.timeSlot)) return false
  if (filters.friendIds.size > 0 && !row.opponentPlayerIds.some((id) => filters.friendIds.has(id))) {
    return false
  }
  if (filters.outcomes.size > 0 && !filters.outcomes.has(outcomeOf(row.selfNetMinor))) return false
  if (filters.year === null && filters.month === null && filters.date === null) return true

  // 只有真的用到年月日时才解析时间：只筛时段或牌友时，这一行可以完全不碰日历
  const day = dayKeyOf(row.playedAt)
  if (filters.year !== null && Number.parseInt(day.slice(0, 4), 10) !== filters.year) return false
  if (filters.month !== null && Number.parseInt(day.slice(5, 7), 10) !== filters.month) return false
  if (filters.date !== null && day !== filters.date) return false
  return true
}

export function applyFilters(rows: SessionRowUi[], filters: SessionFilters): SessionRowUi[] {
  if (!isFilterActive(filters)) return rows
  return rows.filter((row) => matchesFilters(row, filters))
}

/** 关键词搜索：标题、备注、同桌牌友昵称。 */
export function applySearch(rows: SessionRowUi[], query: string): SessionRowUi[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return rows
  return rows.filter((row) => {
    if (row.title.toLowerCase().includes(keyword)) return true
    if (row.note.toLowerCase().includes(keyword)) return true
    return row.opponentNames.some((name) => name.toLowerCase().includes(keyword))
  })
}

/** 年份选项：库里出现过的年份，由近到远。 */
export function yearOptions(rows: SessionRowUi[]): number[] {
  const years = new Set(rows.map((row) => Number.parseInt(dayKeyOf(row.playedAt).slice(0, 4), 10)))
  return [...years].sort((a, b) => b - a)
}

/** 筛选弹层里的一位牌友选项。 */
export interface SessionFriendOption {
  id: string
  nickname: string
  /** 是否需要补一个 ID 短串（昵称允许重名）。 */
  showId: boolean
}

/**
 * 牌友选项：曾经同桌过的牌友，同桌次数多的排在前。
 *
 * 昵称优先取档案里的当前昵称（改名后筛选项跟着改），档案缺失时回落到
 * 最近一场保存的昵称快照。
 */
export function friendOptions(rows: SessionRowUi[], friends: Player[]): SessionFriendOption[] {
  const snapshotById = new Map<string, string>()
  const countById = new Map<string, number>()
  // rows 已按 playedAt 倒序，因此第一次遇到的就是最近一场的昵称
  for (const row of rows) {
    row.opponentPlayerIds.forEach((playerId, index) => {
      if (!snapshotById.has(playerId)) snapshotById.set(playerId, row.opponentNames[index] ?? '')
      countById.set(playerId, (countById.get(playerId) ?? 0) + 1)
    })
  }
  if (snapshotById.size === 0) return []

  const nicknameById = new Map(friends.map((it) => [it.id, it.nickname]))
  const options = [...snapshotById.entries()].map(([id, snapshot]) => ({
    id,
    nickname: nicknameById.get(id)?.trim() || snapshot,
  }))
  const duplicated = new Set(
    [...options.reduce((map, it) => map.set(it.nickname, (map.get(it.nickname) ?? 0) + 1), new Map<string, number>())]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  )
  return options
    .map((it) => ({ ...it, showId: duplicated.has(it.nickname) }))
    .sort((a, b) => (countById.get(b.id) ?? 0) - (countById.get(a.id) ?? 0) || a.nickname.localeCompare(b.nickname))
}
