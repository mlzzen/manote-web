import type { ManoteData } from '@/domain/types'

/**
 * 本地持久化：整库写在一个 localStorage 键里。
 *
 * Web 版没有 Room，这里用「一个 JSON 快照」代替三张表：
 * 事务语义由 store 侧的「先算好新状态、再整体落盘」保证——
 * 写入失败时内存状态会回滚，界面上不会出现半场记录。
 */

const STORAGE_KEY = 'manote.data.v1'

export function emptyData(): ManoteData {
  return { players: [], sessions: [], sessionResults: [] }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 读回整库。任何解析失败都退回空库，而不是让应用打不开——
 * 数据损坏时用户至少还能进来导出一份备份或重新导入。
 */
export function loadData(): ManoteData {
  if (typeof localStorage === 'undefined') return emptyData()
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return emptyData()
  }
  if (!raw) return emptyData()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed)) return emptyData()
    const players = Array.isArray(parsed.players) ? parsed.players : []
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : []
    const sessionResults = Array.isArray(parsed.sessionResults) ? parsed.sessionResults : []
    return {
      players: players as ManoteData['players'],
      sessions: sessions as ManoteData['sessions'],
      sessionResults: sessionResults as ManoteData['sessionResults'],
    }
  } catch {
    return emptyData()
  }
}

/** 落盘。写入失败（例如配额用尽）时抛出，由调用方回滚并提示。 */
export function saveData(data: ManoteData): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** 清空本机数据。 */
export function clearStoredData(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** 当前占用的字节数（UTF-8 近似），用于「我的」页展示数据量。 */
export function storedBytes(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? raw.length : 0
}
