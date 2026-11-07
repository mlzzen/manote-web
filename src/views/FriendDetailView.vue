<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import HeroStat from '@/components/ui/HeroStat.vue'
import AmountText from '@/components/ui/AmountText.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import { useI18n, type MessageKey } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import type { DatedNet } from '@/domain/types'
import { myAverageMinor } from '@/domain/rivalry'
import { averageNetMinor, netMinorOf, winRatePercent } from '@/domain/statistics'
import { extremesOf } from '@/domain/sessionExtremes'
import { cumulativeTrend } from '@/domain/trend'
import { hasCustomTitle, timeSlotOfSession } from '@/domain/sessionView'
import { SEAT_SELF } from '@/domain/sessionRules'
import { dateOfKey, dayKeyOf, monthDayOfKey, signedYuan, timeOfDay } from '@/domain/uiText'
import type { TimeSlot } from '@/domain/timeSlot'
import type { FriendBadge } from '@/domain/friendBadges'
import type { ManoteError } from '@/domain/sessionValidator'

interface FriendSessionRow {
  id: string
  playedAt: number
  title: string
  hasCustomTitle: boolean
  seat: number
  theirNetMinor: number
  selfNetMinor: number | null
  timeSlot: TimeSlot
}

const BADGE_ORDER: readonly FriendBadge[] = ['WORST_RIVAL', 'LUCKY_STAR', 'TABLE_KING']

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

const { t, locale } = useI18n()
const { show, error: toastError } = useToast()
const store = useDataStore()
const route = useRoute()
const router = useRouter()

const playerId = computed(() => String(route.params.id ?? ''))
const player = computed(() => store.playerById(playerId.value))
const isArchived = computed(() => player.value?.archivedAt != null)

function errorMessage(code: ManoteError): string {
  return t(ERROR_KEYS[code])
}

const subtitle = computed(() => {
  const current = player.value
  if (!current) return ''
  if (current.archivedAt !== null) {
    return current.note
      ? `${current.note} · ${t('friend_detail_archived_note')}`
      : t('friend_detail_archived_note')
  }
  return current.note
})

// ————————————————————— 他的累计战绩 —————————————————————

const statistics = computed(() => store.statisticsOfPlayer(playerId.value))
const hasSessions = computed(() => statistics.value.sessionCount > 0)
const netTotal = computed(() => netMinorOf(statistics.value))
const average = computed(() => averageNetMinor(statistics.value))
const winRate = computed(() => winRatePercent(statistics.value))

const datedNets = computed(() => store.datedNetsOfPlayer(playerId.value))
const extremes = computed(() => extremesOf(datedNets.value))
const trend = computed(() => cumulativeTrend(datedNets.value))

const trendSummary = computed(() => {
  const points = trend.value
  if (points.length === 0) return null
  let highest = points[0].cumulativeMinor
  let lowest = points[0].cumulativeMinor
  for (const point of points) {
    if (point.cumulativeMinor > highest) highest = point.cumulativeMinor
    if (point.cumulativeMinor < lowest) lowest = point.cumulativeMinor
  }
  return {
    latest: points[points.length - 1].cumulativeMinor,
    highest,
    lowest,
  }
})

const badges = computed<FriendBadge[]>(() => {
  const set = store.friendBadges.get(playerId.value)
  if (!set) return []
  return BADGE_ORDER.filter((badge) => set.has(badge))
})

// ————————————————————— 同场时我的表现 —————————————————————

const together = computed(() => {
  const record = store.rivalryRecords.find((it) => it.playerId === playerId.value)
  if (!record) return null
  return {
    sessionCount: record.commonSessionCount,
    netMinor: record.myNetMinor,
    averageMinor: myAverageMinor(record),
  }
})

// ————————————————————— 逐场记录 —————————————————————

