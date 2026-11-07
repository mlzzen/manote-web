import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ManoteData } from '@/domain/types'

/** 一个够用的 localStorage 替身：整库只有一个键，读写都是字符串。 */
function installMemoryStorage(): void {
  const map = new Map<string, string>()
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}

installMemoryStorage()

const { useDataStore } = await import('./data')

function freshStore() {
  setActivePinia(createPinia())
  const store = useDataStore()
  store.eraseAll()
  store.ensureSelf('我')
  return store
}

describe('data store', () => {
  beforeEach(() => {
    installMemoryStorage()
  })

  it('creates exactly one self profile', () => {
    const store = freshStore()
    expect(store.self?.kind).toBe('SELF')
    const again = store.ensureSelf('我')
    expect(again.ok).toBe(true)
    expect(store.data.players.filter((it) => it.kind === 'SELF')).toHaveLength(1)
  })

  it('creates a session and derives statistics from it', () => {
    const store = freshStore()
    const friend = store.createFriend('老王', '')
    expect(friend.ok).toBe(true)
    if (!friend.ok) return

    const created = store.createSession({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      playedAt: Date.now() - 60_000,
      title: '',
      note: '',
      durationMinutes: 240,
      seats: [
        { seat: 0, playerId: store.self!.id, netMinor: 1200 },
        { seat: 1, playerId: friend.value, netMinor: -1200 },
      ],
    })
    expect(created.ok).toBe(true)
    expect(store.selfStatistics.sessionCount).toBe(1)
    expect(store.selfStatistics.winCount).toBe(1)
    expect(store.selfDatedNets[0].netMinor).toBe(1200)
    // 缺省标题落成占位名，列表因此不必每行重复一句「麻将对局」
    expect(store.data.sessions[0].title).toBe('麻将对局')
  })

  it('rejects a session that ends in the future', () => {
    const store = freshStore()
    const result = store.createSession({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      playedAt: Date.now() + 3_600_000,
      title: '',
      note: '',
      seats: [{ seat: 0, playerId: store.self!.id, netMinor: 0 }],
    })
    expect(result).toEqual({ ok: false, error: 'PLAYED_AT_IN_FUTURE' })
  })

  it('rejects a friend in seat 0 and a self in seat 1', () => {
    const store = freshStore()
    const friend = store.createFriend('小李', '')
    if (!friend.ok) throw new Error('friend creation failed')

    const wrongSelf = store.createSession({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      playedAt: Date.now() - 1000,
      title: '',
      note: '',
      seats: [{ seat: 0, playerId: friend.value, netMinor: 0 }],
    })
    expect(wrongSelf).toEqual({ ok: false, error: 'SEAT_ZERO_NOT_SELF' })

    const wrongFriend = store.createSession({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      playedAt: Date.now() - 1000,
      title: '',
      note: '',
      seats: [
        { seat: 0, playerId: store.self!.id, netMinor: 0 },
        { seat: 1, playerId: store.self!.id, netMinor: 0 },
      ],
    })
    expect(wrongFriend).toEqual({ ok: false, error: 'DUPLICATE_PLAYER' })
  })

  it('refuses an archived friend in a new session but keeps past sessions', () => {
    const store = freshStore()
    const friend = store.createFriend('大刘', '')
    if (!friend.ok) throw new Error('friend creation failed')

    store.createSession({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      playedAt: Date.now() - 5000,
      title: '',
      note: '',
      seats: [
        { seat: 0, playerId: store.self!.id, netMinor: 100 },
        { seat: 1, playerId: friend.value, netMinor: -100 },
      ],
    })
    store.setFriendArchived(friend.value, true)
    expect(store.activeSessions).toHaveLength(1)

    const next = store.createSession({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      playedAt: Date.now() - 1000,
      title: '',
      note: '',
      seats: [
        { seat: 0, playerId: store.self!.id, netMinor: 0 },
        { seat: 1, playerId: friend.value, netMinor: 0 },
      ],
    })
    expect(next).toEqual({ ok: false, error: 'FRIEND_ARCHIVED' })
  })

  it('updates a session atomically and bumps the revision', () => {
    const store = freshStore()
    const created = store.createSession({
      id: '12121212-1212-4212-8212-121212121212',
      playedAt: Date.now() - 10_000,
      title: '',
      note: '',
      seats: [{ seat: 0, playerId: store.self!.id, netMinor: 500 }],
    })
    expect(created.ok).toBe(true)

    const updated = store.updateSession({
      id: '12121212-1212-4212-8212-121212121212',
      expectedRevision: 1,
      playedAt: Date.now() - 20_000,
      title: '改过的标题',
      note: '备注',
      durationMinutes: 300,
      netMinorBySeat: new Map([[0, -750]]),
    })
    expect(updated).toEqual({ ok: true, value: 2 })
    expect(store.selfDatedNets[0].netMinor).toBe(-750)
    expect(store.data.sessions[0].title).toBe('改过的标题')
  })

  it('rejects an update whose revision is stale', () => {
    const store = freshStore()
    store.createSession({
      id: '13131313-1313-4313-8313-131313131313',
      playedAt: Date.now() - 10_000,
      title: '',
      note: '',
      seats: [{ seat: 0, playerId: store.self!.id, netMinor: 500 }],
    })
    const stale = store.updateSession({
      id: '13131313-1313-4313-8313-131313131313',
      expectedRevision: 99,
      playedAt: Date.now() - 20_000,
      title: '',
      note: '',
      durationMinutes: 240,
      netMinorBySeat: new Map([[0, 0]]),
    })
    expect(stale).toEqual({ ok: false, error: 'SESSION_REVISION_CONFLICT' })
  })

  it('soft-deletes into the trash, then restores and purges', () => {
    const store = freshStore()
    const id = '14141414-1414-4414-8414-141414141414'
    store.createSession({
      id,
      playedAt: Date.now() - 10_000,
      title: '',
      note: '',
      seats: [{ seat: 0, playerId: store.self!.id, netMinor: 400 }],
    })

    const trashed = store.moveSessionsToTrash([id])
    expect(trashed).toEqual({ ok: true, value: 1 })
    expect(store.activeSessions).toHaveLength(0)
    expect(store.trashedSessions).toHaveLength(1)
    // 删掉的场次立刻退出所有统计
    expect(store.selfStatistics.sessionCount).toBe(0)

    expect(store.restoreSession(id)).toEqual({ ok: true, value: true })
    expect(store.activeSessions).toHaveLength(1)

    store.moveSessionsToTrash([id])
    expect(store.purgeSessions([id])).toEqual({ ok: true, value: 1 })
    expect(store.data.sessions).toHaveLength(0)
    expect(store.data.sessionResults).toHaveLength(0)
  })

  it('purges trash older than 30 days only', () => {
    const store = freshStore()
    const id = '15151515-1515-4515-8515-151515151515'
    store.createSession({
      id,
      playedAt: Date.now() - 60 * 86_400_000,
      title: '',
      note: '',
      seats: [{ seat: 0, playerId: store.self!.id, netMinor: 400 }],
    })
    store.moveSessionsToTrash([id])

    // 人工把删除时间挪到 31 天前
    const data: ManoteData = {
      ...store.data,
      sessions: store.data.sessions.map((it) => ({ ...it, deletedAt: Date.now() - 31 * 86_400_000 })),
    }
    store.replaceAll(data)
    expect(store.purgeExpiredTrash()).toBe(1)
    expect(store.data.sessions).toHaveLength(0)
  })

  it('replaces everything on import and recalculates from scratch', () => {
    const store = freshStore()
    const imported: ManoteData = {
      players: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          kind: 'SELF',
          nickname: '导入的我',
          note: '',
          archivedAt: null,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      sessions: [],
      sessionResults: [],
    }
    expect(store.replaceAll(imported)).toEqual({ ok: true, value: true })
    expect(store.self?.nickname).toBe('导入的我')
    expect(store.activeSessions).toHaveLength(0)
  })

  it('keeps the previous state when persistence fails', () => {
    const store = freshStore()
    const spy = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const result = store.createFriend('写不进去', '')
    spy.mockRestore()
    expect(result.ok).toBe(false)
    expect(store.friends).toHaveLength(0)
    expect(store.storageError).toContain('Quota')
  })
})
