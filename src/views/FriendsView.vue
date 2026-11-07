<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AmountText from '@/components/ui/AmountText.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import Sparkline from '@/components/charts/Sparkline.vue'
import { useI18n, type MessageKey } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { MIN_COMMON_SESSIONS, myAverageMinor } from '@/domain/rivalry'
import { divideRounded } from '@/domain/statistics'
import type { FriendBadge } from '@/domain/friendBadges'
import { normalizeNickname, normalizeNote, type ManoteError } from '@/domain/sessionValidator'

/** 三种可排序指标 × 两个方向，与 Android 版 FriendSort 一一对应。 */
type FriendSortKey =
  | 'recent'
  | 'average-desc'
  | 'average-asc'
  | 'my-average-desc'
  | 'my-average-asc'
  | 'net-desc'
  | 'net-asc'

interface SortOption {
  value: FriendSortKey
  label: MessageKey
}

interface FriendRow {
  id: string
  nickname: string
  note: string
  archived: boolean
  updatedAt: number
  sessionCount: number
  netMinor: number
  averageMinor: number
  /** 我与这位牌友同场时我的场均；从没同场过时为 null。 */
  myAverageMinor: number | null
  badges: FriendBadge[]
  /** 最近约 12 场的净额，供迷你走势使用。 */
  sparkline: number[]
}

const BADGE_ORDER: readonly FriendBadge[] = ['WORST_RIVAL', 'LUCKY_STAR', 'TABLE_KING']

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'recent', label: 'friends_sort_recent' },
  { value: 'average-desc', label: 'friends_sort_average_desc' },
  { value: 'average-asc', label: 'friends_sort_average_asc' },
  { value: 'my-average-desc', label: 'friends_sort_my_average_desc' },
  { value: 'my-average-asc', label: 'friends_sort_my_average_asc' },
  { value: 'net-desc', label: 'friends_sort_net_desc' },
  { value: 'net-asc', label: 'friends_sort_net_asc' },
]

const ERROR_KEYS: Record<ManoteError, MessageKey> = {
  INVALID_NICKNAME: 'error_invalid_nickname',
  INVALID_NOTE: 'error_invalid_note',
  INVALID_TITLE: 'error_invalid_title',
  PLAYED_AT_IN_FUTURE: 'error_played_at_in_future',
  INVALID_DURATION: 'error_invalid_duration',
  INVALID_SEAT_SET: 'error_invalid_seat_set',
  DUPLICATE_PLAYER: 'error_duplicate_player',
  SEAT_ZERO_NOT_SELF: 'error_seat_zero_not_self',
  NON_SELF_SEAT_NOT_FRIEND: 'error_non_self_seat_not_friend',
  FRIEND_ARCHIVED: 'error_friend_archived',
  AMOUNT_OUT_OF_RANGE: 'error_amount_out_of_range',
  SESSION_LIMIT_REACHED: 'error_session_limit_reached',
  FRIEND_LIMIT_REACHED: 'error_friend_limit_reached',
  SESSION_ID_ALREADY_EXISTS: 'error_session_id_already_exists',
  SESSION_NOT_FOUND: 'error_session_not_found',
  SESSION_REVISION_CONFLICT: 'error_session_revision_conflict',
  PLAYER_NOT_FOUND: 'error_player_not_found',
  PLAYER_IS_SELF: 'error_player_is_self',
  PLAYER_KIND_MISMATCH: 'error_player_kind_mismatch',
  INTERNAL_STATE_CORRUPTED: 'error_internal_state_corrupted',
}

const { t } = useI18n()
const { show, error: toastError } = useToast()
const store = useDataStore()
const router = useRouter()

const query = ref('')
const includeArchived = ref(false)
const sort = ref<FriendSortKey>('recent')

const createOpen = ref(false)
const helpOpen = ref(false)
const createNickname = ref('')
const createNote = ref('')
const createError = ref('')
const nicknameInput = ref<HTMLInputElement | null>(null)

function errorMessage(code: ManoteError): string {
  return t(ERROR_KEYS[code])
}

// ————————————————— 数据 —————————————————

const totalFriends = computed(() => store.friends.length)

const subtitle = computed(() => {
  const archived = store.archivedFriendCount
  const active = store.activeFriends.length
  return archived > 0
    ? t('friends_count_with_archived_format', [active, archived])
    : t('friends_count_format', [active])
})

/** 同场时我的场均：列表显示与排序都取这一份，和「最苦主 / 福星」同源。 */
const myAverageById = computed(() => {
  const map = new Map<string, number>()
  for (const record of store.rivalryRecords) {
    map.set(record.playerId, myAverageMinor(record))
  }
  return map
})

