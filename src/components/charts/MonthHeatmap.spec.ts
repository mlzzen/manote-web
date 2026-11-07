// @vitest-environment jsdom
/**
 * 月历热力格：日期下面必须写出当天的金额。
 *
 * 首页那张卡是窄版（compact），以前它只画底色不写数字——
 * 而「这天到底赢了多少」正是这块卡要回答的问题，因此两边都要显示金额，
 * 区别只在字号与格子高度。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MonthHeatmap from './MonthHeatmap.vue'
import type { DayNet } from '@/domain/streak'
import { setLocale } from '@/i18n'

function days(): Map<string, DayNet> {
  return new Map<string, DayNet>([
    ['2026-11-03', { day: '2026-11-03', netMinor: 12_500, sessionCount: 2 }],
    ['2026-11-05', { day: '2026-11-05', netMinor: -8_000, sessionCount: 1 }],
    ['2026-11-18', { day: '2026-11-18', netMinor: 0, sessionCount: 1 }],
  ])
}

function render(compact: boolean) {
  setLocale('zh-CN')
  return mount(MonthHeatmap, { props: { yearMonth: '2026-11', days: days(), compact } })
}

describe('MonthHeatmap amounts', () => {
  it('writes the day amount into every recorded cell (narrow dashboard variant)', () => {
    const wrapper = render(true)
    const amounts = wrapper.findAll('.mcal__amount')
    expect(amounts).toHaveLength(3)
    expect(amounts.map((it) => it.text())).toEqual(['+125', '-80', '0'])
    wrapper.unmount()
  })

  it('writes the day amount in the wide calendar variant too', () => {
    const wrapper = render(false)
    const amounts = wrapper.findAll('.mcal__amount')
    expect(amounts).toHaveLength(3)
    expect(amounts.map((it) => it.text())).toEqual(['+125', '-80', '0'])
    wrapper.unmount()
  })

  it('keeps the exact amount and the session count in the tooltip', () => {
    const wrapper = render(true)
    const recorded = wrapper.findAll('.mcal__cell').filter((it) => it.attributes('title'))
    const first = recorded[0].attributes('title') ?? ''
    expect(first).toContain('2026-11-03')
    expect(first).toContain('+¥125.00')
    expect(first).toContain('2')
    wrapper.unmount()
  })

  it('leaves unrecorded days empty rather than printing a zero', () => {
    const wrapper = render(true)
    // 11 月 4 日没打过牌：那一格既没有金额文字，也没有 title
    const empty = wrapper.findAll('.mcal__cell').find((it) => it.text() === '4')
    expect(empty, '应能找到 11 月 4 日那一格').toBeTruthy()
    expect(empty!.find('.mcal__amount').exists()).toBe(false)
    expect(empty!.attributes('title')).toBeUndefined()
    wrapper.unmount()
  })

  it('renders one blank leading cell per weekday before the 1st', () => {
    const wrapper = render(true)
    // 2026-11-01 是周日，周一开头的一周里它排第 7 格 -> 前面 6 个空位
    const cells = wrapper.findAll('.mcal__cell')
    const blanks = cells.filter((it) => it.classes().includes('mcal__cell--blank'))
    expect(blanks).toHaveLength(6)
    expect(cells).toHaveLength(6 + 30)
    wrapper.unmount()
  })
})
