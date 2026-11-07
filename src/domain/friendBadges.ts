import { bestRival, strongestOpponent, worstRival, type OpponentMatch } from './rivalry'
import type { SessionWithResults } from './types'
import { SEAT_SELF } from './sessionRules'

/** 牌友列表上的标签。 */
export type FriendBadge = 'WORST_RIVAL' | 'LUCKY_STAR' | 'TABLE_KING'

/** 一场 → 与各位同场牌友的对照（三个标签的输入）。 */
export function opponentMatchesOf(session: SessionWithResults): OpponentMatch[] {
  const self = session.results.find((it) => it.seat === SEAT_SELF)
  // 缺 seat 0 说明数据已损坏：宁可这一场不参与评选，也不拿一个错误的基准去和人比。
  if (!self) return []
  return session.results
    .filter((it) => it.seat !== SEAT_SELF)
    .map((it) => ({
      playerId: it.playerId,
      myNetMinor: self.netMinor,
      theirNetMinor: it.netMinor,
    }))
}

/**
 * 全场同场账 → 每位牌友的标签。
 *
 * 三个标签都要横比**所有**牌友才判得出来，因此一次算完。
 * 牌友列表与牌友详情共用这一处结论：两页各算各的，迟早会出现
 * 「列表上标着他、详情页却什么都没有」。
 */
export function friendBadgesOf(matches: OpponentMatch[]): Map<string, Set<FriendBadge>> {
  const result = new Map<string, Set<FriendBadge>>()
  const worstId = worstRival(matches)?.playerId
  const luckyId = bestRival(matches)?.playerId
  const kingId = strongestOpponent(matches)?.playerId
  const add = (playerId: string | undefined, badge: FriendBadge) => {
    if (!playerId) return
    const existing = result.get(playerId)
    if (existing) existing.add(badge)
    else result.set(playerId, new Set([badge]))
  }
  add(worstId, 'WORST_RIVAL')
  add(luckyId, 'LUCKY_STAR')
  add(kingId, 'TABLE_KING')
  return result
}