const allRows = computed<FriendRow[]>(() =>
  store.friends.map((friend) => {
    const aggregate = store.aggregates.get(friend.id)
    const sessionCount = aggregate?.sessionCount ?? 0
    const netMinor = aggregate?.netMinor ?? 0
    const badgeSet = store.friendBadges.get(friend.id)
    return {
      id: friend.id,
      nickname: friend.nickname,
      note: friend.note,
      archived: friend.archivedAt !== null,
      updatedAt: friend.updatedAt,
      sessionCount,
      netMinor,
      averageMinor: sessionCount > 0 ? divideRounded(netMinor, sessionCount) : 0,
      myAverageMinor: myAverageById.value.get(friend.id) ?? null,
      badges: BADGE_ORDER.filter((badge) => badgeSet?.has(badge) ?? false),
      sparkline: store.datedNetsOfPlayer(friend.id).slice(-12).map((item) => item.netMinor),
    }
  }),
)

const keyword = computed(() => query.value.trim().toLowerCase())

function matches(row: FriendRow): boolean {
  if (!keyword.value) return true
  return (
    row.nickname.toLowerCase().includes(keyword.value) ||
    row.note.toLowerCase().includes(keyword.value)
  )
}

function compareIds(a: FriendRow, b: FriendRow): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 数值排序：没有可谈数字的行（null）两个方向都垫底，并列时按 ID 升序。
 * 与 FriendFiltering.kt 的 ranking() 完全一致。
 */
function compareNullable(
  a: FriendRow,
  b: FriendRow,
  select: (row: FriendRow) => number | null,
  descending: boolean,
): number {
  const left = select(a)
  const right = select(b)
  if (left === null && right === null) return compareIds(a, b)
  if (left === null) return 1
  if (right === null) return -1
  if (left === right) return compareIds(a, b)
  return descending ? right - left : left - right
}

function comparatorFor(key: FriendSortKey): (a: FriendRow, b: FriendRow) => number {
  switch (key) {
    case 'recent':
      return (a, b) => b.updatedAt - a.updatedAt || compareIds(a, b)
    case 'average-desc':
      return (a, b) =>
        compareNullable(a, b, (row) => (row.sessionCount > 0 ? row.averageMinor : null), true)
    case 'average-asc':
      return (a, b) =>
        compareNullable(a, b, (row) => (row.sessionCount > 0 ? row.averageMinor : null), false)
    case 'my-average-desc':
      return (a, b) => compareNullable(a, b, (row) => row.myAverageMinor, true)
    case 'my-average-asc':
      return (a, b) => compareNullable(a, b, (row) => row.myAverageMinor, false)
    case 'net-desc':
      return (a, b) =>
        compareNullable(a, b, (row) => (row.sessionCount > 0 ? row.netMinor : null), true)
    case 'net-asc':
      return (a, b) =>
        compareNullable(a, b, (row) => (row.sessionCount > 0 ? row.netMinor : null), false)
  }
}

const visibleRows = computed(() => {
  const rows = allRows.value.filter(
    (row) => (includeArchived.value || !row.archived) && matches(row),
  )
  return rows.sort(comparatorFor(sort.value))
})

// ————————————————— 展示辅助 —————————————————

function initialOf(name: string): string {
  return [...name][0] ?? '?'
}

function badgeLabel(badge: FriendBadge): string {
  if (badge === 'WORST_RIVAL') return t('friends_worst_rival_badge')
  if (badge === 'LUCKY_STAR') return t('friends_lucky_badge')
  return t('friends_table_king_badge')
}

function badgeClass(badge: FriendBadge): string {
  if (badge === 'TABLE_KING') return 'chip chip--gold'
  if (badge === 'LUCKY_STAR') return 'chip chip--win'
  return 'chip chip--loss'
}

function openFriend(id: string): void {
  router.push(`/friends/${id}`)
}

// ————————————————— 新建 —————————————————

const duplicateName = computed(() => {
  const nickname = createNickname.value.trim()
  return nickname.length > 0 && store.friendsByNickname(nickname).length > 0
})

function openCreate(): void {
  createNickname.value = ''
  createNote.value = ''
  createError.value = ''
  createOpen.value = true
}

function closeCreate(): void {
  createOpen.value = false
}

function submitCreate(): void {
  const nickname = normalizeNickname(createNickname.value)
  if (!nickname.ok) {
    createError.value = errorMessage(nickname.error)
    toastError(createError.value)
    return
  }
  const note = normalizeNote(createNote.value)
  if (!note.ok) {
    createError.value = errorMessage(note.error)
    toastError(createError.value)
    return
  }
  const result = store.createFriend(nickname.value, note.value)
  if (!result.ok) {
    createError.value = errorMessage(result.error)
    toastError(createError.value)
    return
  }
  createOpen.value = false
  show(t('friends_add'))
}

watch(createOpen, (open) => {
  if (!open) return
  nextTick(() => nicknameInput.value?.focus())
})

