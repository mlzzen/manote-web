import { describe, expect, it } from 'vitest'
import {
  buildBackup,
  decodeBackup,
  encodeBackup,
  validateBackup,
  type BackupFile,
} from '../data/backup'
import type { ManoteData } from './types'
import { ts } from './testing/fixtures'

const SELF_ID = '11111111-1111-4111-8111-111111111111'
const FRIEND_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'

function sampleData(): ManoteData {
  const playedAt = ts(2026, 10, 5, 21, 30)
  return {
    players: [
      {
        id: SELF_ID,
        kind: 'SELF',
        nickname: '我',
        note: '',
        archivedAt: null,
        createdAt: playedAt - 1000,
        updatedAt: playedAt - 1000,
      },
      {
        id: FRIEND_ID,
        kind: 'FRIEND',
        nickname: '老王',
        note: '常客',
        archivedAt: null,
        createdAt: playedAt - 2000,
        updatedAt: playedAt - 2000,
      },
    ],
    sessions: [
      {
        id: SESSION_ID,
        title: '周五夜战',
        playedAt,
        durationMinutes: 240,
        note: '打到后半夜',
        createdAt: playedAt + 1000,
        updatedAt: playedAt + 2000,
        revision: 1,
        deletedAt: null,
      },
    ],
    sessionResults: [
      {
        sessionId: SESSION_ID,
        seat: 0,
        playerId: SELF_ID,
        nameSnapshot: '我',
        netMinor: 1500,
      },
      {
        sessionId: SESSION_ID,
        seat: 1,
        playerId: FRIEND_ID,
        nameSnapshot: '老王',
        netMinor: -1500,
      },
    ],
  }
}

describe('backup round trip', () => {
  it('encodes and decodes without losing anything', () => {
    const file = buildBackup(sampleData(), '1.0.0', ts(2026, 10, 6, 9, 0))
    const decoded = decodeBackup(encodeBackup(file))
    expect(decoded).not.toBeNull()
    expect(decoded!.sessions.length).toBe(1)
    expect(decoded!.players.length).toBe(2)
  })

  it('validates a self-consistent file and returns its summary', () => {
    const file = buildBackup(sampleData(), '1.0.0')
    const check = validateBackup(file)
    expect(check.ok).toBe(true)
    if (check.ok) {
      expect(check.summary.sessionCount).toBe(1)
      expect(check.summary.friendCount).toBe(1)
      expect(check.summary.selfNickname).toBe('我')
    }
  })

  it('drops trashed sessions from the export', () => {
    const data = sampleData()
    data.sessions[0].deletedAt = Date.now()
    const file = buildBackup(data, '1.0.0')
    expect(file.sessions).toHaveLength(0)
    expect(file.sessionResults).toHaveLength(0)
  })
})

describe('backup validation rejections', () => {
  function mutate(edit: (file: BackupFile) => void): BackupFile {
    const file = buildBackup(sampleData(), '1.0.0')
    edit(file)
    return file
  }

  it('rejects an unsupported schema version', () => {
    const check = validateBackup(mutate((file) => (file.schemaVersion = 2)))
    expect(check).toEqual({ ok: false, reason: 'UNSUPPORTED_VERSION' })
  })

  it('rejects unknown player kinds', () => {
    const check = validateBackup(mutate((file) => (file.players[1].kind = 'UNKNOWN')))
    expect(check).toEqual({ ok: false, reason: 'MALFORMED' })
  })

  it('rejects a missing self profile', () => {
    const check = validateBackup(mutate((file) => (file.players[0].kind = 'FRIEND')))
    expect(check).toEqual({ ok: false, reason: 'INVALID_SELF' })
  })

  it('rejects duplicate ids', () => {
    const check = validateBackup(mutate((file) => (file.players[1].id = file.players[0].id)))
    expect(check).toEqual({ ok: false, reason: 'INVALID_ID' })
  })

  it('rejects rows pointing at a missing player', () => {
    const check = validateBackup(mutate((file) => (file.sessionResults[1].playerId = '44444444-4444-4444-8444-444444444444')))
    expect(check).toEqual({ ok: false, reason: 'ORPHAN_REFERENCE' })
  })

  it('rejects a session without seat 0', () => {
    const check = validateBackup(mutate((file) => (file.sessionResults = [file.sessionResults[1]])))
    expect(check).toEqual({ ok: false, reason: 'INCOMPLETE_SEATS' })
  })

  it('rejects a seat whose player kind does not match', () => {
    const check = validateBackup(mutate((file) => (file.sessionResults[1].seat = 0)))
    expect(check.ok).toBe(false)
    if (!check.ok) expect(['KIND_MISMATCH', 'INCOMPLETE_SEATS']).toContain(check.reason)
  })

  it('rejects out-of-range amounts', () => {
    const check = validateBackup(mutate((file) => (file.sessionResults[0].netMinor = 2_000_000)))
    expect(check).toEqual({ ok: false, reason: 'AMOUNT_OUT_OF_RANGE' })
  })

  it('rejects invalid durations', () => {
    const check = validateBackup(mutate((file) => (file.sessions[0].durationMinutes = 250)))
    expect(check).toEqual({ ok: false, reason: 'INVALID_DURATION' })
  })

  it('rejects an end time later than the last edit', () => {
    const check = validateBackup(
      mutate((file) => {
        file.sessions[0].playedAt = file.sessions[0].updatedAt + 1
      }),
    )
    expect(check).toEqual({ ok: false, reason: 'INVALID_TIME' })
  })

  it('rejects text with surrounding whitespace', () => {
    const check = validateBackup(mutate((file) => (file.players[1].nickname = ' 老王 ')))
    expect(check).toEqual({ ok: false, reason: 'INVALID_TEXT' })
  })

  it('rejects an unparsable document', () => {
    expect(decodeBackup('{not json')).toBeNull()
    expect(decodeBackup('{"schemaVersion":3}')).toBeNull()
  })
})

