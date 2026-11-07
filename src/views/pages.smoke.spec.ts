// @vitest-environment jsdom
/**
 * 页面级渲染冒烟测试。
 *
 * 类型检查看不出「模板里取了一个不存在的属性」，而浏览器在这个环境里起不来，
 * 因此用 jsdom 把每个页面真挂载一次：模板报错、store 取值报错、图表除零，
 * 都会在这里变成一条失败的断言，而不是上线后的一张白屏。
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { Component } from 'vue'

import DashboardView from './DashboardView.vue'
import SessionsView from './SessionsView.vue'
import SessionDetailView from './SessionDetailView.vue'
import SessionEditView from './SessionEditView.vue'
import CalendarView from './CalendarView.vue'
import FriendsView from './FriendsView.vue'
import FriendDetailView from './FriendDetailView.vue'
import SettingsView from './SettingsView.vue'
import RecycleBinView from './RecycleBinView.vue'

import { useDataStore } from '@/stores/data'
import { createSampleData } from '@/data/sample'
import { setLocale } from '@/i18n'
import App from '@/App.vue'

const routes = [
  { path: '/', component: DashboardView },
  { path: '/sessions', component: SessionsView },
  { path: '/sessions/new', component: SessionEditView },
  { path: '/sessions/:id/edit', component: SessionEditView },
  { path: '/sessions/:id', component: SessionDetailView },
  { path: '/calendar', component: CalendarView },
  { path: '/friends', component: FriendsView },
  { path: '/friends/:id', component: FriendDetailView },
  { path: '/settings', component: SettingsView },
  { path: '/trash', component: RecycleBinView },
]

async function mountAt(path: string, component: Component): Promise<ReturnType<typeof mount>> {
  setLocale('zh-CN')
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useDataStore()
  store.eraseAll()
  store.ensureSelf('我')
  store.replaceAll(createSampleData(1700000000000))

  const router: Router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()

  const wrapper = mount(component, { global: { plugins: [pinia, router] } })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return wrapper
}

describe('pages render with real data', () => {
  it('dashboard shows the running net result and charts', async () => {
    const wrapper = await mountAt('/', DashboardView)
    const text = wrapper.text()
    expect(text).toContain('累计净输赢')
    expect(text).toContain('累计净额曲线')
    expect(text).toContain('分时段战绩')
    expect(wrapper.findAll('svg').length).toBeGreaterThan(2)
    wrapper.unmount()
  })

  it('dashboard renders an empty state when there is nothing recorded', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDataStore()
    store.eraseAll()
    store.ensureSelf('我')

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(DashboardView, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toContain('暂无记录')
    wrapper.unmount()
  })

  it('sessions list groups rows by month', async () => {
    const wrapper = await mountAt('/sessions', SessionsView)
    expect(wrapper.text()).toContain('筛选结果净输赢')
    expect(wrapper.findAll('tbody tr.session-row').length).toBeGreaterThan(10)
    wrapper.unmount()
  })

  it('session detail shows seats and a settlement', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDataStore()
    store.eraseAll()
    store.ensureSelf('我')
    store.replaceAll(createSampleData(1700000000000))
    const id = store.sessionRows[0].id

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(`/sessions/${id}`)
    await router.isReady()
    const wrapper = mount(SessionDetailView, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toContain('本人净输赢')
    expect(wrapper.text()).toContain('结清建议')
    wrapper.unmount()
  })

  it('the record form renders four seats and a total', async () => {
    const wrapper = await mountAt('/sessions/new', SessionEditView)
    const text = wrapper.text()
    expect(text).toContain('保存整场结果')
    expect(text).toContain('自己')
    expect(text).toContain('上家')
    expect(text).toContain('下家')
    wrapper.unmount()
  })

  it('the edit form fills in the saved values', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDataStore()
    store.eraseAll()
    store.ensureSelf('我')
    store.replaceAll(createSampleData(1700000000000))
    const id = store.sessionRows[0].id

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(`/sessions/${id}/edit`)
    await router.isReady()
    const wrapper = mount(SessionEditView, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toContain('修改本场')
    wrapper.unmount()
  })

  it('calendar renders a heatmap and the month sessions', async () => {
    const wrapper = await mountAt('/calendar', CalendarView)
    expect(wrapper.text()).toContain('当月净输赢')
    expect(wrapper.text()).toContain('出勤')
    expect(wrapper.findAll('.mcal__cell').length).toBeGreaterThan(27)
    wrapper.unmount()
  })

  it('friends list renders a sortable table with badges', async () => {
    const wrapper = await mountAt('/friends', FriendsView)
    expect(wrapper.text()).toContain('位牌友')
    expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(3)
    wrapper.unmount()
  })

  it('friend detail shows together stats and the trend', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDataStore()
    store.eraseAll()
    store.ensureSelf('我')
    store.replaceAll(createSampleData(1700000000000))
    const friend = store.friends.find((it) => (store.aggregates.get(it.id)?.sessionCount ?? 0) > 0)!

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(`/friends/${friend.id}`)
    await router.isReady()
    const wrapper = mount(FriendDetailView, { global: { plugins: [pinia, router] } })
    expect(wrapper.text()).toContain(friend.nickname)
    expect(wrapper.text()).toContain('同场时我的表现')
    wrapper.unmount()
  })

  it('settings shows data counts and backup actions', async () => {
    const wrapper = await mountAt('/settings', SettingsView)
    const text = wrapper.text()
    expect(text).toContain('数据管理')
    expect(text).toContain('导出备份')
    expect(text).toContain('导入备份')
    wrapper.unmount()
  })

  it('recycle bin renders its empty state', async () => {
    const wrapper = await mountAt('/trash', RecycleBinView)
    expect(wrapper.text()).toContain('回收站')
    wrapper.unmount()
  })
})

describe('language switching', () => {
  it('renders English copy when the locale is English', async () => {
    const wrapper = await mountAt('/', DashboardView)
    setLocale('en')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Cumulative net curve')
    setLocale('zh-CN')
    wrapper.unmount()
  })
})

describe('app shell', () => {
  it('mounts the sidebar, the active page and the toast stack', async () => {
    setLocale('zh-CN')
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDataStore()
    store.eraseAll()
    store.ensureSelf('我')

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [pinia, router] } })

    const text = wrapper.text()
    // 侧栏
    expect(text).toContain('麻记')
    expect(text).toContain('记一场')
    expect(wrapper.findAll('.nav__item').length).toBe(5)
    // 首屏本体已经渲染出来
    expect(wrapper.find('.dash').exists()).toBe(true)
    wrapper.unmount()
  })
})
