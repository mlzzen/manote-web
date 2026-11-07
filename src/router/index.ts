import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 路由。
 *
 * 用 hash 模式：构建产物可以放在任意静态目录直接打开（含 file://），
 * 不需要服务器改写规则——这是纯前端记账工具最省事的部署方式。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { titleKey: 'nav_home' },
  },
  {
    path: '/sessions',
    name: 'sessions',
    component: () => import('@/views/SessionsView.vue'),
    meta: { titleKey: 'nav_sessions' },
  },
  {
    path: '/sessions/new',
    name: 'session-new',
    component: () => import('@/views/SessionEditView.vue'),
    meta: { titleKey: 'action_record_session' },
  },
  {
    path: '/sessions/:id/edit',
    name: 'session-edit',
    component: () => import('@/views/SessionEditView.vue'),
    meta: { titleKey: 'session_edit_title' },
  },
  {
    path: '/sessions/:id',
    name: 'session-detail',
    component: () => import('@/views/SessionDetailView.vue'),
    meta: { titleKey: 'detail_title' },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/views/CalendarView.vue'),
    meta: { titleKey: 'calendar_title' },
  },
  {
    path: '/friends',
    name: 'friends',
    component: () => import('@/views/FriendsView.vue'),
    meta: { titleKey: 'nav_friends' },
  },
  {
    path: '/friends/:id',
    name: 'friend-detail',
    component: () => import('@/views/FriendDetailView.vue'),
    meta: { titleKey: 'friend_detail_title' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'nav_settings' },
  },
  {
    path: '/trash',
    name: 'trash',
    component: () => import('@/views/RecycleBinView.vue'),
    meta: { titleKey: 'bin_title' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(_to, _from, saved) {
    if (saved) return saved
    return { top: 0 }
  },
})