/**
 * Android 版导出的真实形状：kotlinx.serialization 默认不写「等于默认值」的字段，
 * 于是时长正好是 4 小时的场次根本没有 durationMinutes 这一项。
 * 这类文件必须能原样导入，并且补齐成 240 分钟。
 */
describe('backups written by the Android app', () => {
  function androidBackup(sessionOverrides: Record<string, unknown> = {}): string {
    const playedAt = ts(2026, 10, 5, 21, 30)
    return JSON.stringify({
      schemaVersion: 3,
      appVersion: '1.7.0',
      exportedAt: ts(2026, 11, 7, 12, 30),
      players: [
        {
          id: SELF_ID,
          kind: 'SELF',
          nickname: '我',
          note: '',
          archivedAt: null,
          createdAt: playedAt - 2000,
          updatedAt: playedAt - 1000,
        },
        {
          id: FRIEND_ID,
          kind: 'FRIEND',
          nickname: '老王',
          note: '',
          archivedAt: null,
          createdAt: playedAt - 3000,
          updatedAt: playedAt - 3000,
        },
      ],
      sessions: [
        {
          id: SESSION_ID,
          title: '麻将对局',
          playedAt,
          note: '',
          createdAt: playedAt + 1000,
          updatedAt: playedAt + 2000,
          revision: 1,
          ...sessionOverrides,
        },
      ],
      sessionResults: [
        { sessionId: SESSION_ID, seat: 0, playerId: SELF_ID, nameSnapshot: '我', netMinor: 1500 },
        { sessionId: SESSION_ID, seat: 1, playerId: FRIEND_ID, nameSnapshot: '老王', netMinor: -1500 },
      ],
    })
  }

  it('imports a session that omits durationMinutes, filling in 4 hours', () => {
    const decoded = decodeBackup(androidBackup())
    expect(decoded).not.toBeNull()
    expect(decoded!.sessions[0].durationMinutes).toBe(240)

    const check = validateBackup(decoded!)
    expect(check.ok).toBe(true)
    if (check.ok) expect(check.summary.sessionCount).toBe(1)
  })

  it('keeps an explicitly recorded duration', () => {
    const decoded = decodeBackup(androidBackup({ durationMinutes: 270 }))
    expect(decoded!.sessions[0].durationMinutes).toBe(270)
    expect(validateBackup(decoded!).ok).toBe(true)
  })

  it('still rejects a duration that is out of range or off the 0.1-hour grid', () => {
    for (const value of [250, 10, 2000]) {
      const decoded = decodeBackup(androidBackup({ durationMinutes: value }))
      expect(validateBackup(decoded!).ok, String(value)).toBe(false)
      const check = validateBackup(decoded!)
      if (!check.ok) expect(check.reason).toBe('INVALID_DURATION')
    }
  })

  it('tolerates a UTF-8 BOM in front of the document', () => {
    const decoded = decodeBackup(`\uFEFF${androidBackup()}`)
    expect(decoded).not.toBeNull()
    expect(validateBackup(decoded!).ok).toBe(true)
  })
})
