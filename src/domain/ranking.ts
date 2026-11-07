import type { SeatNet } from './types'

/** 某座位在本场的名次。 */
export interface SeatRank {
  seat: number
  rank: number
}

/**
 * 本场排名。
 *
 * 按净金额从高到低排；同额并列，采用竞赛排名（1、1、3、4）。
 * 结果按名次升序、同额按 seat 升序返回，可直接用于 2×2 展示。
 */
export function rankSeats(nets: SeatNet[]): SeatRank[] {
  const ordered = [...nets].sort((a, b) => b.netMinor - a.netMinor || a.seat - b.seat)
  return ordered.map((seatNet) => {
    const betterCount = nets.filter((it) => it.netMinor > seatNet.netMinor).length
    return { seat: seatNet.seat, rank: betterCount + 1 }
  })
}
