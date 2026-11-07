import type { SessionResult, SessionWithResults } from '@/domain/types'
import { formatMinor } from '@/domain/money'
import { formatHours } from '@/domain/sessionDuration'
import { SEAT_COUNT, SEAT_SELF } from '@/domain/sessionRules'

/**
 * 单场 CSV 导出。仅查看，不支持导入。
 *
 * 格式固定：UTF-8 BOM + CRLF，一行表头加一行整场结果，17 列。
 * 一场只记录部分位置时，未记录位置的三列为空——**不填 0.00**，
 * 凭空写 0 会造出一个并不存在的持平结果。
 */

/** UTF-8 BOM：让 Excel 之类按 UTF-8 打开，而不是本地代码页。 */
const BOM = '\uFEFF'
const LINE_SEPARATOR = '\r\n'

const HEADERS = [
  '对局ID', '标题', '结束时间', '时长(小时)',
  '自己ID', '自己昵称', '自己净金额(元)',
  '上家ID', '上家昵称', '上家净金额(元)',
  '对家ID', '对家昵称', '对家净金额(元)',
  '下家ID', '下家昵称', '下家净金额(元)',
  '备注',
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatTime(epochMillis: number): string {
  const d = new Date(epochMillis)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 文本单元格：先防公式，再按 CSV 规则转义。
 * 顺序不能颠倒——前缀必须加在原始文本前面，包在引号里也仍然生效。
 */
function textCell(raw: string): string {
  const first = raw.charCodeAt(0)
  const needsGuard =
    raw.length > 0 &&
    (raw[0] === '=' || raw[0] === '+' || raw[0] === '-' || raw[0] === '@' || first < 0x20 || first === 0x7f)
  const guarded = needsGuard ? `'${raw}` : raw
  const needsQuoting = /[",\r\n]/.test(guarded)
  return needsQuoting ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

/** 生成整份 CSV 文本；连 seat 0 都没有时返回 null。 */
export function buildSessionCsv(session: SessionWithResults): string | null {
  const bySeat = new Map<number, SessionResult>(session.results.map((it) => [it.seat, it]))
  if (!bySeat.has(SEAT_SELF)) return null

  const s = session.session
  const row: string[] = [
    textCell(s.id),
    textCell(s.title),
    textCell(formatTime(s.playedAt)),
    // 时长是数值列，不加防公式前缀；开始时间可由「结束时间 − 时长」推出，不必再占一列
    formatHours(s.durationMinutes),
  ]
  for (let seat = 0; seat < SEAT_COUNT; seat++) {
    const result = bySeat.get(seat)
    if (!result) {
      row.push('', '', '')
    } else {
      row.push(textCell(result.playerId), textCell(result.nameSnapshot), formatMinor(result.netMinor))
    }
  }
  row.push(textCell(s.note))

  return `${BOM}${HEADERS.map(textCell).join(',')}${LINE_SEPARATOR}${row.join(',')}${LINE_SEPARATOR}`
}

/** 文件名用结束时间与 Session ID 短串，**不含昵称与标题**。 */
export function sessionCsvFileName(session: SessionWithResults): string {
  const d = new Date(session.session.playedAt)
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `manote_${stamp}_${session.session.id.slice(0, 8)}.csv`
}