const sessionRows = computed<FriendSessionRow[]>(() => {
  const id = playerId.value
  const rows: FriendSessionRow[] = []
  for (const { session, results } of store.sessionsOfPlayer(id)) {
    const mine = results.find((it) => it.playerId === id)
    // 理论上不会缺：sessionsOfPlayer 已经筛过。真的缺了就跳过，不拿 0 编一条记录。
    if (!mine) continue
    const self = results.find((it) => it.seat === SEAT_SELF)
    rows.push({
      id: session.id,
      playedAt: session.playedAt,
      title: session.title,
      hasCustomTitle: hasCustomTitle(session),
      seat: mine.seat,
      theirNetMinor: mine.netMinor,
      selfNetMinor: self ? self.netMinor : null,
      timeSlot: timeSlotOfSession(session.playedAt, session.durationMinutes),
    })
  }
  return rows
})

const hasAnyCustomTitle = computed(() => sessionRows.value.some((row) => row.hasCustomTitle))

function seatKey(seat: number): MessageKey {
  if (seat === 1) return 'seat_upper'
  if (seat === 2) return 'seat_opposite'
  if (seat === 3) return 'seat_lower'
  return 'seat_self'
}

function timeSlotLabel(slot: TimeSlot): string {
  if (slot === 'MORNING') return t('time_slot_morning')
  if (slot === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

function extremeHint(item: DatedNet | null): string {
  return item ? monthDayOfKey(dayKeyOf(item.playedAt)) : ''
}

function badgeLabel(badge: FriendBadge): string {
  if (badge === 'WORST_RIVAL') return t('friends_worst_rival_badge')
  if (badge === 'LUCKY_STAR') return t('friends_lucky_badge')
  return t('friends_table_king_badge')
}

function badgeTone(badge: FriendBadge): string {
  if (badge === 'TABLE_KING') return 'hero-badge--gold'
  if (badge === 'LUCKY_STAR') return 'hero-badge--lucky'
  return 'hero-badge--worst'
}

function openSession(sessionId: string): void {
  router.push(`/sessions/${sessionId}`)
}

// ————————————————————— 编辑 —————————————————————

const editOpen = ref(false)
const editNickname = ref('')
const editNote = ref('')
const editError = ref('')
const editNicknameInput = ref<HTMLInputElement | null>(null)

function openEdit(): void {
  const current = player.value
  if (!current) return
  editNickname.value = current.nickname
  editNote.value = current.note
  editError.value = ''
  editOpen.value = true
}

function submitEdit(): void {
  const current = player.value
  if (!current) {
    editOpen.value = false
    return
  }
  const result = store.updateFriend(current.id, editNickname.value, editNote.value)
  if (!result.ok) {
    editError.value = errorMessage(result.error)
    toastError(editError.value)
    return
  }
  editOpen.value = false
}

watch(editOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) nextTick(() => editNicknameInput.value?.focus())
})

