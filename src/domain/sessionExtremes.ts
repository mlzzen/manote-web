import type { DatedNet } from './types'

/**
 * 单场极值：赢得最多的那一场、输得最多的那一场。
 *
 * 两边都可能是 null，而且这**不是错误**：「从没赢过」与「单场赢最多 ¥0.00」
 * 是两回事，后者根本不成立——净额 0 的一场既不是赢也不是输。
 */
export interface SessionExtremes {
  bestWin: DatedNet | null
  worstLoss: DatedNet | null
}

export const EMPTY_EXTREMES: SessionExtremes = { bestWin: null, worstLoss: null }

/** 是否至少有一边的记录可展示。 */
export function hasAnyExtreme(extremes: SessionExtremes): boolean {
  return extremes.bestWin !== null || extremes.worstLoss !== null
}

/**
 * 由各场的（结束时间，净额）算出两个极值。
 *
 * 持平不参与；同额时命中**最早**的一场（先按结束时间升序，取遇到的第一个极值）。
 */
export function extremesOf(items: DatedNet[]): SessionExtremes {
  const ordered = [...items].sort((a, b) => a.playedAt - b.playedAt)
  let bestWin: DatedNet | null = null
  let worstLoss: DatedNet | null = null
  for (const item of ordered) {
    if (bestWin === null || item.netMinor > bestWin.netMinor) bestWin = item
    if (worstLoss === null || item.netMinor < worstLoss.netMinor) worstLoss = item
  }
  return {
    bestWin: bestWin !== null && bestWin.netMinor > 0 ? bestWin : null,
    worstLoss: worstLoss !== null && worstLoss.netMinor < 0 ? worstLoss : null,
  }
}