watch([createNickname, createNote], () => {
  createError.value = ''
})

watch([createOpen, helpOpen], ([create, help]) => {
  document.body.style.overflow = create || help ? 'hidden' : ''
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (createOpen.value) {
    createOpen.value = false
    return
  }
  if (helpOpen.value) helpOpen.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="friends">
    <PageHeader :title="t('nav_friends')" :subtitle="subtitle">
      <template #actions>
        <button
          class="icon-btn"
          type="button"
          :title="t('friends_help_action')"
          :aria-label="t('friends_help_action')"
          @click="helpOpen = true"
        >
          <AppIcon name="info" :size="17" />
        </button>
        <button class="btn btn--primary" type="button" @click="openCreate">
          <AppIcon name="plus" :size="15" :stroke-width="2.2" />
          {{ t('friends_add') }}
        </button>
      </template>
    </PageHeader>

    <section v-if="totalFriends > 0" class="toolbar">
      <div class="search">
        <AppIcon name="search" :size="15" class="search__icon" />
        <input
          v-model="query"
          class="input"
          type="search"
          autocomplete="off"
          :placeholder="t('friends_search_hint')"
          :aria-label="t('friends_search_hint')"
        />
      </div>

      <label class="sort">
        <AppIcon name="sort" :size="14" />
        <select v-model="sort" class="select sort__select" :aria-label="t('friends_sort_action')">
          <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
            {{ t(option.label) }}
          </option>
        </select>
      </label>

      <button
        class="archived-toggle"
        type="button"
        role="switch"
        :aria-checked="includeArchived"
        @click="includeArchived = !includeArchived"
      >
        <span class="switch" :aria-checked="includeArchived" aria-hidden="true" />
        <span>{{ t('friends_include_archived') }}</span>
        <span v-if="store.archivedFriendCount > 0" class="archived-count num">
          {{ store.archivedFriendCount }}
        </span>
      </button>
    </section>

    <Panel v-if="totalFriends === 0" class="empty-panel">
      <EmptyState :title="t('friends_empty_title')" :desc="t('friends_empty_desc')" icon="users">
        <button class="btn btn--primary" type="button" @click="openCreate">
          <AppIcon name="plus" :size="15" :stroke-width="2.2" />
          {{ t('friends_add') }}
        </button>
      </EmptyState>
    </Panel>

    <Panel v-else-if="visibleRows.length === 0" class="empty-panel">
      <EmptyState
        :title="t('friends_search_empty_title')"
        :desc="t('friends_search_empty_desc')"
        icon="search"
        compact
      >
        <button
          v-if="!includeArchived && store.archivedFriendCount > 0"
          class="btn btn--ghost"
          type="button"
          @click="includeArchived = true"
        >
          {{ t('friends_include_archived') }}
        </button>
      </EmptyState>
    </Panel>

    <Panel v-else>
      <div class="table-wrap">
        <table class="data friends-table">
          <thead>
            <tr>
              <th scope="col">{{ t('nav_friends') }}</th>
              <th scope="col" class="num col-count">{{ t('friend_stat_sessions') }}</th>
              <th scope="col" class="num">{{ t('stat_average') }}</th>
              <th scope="col" class="num">{{ t('friends_my_average_label') }}</th>
              <th scope="col" class="num">{{ t('friend_stat_net') }}</th>
              <th scope="col" class="col-spark">{{ t('friend_detail_trend_title') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visibleRows"
              :key="row.id"
              class="friend-row"
              @click="openFriend(row.id)"
            >
              <td>
                <div class="friend-cell">
                  <span class="avatar" :class="{ 'avatar--archived': row.archived }" aria-hidden="true">
                    {{ initialOf(row.nickname) }}
                  </span>
                  <div class="friend-main">
                    <div class="friend-line">
                      <RouterLink
                        :to="`/friends/${row.id}`"
                        class="friend-name truncate"
                        @click.stop
                      >
                        {{ row.nickname }}
                      </RouterLink>
                      <span v-if="row.archived" class="chip chip--outline mini-chip">
                        {{ t('friends_archived_badge') }}
                      </span>
                      <span
                        v-for="badge in row.badges"
                        :key="badge"
                        :class="[badgeClass(badge), 'mini-chip']"
                      >
                        {{ badgeLabel(badge) }}
                      </span>
                    </div>
                    <p v-if="row.note" class="friend-note truncate" :title="row.note">
                      {{ row.note }}
                    </p>
                  </div>
                </div>
              </td>

              <td class="num">{{ row.sessionCount }}</td>
              <td class="num">
                <AmountText :minor="row.sessionCount > 0 ? row.averageMinor : null" size="sm" />
              </td>
              <td class="num">
                <AmountText :minor="row.myAverageMinor" size="sm" />
              </td>
              <td class="num">
                <AmountText :minor="row.sessionCount > 0 ? row.netMinor : null" size="sm" />
              </td>
              <td class="spark-cell col-spark">
                <Sparkline :values="row.sparkline" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>

    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="createOpen" class="overlay" @click.self="closeCreate">
          <form
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-friend-title"
            @submit.prevent="submitCreate"
          >
            <h2 id="create-friend-title" class="modal__title">{{ t('friend_create_title') }}</h2>

            <div class="modal__body">
              <label class="field">
                <span class="field__label">
                  {{ t('friend_nickname_label') }}
                  <span class="field__hint">1–12</span>
                </span>
                <input
                  ref="nicknameInput"
                  v-model="createNickname"
                  class="input"
                  type="text"
                  autocomplete="off"
                  maxlength="12"
                  :placeholder="t('friend_nickname_label')"
                />
              </label>

              <p v-if="duplicateName" class="alert alert--info">
                {{ t('friend_duplicate_hint') }}
              </p>

              <label class="field">
                <span class="field__label">
                  {{ t('friend_note_label') }}
                  <span class="field__hint">{{ t('friend_note_hint') }}</span>
                </span>
                <textarea
                  v-model="createNote"
                  class="input"
                  rows="2"
                  maxlength="100"
                  :placeholder="t('friend_note_hint')"
                />
              </label>

              <p v-if="createError" class="field__error">{{ createError }}</p>
            </div>

            <div class="modal__foot">
              <button class="btn btn--ghost" type="button" @click="closeCreate">
                {{ t('action_cancel') }}
              </button>
              <button class="btn btn--primary" type="submit">
                {{ t('friend_action_create') }}
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="helpOpen" class="overlay" @click.self="helpOpen = false">
          <div class="modal modal--wide" role="dialog" aria-modal="true" aria-labelledby="friend-help-title">
            <h2 id="friend-help-title" class="modal__title">{{ t('friends_help_title') }}</h2>

            <div class="modal__body help">
              <p class="help__section">
                {{ t('friends_help_badges_title', [MIN_COMMON_SESSIONS]) }}
              </p>
              <p>{{ t('friends_help_worst_rival') }}</p>
              <p>{{ t('friends_help_lucky') }}</p>
              <p>{{ t('friends_help_table_king') }}</p>
              <p>{{ t('friends_help_archived') }}</p>
              <div class="divider" />
              <p>{{ t('friends_help_stats') }}</p>
              <p>{{ t('friends_help_my_average') }}</p>
              <p>{{ t('friends_help_sort') }}</p>
            </div>

            <div class="modal__foot">
              <button class="btn btn--primary" type="button" @click="helpOpen = false">
                {{ t('action_confirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.friends {
  max-width: var(--maxw);
  margin: 0 auto;
}

/* ————————————————— 工具栏 ————————————————— */

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: 14px;
}

.search {
  position: relative;
  flex: 1 1 260px;
  min-width: 200px;
}

.search .input {
  height: 36px;
  padding-left: 34px;
}

.search__icon {
  position: absolute;
  top: 50%;
  left: 11px;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}

.sort {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-3);
  flex: none;
}

.sort__select {
  width: 154px;
  height: 36px;
  font-size: 12.5px;
}

.archived-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 550;
  color: var(--text-2);
  flex: none;
}

.archived-toggle:hover {
  color: var(--text);
}

.archived-count {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 19px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--chip);
  color: var(--text-3);
  font-size: 11px;
}

/* ————————————————— 表格 ————————————————— */

.empty-panel {
  padding: 8px 0;
}

.friends-table {
  min-width: 760px;
}

.col-count {
  width: 72px;
}

.col-spark {
  width: 116px;
}

.friend-row {
  cursor: pointer;
}

.friend-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 10px;
  background: var(--brand-container);
  color: var(--on-brand-container);
  font-size: 13px;
  font-weight: 700;
}

.avatar--archived {
  background: var(--chip);
  color: var(--text-3);
}

.friend-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.friend-line {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.friend-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  max-width: 220px;
}

.friend-name:hover {
  color: var(--brand);
}

.friend-note {
  max-width: 340px;
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.45;
}

.mini-chip {
  height: 19px;
  padding: 0 7px;
  font-size: 11px;
  font-weight: 600;
}

.spark-cell {
  padding-left: 4px;
}

/* ————————————————— 说明弹层 ————————————————— */

.help p {
  font-size: 12.5px;
}

.help__section {
  font-weight: 650;
  color: var(--text);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.15s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .toolbar {
    padding: 12px;
  }

  .search {
    flex-basis: 100%;
  }

  .sort {
    flex: 1;
  }

  .sort__select {
    flex: 1;
    width: auto;
  }

  .col-spark {
    display: none;
  }

  .friends-table {
    min-width: 620px;
  }

  .friend-note {
    max-width: 220px;
  }
}
</style>