watch([editNickname, editNote], () => {
  editError.value = ''
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && editOpen.value) editOpen.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

// ————————————————————— 归档 —————————————————————

const archiveOpen = ref(false)

function confirmArchive(): void {
  const current = player.value
  if (!current) {
    archiveOpen.value = false
    return
  }
  // 以点击这一刻的真实状态为准，避免确认框打开期间状态已变。
  const latest = store.playerById(current.id)
  if (!latest) {
    archiveOpen.value = false
    toastError(t('error_player_not_found'))
    return
  }
  const nextArchived = latest.archivedAt === null
  const result = store.setFriendArchived(current.id, nextArchived)
  archiveOpen.value = false
  if (result.ok) {
    show(nextArchived ? t('friends_archived_badge') : t('action_unarchive'))
  } else {
    toastError(errorMessage(result.error))
  }
}
</script>

<template>
  <div class="detail">
    <PageHeader
      :title="player ? player.nickname : t('friend_detail_title')"
      :subtitle="subtitle"
      back-to="/friends"
      :back-label="t('action_back')"
    >
      <template #actions>
        <button v-if="player" class="btn btn--ghost" type="button" @click="openEdit">
          <AppIcon name="edit" :size="14" />
          {{ t('action_edit') }}
        </button>
        <button v-if="player" class="btn btn--ghost" type="button" @click="archiveOpen = true">
          <AppIcon :name="isArchived ? 'restore' : 'archive'" :size="14" />
          {{ isArchived ? t('action_unarchive') : t('action_archive') }}
        </button>
      </template>
    </PageHeader>

    <Panel v-if="!player" class="missing-panel">
      <EmptyState
        :title="t('friend_detail_missing_title')"
        :desc="t('friend_detail_missing_desc')"
        icon="alert"
      >
        <RouterLink to="/friends" class="btn btn--primary">
          <AppIcon name="chevron-left" :size="14" />
          {{ t('action_back') }}
        </RouterLink>
      </EmptyState>
    </Panel>

    <template v-else>
      <HeroStat
        class="profile-hero"
        compact
        :label="t('friend_stat_net')"
        :minor="hasSessions ? netTotal : null"
        :empty-text="t('friends_no_sessions')"
        :caption="isArchived ? t('friends_archived_badge') : ''"
      >
        <span class="hero-chip">{{ t('friends_stat_format', [statistics.sessionCount]) }}</span>
        <span class="hero-chip">
          {{ t('stat_average') }}
          <b>{{ hasSessions ? signedYuan(average) : t('common_unavailable') }}</b>
        </span>
        <span
          v-for="badge in badges"
          :key="badge"
          class="hero-badge"
          :class="badgeTone(badge)"
        >
          {{ badgeLabel(badge) }}
        </span>
      </HeroStat>

      <section class="panels">
        <Panel :title="t('friend_detail_stats_title')">
          <template #actions>
            <span class="chip">{{ t('friends_stat_format', [statistics.sessionCount]) }}</span>
          </template>

          <div class="stats">
            <div class="stat-cell">
              <span class="stat-cell__label">{{ t('friend_stat_sessions') }}</span>
              <span class="stat-cell__value num">{{ statistics.sessionCount }}</span>
              <span class="stat-cell__hint">
                {{
                  t('home_bar_record_value', [
                    statistics.winCount,
                    statistics.lossCount,
                    statistics.drawCount,
                  ])
                }}
              </span>
            </div>

            <div class="stat-cell">
              <span class="stat-cell__label">{{ t('home_stat_win_rate') }}</span>
              <span class="stat-cell__value num">{{ winRate }}%</span>
            </div>

            <div class="stat-cell stat-cell--wide">
              <span class="stat-cell__label">{{ t('stat_average') }}</span>
              <AmountText :minor="hasSessions ? average : null" size="lg" />
            </div>

            <div class="stat-cell">
              <span class="stat-cell__label">{{ t('stat_best_win') }}</span>
              <AmountText :minor="extremes.bestWin?.netMinor ?? null" size="lg" />
              <span class="stat-cell__hint">{{ extremeHint(extremes.bestWin) }}</span>
            </div>

            <div class="stat-cell">
              <span class="stat-cell__label">{{ t('stat_worst_loss') }}</span>
              <AmountText :minor="extremes.worstLoss?.netMinor ?? null" size="lg" />
              <span class="stat-cell__hint">{{ extremeHint(extremes.worstLoss) }}</span>
            </div>
          </div>
        </Panel>

        <Panel :title="t('friend_detail_together_title')">
          <template #actions>
            <span v-if="together" class="chip chip--brand">
              {{ t('friend_stat_together_sessions_format', [together.sessionCount]) }}
            </span>
          </template>

          <div v-if="together" class="together">
            <div class="together__value">
              <span class="together__label">{{ t('friend_stat_together_net') }}</span>
              <AmountText :minor="together.netMinor" size="lg" />
            </div>
            <span class="together__divider" aria-hidden="true" />
            <div class="together__value">
              <span class="together__label">{{ t('friend_stat_together_average') }}</span>
              <AmountText :minor="together.averageMinor" size="lg" />
            </div>
          </div>
          <p v-else class="together-empty">{{ t('friend_detail_together_empty') }}</p>

          <p class="panel__note">{{ t('friend_detail_together_note') }}</p>
        </Panel>

        <Panel :title="t('friend_detail_trend_title')">
          <template #actions>
            <span v-if="trend.length >= 2" class="chip">
              {{ t('friends_stat_format', [trend.length]) }}
            </span>
          </template>

          <template v-if="trend.length >= 2">
            <TrendChart :points="trend" :height="206" />
            <div v-if="trendSummary" class="trend-foot">
              <div class="trend-foot__item">
                <span class="trend-foot__label">{{ t('trend_latest') }}</span>
                <AmountText :minor="trendSummary.latest" size="sm" />
              </div>
              <div class="trend-foot__item">
                <span class="trend-foot__label">{{ t('trend_highest') }}</span>
                <AmountText :minor="trendSummary.highest" size="sm" />
              </div>
              <div class="trend-foot__item">
                <span class="trend-foot__label">{{ t('trend_lowest') }}</span>
                <AmountText :minor="trendSummary.lowest" size="sm" />
              </div>
            </div>
          </template>
          <p v-else class="trend-empty">{{ t('friend_detail_trend_empty') }}</p>
        </Panel>
      </section>

      <Panel class="sessions-panel" :title="t('friend_detail_sessions_title')">
        <template #actions>
          <span v-if="sessionRows.length > 0" class="chip">
            {{ t('friends_stat_format', [sessionRows.length]) }}
          </span>
        </template>

        <EmptyState
          v-if="sessionRows.length === 0"
          :title="t('friend_detail_no_sessions')"
          icon="list"
          compact
        />

        <div v-else class="table-wrap">
          <table class="data sessions-table">
            <thead>
              <tr>
                <th scope="col">{{ t('session_played_at') }}</th>
                <th v-if="hasAnyCustomTitle" scope="col">{{ t('session_title_label') }}</th>
                <th scope="col">{{ locale === 'zh-CN' ? '位置' : 'Seat' }}</th>
                <th scope="col" class="num">{{ t('friend_stat_net') }}</th>
                <th scope="col" class="num">
                  {{ t('friend_session_self_label') }} · {{ t('friend_stat_net') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in sessionRows"
                :key="row.id"
                class="session-row"
                @click="openSession(row.id)"
              >
                <td>
                  <RouterLink
                    :to="`/sessions/${row.id}`"
                    class="session-when"
                    @click.stop
                  >
                    <span class="session-when__date num">
                      {{ dateOfKey(dayKeyOf(row.playedAt)) }}
                    </span>
                    <span class="session-when__meta">
                      {{ timeOfDay(row.playedAt) }} · {{ timeSlotLabel(row.timeSlot) }}
                    </span>
                  </RouterLink>
                </td>

                <td v-if="hasAnyCustomTitle">
                  <span v-if="row.hasCustomTitle" class="session-title truncate" :title="row.title">
                    {{ row.title }}
                  </span>
                  <span v-else class="faint">—</span>
                </td>

                <td>
                  <span class="chip seat-chip">{{ t(seatKey(row.seat)) }}</span>
                </td>
                <td class="num">
                  <AmountText :minor="row.theirNetMinor" size="sm" />
                </td>
                <td class="num">
                  <AmountText :minor="row.selfNetMinor" size="sm" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </template>

    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="editOpen" class="overlay" @click.self="editOpen = false">
          <form
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-friend-title"
            @submit.prevent="submitEdit"
          >
            <h2 id="edit-friend-title" class="modal__title">{{ t('friend_edit_title') }}</h2>

            <div class="modal__body">
              <label class="field">
                <span class="field__label">
                  {{ t('friend_nickname_label') }}
                  <span class="field__hint">1–12</span>
                </span>
                <input
                  ref="editNicknameInput"
                  v-model="editNickname"
                  class="input"
                  type="text"
                  autocomplete="off"
                  maxlength="12"
                  :placeholder="t('friend_nickname_label')"
                />
              </label>

              <label class="field">
                <span class="field__label">
                  {{ t('friend_note_label') }}
                  <span class="field__hint">{{ t('friend_note_hint') }}</span>
                </span>
                <textarea
                  v-model="editNote"
                  class="input"
                  rows="2"
                  maxlength="100"
                  :placeholder="t('friend_note_hint')"
                />
              </label>

              <p v-if="editError" class="field__error">{{ editError }}</p>
            </div>

            <div class="modal__foot">
              <button class="btn btn--ghost" type="button" @click="editOpen = false">
                {{ t('action_cancel') }}
              </button>
              <button class="btn btn--primary" type="submit">{{ t('action_save') }}</button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      :open="archiveOpen"
      :title="isArchived ? t('friend_unarchive_title') : t('friend_archive_title')"
      :confirm-text="isArchived ? t('action_unarchive') : t('action_archive')"
      :cancel-text="t('action_cancel')"
      @close="archiveOpen = false"
      @confirm="confirmArchive"
    >
      <p>{{ isArchived ? t('friend_unarchive_message') : t('friend_archive_message') }}</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.detail {
  max-width: var(--maxw);
  margin: 0 auto;
}

/* ————————————————— 英雄卡 ————————————————— */

.profile-hero {
  margin-bottom: 16px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--hero-chip);
  color: var(--on-hero-chip);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.hero-badge--worst {
  border-color: color-mix(in srgb, var(--hero-win) 72%, transparent);
}

.hero-badge--lucky {
  border-color: color-mix(in srgb, var(--hero-loss) 72%, transparent);
}

.hero-badge--gold {
  border-color: transparent;
  background: var(--gold-container);
  color: var(--on-gold-container);
}

/* ————————————————— 三栏面板 ————————————————— */

.panels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
  align-items: stretch;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 8px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface-alt);
}

.stat-cell--wide {
  grid-column: span 2;
}

.stat-cell__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--text-3);
}

