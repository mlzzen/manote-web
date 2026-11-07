/** 一笔结清建议：fromSeat 应付给 toSeat 多少分。 */
export interface Transfer {
  fromSeat: number
  toSeat: number
  amountMinor: number
}

import type { SeatNet } from './types'

/**
 * 结清建议。
 *
 * 只做「输家向赢家补齐金额」的算术建议，不表示付款已完成，也不接支付。
 * 待付与待收双方各按余额从大到小、同额按 seat 升序排列，
 * 依次取 min(待付额, 待收额) 撮合；四人场景下笔数天然不超过三笔。
 */
export function suggestSettlement(nets: SeatNet[]): Transfer[] {
  const debtors = nets
    .filter((it) => it.netMinor < 0)
    .map((it) => ({ seat: it.seat, amount: -it.netMinor }))
    .sort((a, b) => b.amount - a.amount || a.seat - b.seat)

  const creditors = nets
    .filter((it) => it.netMinor > 0)
    .map((it) => ({ seat: it.seat, amount: it.netMinor }))
    .sort((a, b) => b.amount - a.amount || a.seat - b.seat)

  const transfers: Transfer[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const owed = debtors[debtorIndex]
    const receivable = creditors[creditorIndex]
    const amount = Math.min(owed.amount, receivable.amount)

    if (amount > 0) {
      transfers.push({ fromSeat: owed.seat, toSeat: receivable.seat, amountMinor: amount })
    }

    owed.amount -= amount
    receivable.amount -= amount

    if (owed.amount === 0) debtorIndex++
    if (receivable.amount === 0) creditorIndex++
  }

  return transfers
}
