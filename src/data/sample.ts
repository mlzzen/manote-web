import type { Player, Session, SessionResult } from '@/domain/types'
import { newId } from '@/domain/id'
import { DEFAULT_TITLE, SEAT_SELF } from '@/domain/sessionRules'

/**
 * 示例数据。
 *
 * Web 版第一次打开时是空的，而「分析」这件事没有数据就看不出价值。
 * 这里生成一组贴近真实使用的样本：约 9 个月、60 余场、8 位牌友，
 * 每场合计恰好为 0，日期与时段分布不均匀（晚场居多，也有通宵场）。
 *
 * 随机数用固定种子的线性同余，因此每次生成的数据一致——
 * 截图、演示与回归都比「每次刷新都不同」有用。
 */

const FRIEND_NAMES = ['老王', '小李', '阿珍', '大刘', '陈姐', '小周', '老赵', '阿杰']

const TITLES = [
  '周五夜战',
  '老地方',
  '周末下午茶',
  '三缺一',
  '连打两场',
  '小聚',
  '通宵场',
]

const NOTES = [
  '手气一般，中途换了风位。',
  '打到后半夜，最后一圈翻回来一点。',
  '新人上桌，节奏有点快。',
  '',
  '',
  '隔壁桌太吵，没打完三圈。',
]

/** 线性同余：种子固定，序列固定。 */
function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

export function createSampleData(now = Date.now()): {
  players: Player[]
  sessions: Session[]
  sessionResults: SessionResult[]
} {
  const rand = createRandom(20260101)
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length) % list.length]

  const selfId = newId()
  const players: Player[] = [
    {
      id: selfId,
      kind: 'SELF',
      nickname: '我',
      note: '',
      archivedAt: null,
      createdAt: now - 300 * 86_400_000,
      updatedAt: now - 300 * 86_400_000,
    },
  ]

  for (const name of FRIEND_NAMES) {
    const createdAt = now - Math.floor(rand() * 260 + 20) * 86_400_000
    players.push({
      id: newId(),
      kind: 'FRIEND',
      nickname: name,
      note: rand() > 0.82 ? '常来的那桌' : '',
      archivedAt: rand() > 0.94 ? createdAt + 30 * 86_400_000 : null,
      createdAt,
      updatedAt: createdAt + Math.floor(rand() * 20) * 86_400_000,
    })
  }

  const friends = players.filter((it) => it.kind === 'FRIEND')
  const sessions: Session[] = []
  const sessionResults: SessionResult[] = []

  const SESSION_COUNT = 64
  for (let index = 0; index < SESSION_COUNT; index++) {
    // 越近的场次越密：把均匀分布压出「最近打得勤」的观感
    const progress = index / SESSION_COUNT
    const daysAgo = Math.floor((1 - progress) * 280 + rand() * 6)
    const date = new Date(now - daysAgo * 86_400_000)
    // 结束时间集中在 17:00–23:59，少数通宵到凌晨 2 点
    const overnight = rand() > 0.86
    const hour = overnight ? 1 + Math.floor(rand() * 2) : 16 + Math.floor(rand() * 8)
    const minute = pick([0, 10, 15, 20, 30, 30, 40, 45, 50])
    date.setHours(hour, minute, 0, 0)

    const durationMinutes = pick([180, 210, 240, 240, 270, 300, 330, 360])

    // 随机挑 2～3 位牌友同场
    const shuffled = [...friends].sort(() => rand() - 0.5)
    const seatFriends = shuffled.slice(0, 2 + Math.floor(rand() * 2))

    // 每位牌友先取一个带符号的整数分金额，本人取反数以凑平这一场
    const friendNets = seatFriends.map(() => {
      const magnitude = 800 + Math.floor(rand() * 5200)
      const rounded = Math.round(magnitude / 10) * 10
      return rand() > 0.46 ? rounded : -rounded
    })
    const selfNet = -friendNets.reduce((total, value) => total + value, 0)

    const sessionId = newId()
    const results: SessionResult[] = [
      {
        sessionId,
        seat: SEAT_SELF,
        playerId: selfId,
        nameSnapshot: '我',
        netMinor: selfNet,
      },
    ]
    seatFriends.forEach((friend, seatIndex) => {
      results.push({
        sessionId,
        seat: seatIndex + 1,
        playerId: friend.id,
        nameSnapshot: friend.nickname,
        netMinor: friendNets[seatIndex],
      })
    })

    const hasTitle = rand() > 0.55
    const title = hasTitle ? pick(TITLES) : DEFAULT_TITLE
    const playedAt = date.getTime()

    sessions.push({
      id: sessionId,
      title,
      playedAt,
      durationMinutes,
      note: pick(NOTES),
      createdAt: playedAt + durationMinutes * 60_000,
      updatedAt: playedAt + durationMinutes * 60_000 + 60_000,
      revision: 1 + Math.floor(rand() * 3),
      deletedAt: rand() > 0.965 ? now - Math.floor(rand() * 20) * 86_400_000 : null,
    })
    sessionResults.push(...results)
  }

  return { players, sessions, sessionResults }
}