.stat-cell__value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
}

.stat-cell__hint {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.together {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-alt);
}

.together__value {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.together__label {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.35;
}

.together__divider {
  width: 1px;
  height: 38px;
  background: var(--border-strong);
}

.together-empty {
  padding: 10px 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-3);
}

.trend-empty {
  padding: 18px 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-3);
}

.trend-foot {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.trend-foot__item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.trend-foot__label {
  font-size: 11px;
  color: var(--text-3);
}

/* ————————————————— 逐场记录 ————————————————— */

.missing-panel {
  padding: 8px 0;
}

.sessions-panel {
  margin-bottom: 8px;
}

.sessions-table {
  min-width: 680px;
}

.session-row {
  cursor: pointer;
}

.session-when {
  display: flex;
  flex-direction: column;
  gap: 1px;
  white-space: nowrap;
}

.session-when:hover .session-when__date {
  color: var(--brand);
}

.session-when__date {
  font-size: 12.5px;
  font-weight: 600;
}

.session-when__meta {
  font-size: 11px;
  color: var(--text-3);
}

.session-title {
  display: inline-block;
  max-width: 260px;
  font-size: 12.5px;
  vertical-align: middle;
}

.seat-chip {
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.15s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

@media (max-width: 1280px) {
  .panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panels > :last-child {
    grid-column: span 2;
  }
}

@media (max-width: 900px) {
  .panels {
    grid-template-columns: minmax(0, 1fr);
  }

  .panels > :last-child {
    grid-column: auto;
  }

  .sessions-table {
    min-width: 560px;
  }

  .session-title {
    max-width: 180px;
  }
}
</style>
