import { divideRounded } from './statistics'

/** 一场里「我」与某位同场牌友的对照。 */
export interface OpponentMatch {
  playerId: string
  /** 本场我的净额，分。 */
  myNetMinor: number
  /** 本场这位牌友的净额，分。 */
  theirNetMinor: number
}

/**
 * 某位牌友与「我」同场的账。
 *
 * 两侧的净额都留着：有的标签看「我打成什么样」，有的看「他打成什么样」，
 * 而两者的分母都是同一组同场场次。
 */
export interface RivalryRecord {
  playerId: string
  /** 两人同场的场数，也是下面两个场均的分母。 */
  commonSessionCount: number
  /** 这些同场场次里我的净额合计，分。 */
  myNetMinor: number
  /** 这些同场场次里他的净额合计，分。 */
  theirNetMinor: number
}

/**
 * 同场时我的场均，分（四舍五入到分）。
 *
 * 分母是**同场场数**，不是我的总场数：这个数字回答的是「只要他在桌上，我平均打成什么样」。
 */
export function myAverageMinor(record: RivalryRecord): number {
  return averageOf(record, record.myNetMinor)
}

/** 同场时他的场均，分。分母同为同场场数。 */
export function theirAverageMinor(record: RivalryRecord): number {
  return averageOf(record, record.theirNetMinor)
}

function averageOf(record: RivalryRecord, netMinor: number): number {
  return record.commonSessionCount === 0 ? 0 : divideRounded(netMinor, record.commonSessionCount)
}

/**
 * 入榜门槛：至少同场这么多场才参与评选。
 *
 * 没有门槛的话，偶尔一两次同桌输得多的人就会被标上标签，
 * 那更像抽样噪声而不是稳定的事实。
 */
export const MIN_COMMON_SESSIONS = 3

/**
 * 同场账，以及挂在牌友列表上的三个标签的判定依据。
 *
 * 三者都要求**同场 ≥ 3 场**，且都由已保存场次实时算出：
 * - 最苦主：我在他面前的场均最低；
 * - 福星：我在他面前的场均最高；
 * - 牌王：他自己的场均最高。
 */
export function rivalryOf(matches: OpponentMatch[]): RivalryRecord[] {
  const grouped = new Map<string, OpponentMatch[]>()
  for (const match of matches) {
    const list = grouped.get(match.playerId)
    if (list) list.push(match)
    else grouped.set(match.playerId, [match])
  }
  return [...grouped.entries()]
    .map(([playerId, group]) => ({
      playerId,
      commonSessionCount: group.length,
      myNetMinor: group.reduce((sum, it) => sum + it.myNetMinor, 0),
      theirNetMinor: group.reduce((sum, it) => sum + it.theirNetMinor, 0),
    }))
    .sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0))
}

/** 某位牌友与我的同场账；从没同场过时返回 null。 */
export function rivalryRecordFor(matches: OpponentMatch[], playerId: string): RivalryRecord | null {
  return rivalryOf(matches).find((it) => it.playerId === playerId) ?? null
}

/**
 * 按场均比较 a 与 b；相等时返回 null，交给调用方决定怎么并列。
 *
 * 先交叉相乘再比大小，而不是各自四舍五入成场均再比：场均常常是无限小数，
 * 先取整会把 -33.33 与 -33.4 并列，甚至排出相反的次序。
 */
function compareAverage(
  select: (record: RivalryRecord) => number,
  a: RivalryRecord,
  b: RivalryRecord,
): number | null {
  const left = select(a) * b.commonSessionCount
  const right = select(b) * a.commonSessionCount
  if (left === right) return null
  return left < right ? -1 : 1
}

function byId(a: RivalryRecord, b: RivalryRecord): number {
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0
}

function qualifying(matches: OpponentMatch[]): RivalryRecord[] {
  return rivalryOf(matches).filter((it) => it.commonSessionCount >= MIN_COMMON_SESSIONS)
}

/** 最苦主：我在他面前的场均最低的那位。没有达标的人时返回 null。 */
export function worstRival(matches: OpponentMatch[]): RivalryRecord | null {
  const list = qualifying(matches).sort(
    (a, b) => compareAverage((it) => it.myNetMinor, a, b) ?? byId(a, b),
  )
  return list[0] ?? null
}

/** 福星：我在他面前的场均最高的那位。 */
export function bestRival(matches: OpponentMatch[]): RivalryRecord | null {
  const list = qualifying(matches).sort(
    (a, b) => compareAverage((it) => it.myNetMinor, b, a) ?? byId(a, b),
  )
  return list[0] ?? null
}

/** 牌王：他自己的场均最高的那位。 */
export function strongestOpponent(matches: OpponentMatch[]): RivalryRecord | null {
  const list = qualifying(matches).sort(
    (a, b) => compareAverage((it) => it.theirNetMinor, b, a) ?? byId(a, b),
  )
  return list[0] ?? null
}
