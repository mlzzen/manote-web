import type { SessionWithResults } from './types'
import type { SeatNet } from './types'
import { SEAT_SELF, isPlaceholderTitle } from './sessionRules'
import { formatHours, midpointAt, startAt } from './sessionDuration'
import { timeSlotOf, type TimeSlot } from './timeSlot'
import { rankSeats } from './ranking'
import { suggestSettlement } from './settlement'

/** 某个座位在界面上的展示数据。 */
export interface SeatUi {
  /** 0=自己、1=上家、2=对家、3=下家。 */
  seat: number
  /** 保存时的昵称快照。 */
  nickname: string
  /** 本场净额，分。 */
  netMinor: number
  /** 本场名次（竞赛排名）。 */
  rank: number
}

/** 场次列表与首页「最近场次」共用的一行数据。 */
export interface SessionRowUi {
  id: string
  title: string
  note: string
  playedAt: number
  /** 本场时段（早场 / 下午场 / 晚场），按中点判定。 */
  timeSlot: TimeSlot
  /** 本人（seat 0）本场净额。 */
  selfNetMinor: number
  /** 其余各位的昵称快照，按 seat 升序；只记录了部分位置时会少于三个。 */
  opponentNames: string[]
  /** 其余各位的档案 ID，与 opponentNames 严格一一对应。 */
  opponentPlayerIds: string[]
  /** 本场时长（分钟）。 */
  durationMinutes: number
}

/** 用户是否真的起过标题；否则列表不显示标题行。 */
export function hasCustomTitle(row: { title: string }): boolean {
  return !isPlaceholderTitle(row.title)
}

/**
 * 时段判定的唯一入口：先由结束时间与时长算出这一场的中点，再看中点落在哪个时段。
 *
 * 抽成一处是为了让列表、详情、统计三处永远给同一场同一个答案。
 */
export function timeSlotOfSession(playedAt: number, durationMinutes: number): TimeSlot {
  return timeSlotOf(midpointAt(playedAt, durationMinutes))
}

/** 场次 → 列表行。 */
export function toRowUi(session: SessionWithResults): SessionRowUi {
  const ordered = [...session.results].sort((a, b) => a.seat - b.seat)
  const self = ordered.find((it) => it.seat === SEAT_SELF)
  // 昵称与 ID 必须来自同一个列表：筛选按 ID、显示按昵称，两者错位就会张冠李戴
  const opponents = ordered.filter((it) => it.seat !== SEAT_SELF)
  return {
    id: session.session.id,
    title: session.session.title,
    note: session.session.note,
    playedAt: session.session.playedAt,
    timeSlot: timeSlotOfSession(session.session.playedAt, session.session.durationMinutes),
    selfNetMinor: self?.netMinor ?? 0,
    opponentNames: opponents.map((it) => it.nameSnapshot),
    opponentPlayerIds: opponents.map((it) => it.playerId),
    durationMinutes: session.session.durationMinutes,
  }
}

/** 一笔结清建议的展示数据。 */
export interface TransferUi {
  fromSeat: number
  toSeat: number
  amountMinor: number
}

/** 场次详情页的展示数据。 */
export interface SessionDetailUi {
  id: string
  title: string
  note: string
  playedAt: number
  startedAt: number
  durationMinutes: number
  timeSlot: TimeSlot
  /** 已记录的座位，按 seat 升序。可能少于四个。 */
  seats: SeatUi[]
  totalMinor: number
  balanced: boolean
  /** 结清建议，最多三笔；空表示无需结清或本场不平账。 */
  transfers: TransferUi[]
  revision: number
}

/** 场次 → 详情。排名与结清都在这里一次算好，组件只负责渲染。 */
export function toDetailUi(session: SessionWithResults): SessionDetailUi {
  const ordered = [...session.results].sort((a, b) => a.seat - b.seat)
  const nets: SeatNet[] = ordered.map((it) => ({ seat: it.seat, netMinor: it.netMinor }))
  const ranksBySeat = new Map(rankSeats(nets).map((it) => [it.seat, it.rank]))
  const total = nets.reduce((sum, it) => sum + it.netMinor, 0)
  const balanced = total === 0
  return {
    id: session.session.id,
    title: session.session.title,
    note: session.session.note,
    playedAt: session.session.playedAt,
    startedAt: startAt(session.session.playedAt, session.session.durationMinutes),
    durationMinutes: session.session.durationMinutes,
    timeSlot: timeSlotOfSession(session.session.playedAt, session.session.durationMinutes),
    seats: ordered.map((result) => ({
      seat: result.seat,
      nickname: result.nameSnapshot,
      netMinor: result.netMinor,
      rank: ranksBySeat.get(result.seat) ?? 0,
    })),
    totalMinor: total,
    balanced,
    // 不平账时不给建议：撮合到最后一个赢家会剩下算不清的余额，宁可明确说「给不了」。
    transfers: balanced ? suggestSettlement(nets) : [],
    revision: session.session.revision,
  }
}

/** 由结束时间与时长倒推的开始时间文本用值。 */
export function sessionStartAt(session: { playedAt: number; durationMinutes: number }): number {
  return startAt(session.playedAt, session.durationMinutes)
}

/** 时长「小时」文本。 */
export function sessionDurationText(durationMinutes: number): string {
  return formatHours(durationMinutes)
}
