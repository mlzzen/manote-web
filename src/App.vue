<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon, { type IconName } from '@/components/ui/AppIcon.vue'
import { useI18n, type MessageKey } from '@/i18n'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { todayLabel } from '@/domain/uiText'
import { APP_VERSION } from '@/app/version'

const { t, locale, setLocale } = useI18n()
const { resolved, toggle } = useTheme()
const { items } = useToast()
const store = useDataStore()
const route = useRoute()
const router = useRouter()

interface NavItem {
  to: string
  labelKey: MessageKey
  icon: IconName
  match: string
}

const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav_home', icon: 'dashboard', match: '/' },
  { to: '/sessions', labelKey: 'nav_sessions', icon: 'list', match: '/sessions' },
  { to: '/calendar', labelKey: 'calendar_title', icon: 'calendar', match: '/calendar' },
  { to: '/friends', labelKey: 'nav_friends', icon: 'users', match: '/friends' },
  { to: '/settings', labelKey: 'nav_settings', icon: 'settings', match: '/settings' },
]

const today = computed(() => todayLabel(Date.now(), locale.value))

function isActive(item: NavItem): boolean {
  if (item.to === '/') return route.path === '/'
  return route.path.startsWith(item.match)
}

onMounted(() => {
  document.documentElement.lang = locale.value
  // 首次启动（或清空数据后）要有一个本人档案：seat 0 恒为 SELF。
  if (!store.self) store.ensureSelf(t('default_self_nickname'))
  // 回收站只保留 30 天：每次启动清一次，免得它无限增长。
  store.purgeExpiredTrash()
})

const storedSessions = computed(() => store.activeSessions.length)
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <RouterLink to="/" class="brand">
        <span class="brand__mark" aria-hidden="true">麻</span>
        <span class="brand__text">
          <strong>{{ t('app_name') }}</strong>
          <small>{{ t('app_tagline') }}</small>
        </span>
      </RouterLink>

      <button class="sidebar__cta" type="button" @click="router.push('/sessions/new')">
        <AppIcon name="plus" :size="17" :stroke-width="2.2" />
        {{ t('action_record_session') }}
      </button>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav__item"
          :class="{ 'nav__item--active': isActive(item) }"
        >
          <AppIcon :name="item.icon" :size="17" />
          <span>{{ t(item.labelKey) }}</span>
          <span v-if="item.to === '/sessions'" class="nav__count num">{{ storedSessions }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar__spacer" />

      <div class="sidebar__foot">
        <div class="sidebar__today">
          <span class="faint">{{ today }}</span>
        </div>
        <div class="row row--between">
          <button class="icon-btn" type="button" :title="resolved === 'dark' ? 'Light' : 'Dark'" @click="toggle">
            <AppIcon :name="resolved === 'dark' ? 'sun' : 'moon'" :size="16" />
          </button>
          <button
            class="lang-btn"
            type="button"
            :title="t('settings_language_action')"
            @click="setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')"
          >
            {{ locale === 'zh-CN' ? '中' : 'EN' }}
          </button>
        </div>
        <p class="sidebar__version faint">{{ t('settings_version_format', [APP_VERSION]) }}</p>
      </div>
    </aside>

    <div class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>

    <div class="toast-stack" role="status" aria-live="polite">
      <div v-for="item in items" :key="item.id" class="toast" :class="{ 'toast--danger': item.tone === 'danger' }">
        <AppIcon :name="item.tone === 'danger' ? 'alert' : 'check'" :size="15" />
        {{ item.message }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--page-bg);
  background-attachment: fixed;
}

.sidebar {
  width: var(--sidebar-w);
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px 16px 18px;
  border-right: 1px solid var(--border);
  background: var(--sidebar-bg);
  backdrop-filter: blur(14px);
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 6px 8px;
  min-width: 0;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 11px;
  background: linear-gradient(160deg, var(--hero-top), var(--hero-bottom));
  color: #fff;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0;
  box-shadow: 0 4px 12px rgba(12, 36, 25, 0.28);
}

.brand__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.brand__text strong {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.brand__text small {
  font-size: 10.5px;
  color: var(--text-3);
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sidebar__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: var(--brand);
  color: #fff;
  font-size: 13px;
  font-weight: 650;
  box-shadow: 0 6px 16px rgba(20, 53, 42, 0.22);
  transition: background 0.16s ease, transform 0.1s ease;
}

.sidebar__cta:hover {
  background: var(--brand-hover);
}

.sidebar__cta:active {
  transform: translateY(1px);
}

:root[data-theme='dark'] .sidebar__cta {
  color: #0c1f16;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav__item {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 550;
  color: var(--text-2);
  transition: background 0.14s ease, color 0.14s ease;
}

.nav__item:hover {
  background: color-mix(in srgb, var(--chip) 70%, transparent);
  color: var(--text);
}

.nav__item--active {
  background: var(--brand-container);
  color: var(--on-brand-container);
  font-weight: 650;
}

.nav__count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  background: color-mix(in srgb, var(--chip) 80%, transparent);
  border-radius: 999px;
  padding: 0 7px;
  line-height: 18px;
}

.nav__item--active .nav__count {
  color: var(--on-brand-container);
  background: color-mix(in srgb, #fff 45%, transparent);
}

.sidebar__spacer {
  flex: 1;
}

.sidebar__foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.sidebar__today {
  font-size: 11.5px;
}

.lang-btn {
  height: 26px;
  min-width: 34px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text-2);
  background: var(--chip);
}

.lang-btn:hover {
  color: var(--text);
}

.sidebar__version {
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.main {
  flex: 1;
  min-width: 0;
  padding: 26px var(--gutter) 60px;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    position: sticky;
    top: 0;
    z-index: 30;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .brand__text,
  .sidebar__foot,
  .sidebar__spacer,
  .sidebar__cta {
    display: none;
  }

  .brand {
    padding: 0;
  }

  .nav {
    flex-direction: row;
    gap: 4px;
  }

  .nav__item span:not(.nav__count) {
    display: none;
  }

  .nav__count {
    display: none;
  }

  .main {
    padding: 18px 14px 48px;
  }
}
</style>
