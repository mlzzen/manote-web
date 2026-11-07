/**
 * 领域模型。
 *
 * 金额一律是整数「分」（number，安全整数范围内远够用），全程不经过浮点数；
 * 时间一律是 UTC epoch 毫秒。两者与 Android 版保持一致。
 */

/** 档案类型：本人 / 麻友。 */
export type PlayerKind = 'SELF' | 'FRIEND'

/** 本人与麻友共用的档案。 */
export interface Player {
  id: string
  kind: PlayerKind
  nickname: string
  note: string
  /** 归档时间；未归档为 null。SELF 永远为 null。 */
  archivedAt: number | null
  createdAt: number
  updatedAt: number
}

/** 一整场对局的最终结果。playedAt 是结束时间。 */
export interface Session {
  id: string
  title: string
  /** 结束时间（UTC epoch ms）。 */
  playedAt: number
  /** 本场时长（分钟），用来倒推中点判定早场 / 下午场 / 晚场。 */
  durationMinutes: number
  note: string
  createdAt: number
  updatedAt: number
  /** 乐观并发控制：创建为 1，每次成功编辑 +1。 */
  revision: number
  /** 移入回收站的时间；null 表示正常存在于场次列表里。 */
  deletedAt: number | null
}

/** 一场中某个座位的最终净金额。 */
export interface SessionResult {
  sessionId: string
  /** 0=自己、1=上家、2=对家、3=下家。 */
  seat: number
  playerId: string
  /** 保存时的昵称快照；麻友改名后旧场不变。 */
  nameSnapshot: string
  /** 净金额，分；正数赢、负数输。 */
  netMinor: number
}

/** 一场连同它的座位结果。 */
export interface SessionWithResults {
  session: Session
  results: SessionResult[]
}

/** 单个座位在一场中的净结果，是排名与结清计算的唯一输入。 */
export interface SeatNet {
  seat: number
  netMinor: number
}

/** 走势图与连输/连赢记录的最小输入：一场的（结束时间，某人的净额）。 */
export interface DatedNet {
  playedAt: number
  netMinor: number
}

/** 走势上的一个点：累计到这一场为止的净额。 */
export interface TrendPoint {
  playedAt: number
  netMinor: number
  cumulativeMinor: number
}

/** 全部本地数据的形状（对应 Room 的三张表）。 */
export interface ManoteData {
  players: Player[]
  sessions: Session[]
  sessionResults: SessionResult[]
}
