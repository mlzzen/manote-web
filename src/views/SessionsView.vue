<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AmountText from '@/components/ui/AmountText.vue'
import ResultBadge from '@/components/ui/ResultBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { formatHours } from '@/domain/sessionDuration'
import { hasCustomTitle } from '@/domain/sessionView'
import { groupByMonth } from '@/domain/sessionGrouping'
import {
  activeGroupCount,
  applyFilters,
  applySearch,
  emptyFilters,
  friendOptions,
  isFilterActive,
  yearOptions,
  type SessionFilters,
  type SessionOutcome,
} from '@/domain/sessionFiltering'
import { TIME_SLOT_DISPLAY_ORDER, type TimeSlot } from '@/domain/timeSlot'
import { dayKeyOf, monthDay, signedYuan } from '@/domain/uiText'

const { t, locale } = useI18n()
const { show, error: toastError } = useToast()
const store = useDataStore()
const router = useRouter()

const query = ref('')
const filters = reactive<SessionFilters>(emptyFilters())
const showFilters = ref(false)
const selecting = ref(false)
const selected = ref(new Set<string>())
const confirmDelete = ref(false)

const allRows = computed(() => store.sessionRows)
const searched = computed(() => applySearch(allRows.value, query.value))
const filtered = computed(() => applyFilters(searched.value, filters))
const groups = computed(() => groupByMonth(filtered.value, locale.value))
const filteredNet = computed(() => filtered.value.reduce((sum, it) => sum + it.selfNetMinor, 0))
const activeCount = computed(() => activeGroupCount(filters))
const years = computed(() => yearOptions(allRows.value))
const friendChoices = computed(() => friendOptions(allRows.value, store.friends))

const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const outcomeValues: SessionOutcome[] = ['WIN', 'LOSS', 'DRAW']

function slotLabel(slot: TimeSlot): string {
  if (slot === 'MORNING') return t('time_slot_morning')
  if (slot === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

function toggleTimeSlot(slot: TimeSlot): void {
  const next = new Set(filters.timeSlots)
  if (next.has(slot)) next.delete(slot)
  else next.add(slot)
  filters.timeSlots = next
}

function toggleFriend(id: string): void {
  const next = new Set(filters.friendIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  filters.friendIds = next
}

function toggleOutcome(value: SessionOutcome): void {
  const next = new Set(filters.outcomes)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  filters.outcomes = next
}

function setYear(value: number | null): void {
  filters.year = filters.year === value ? null : value
  filters.date = null
}

function setMonth(value: number | null): void {
  filters.month = filters.month === value ? null : value
  filters.date = null
}

function onDateInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (!value) {
    filters.date = null
    return
  }
  filters.date = value
  filters.year = Number.parseInt(value.slice(0, 4), 10)
  filters.month = Number.parseInt(value.slice(5, 7), 10)
}

function resetFilters(): void {
  Object.assign(filters, emptyFilters())
}

function toggleSelecting(): void {
  selecting.value = !selecting.value
  if (!selecting.value) selected.value = new Set()
}

function toggleSelected(id: string): void {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

const allSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((row) => selected.value.has(row.id)),
)

function toggleSelectAll(): void {
  if (allSelected.value) {
    selected.value = new Set()
    return
  }
  selected.value = new Set(filtered.value.map((row) => row.id))
}

function askDelete(): void {
  if (selected.value.size === 0) return
  confirmDelete.value = true
}

function doDelete(): void {
  const ids = [...selected.value]
  const result = store.moveSessionsToTrash(ids)
  confirmDelete.value = false
  if (result.ok) {
    show(t('sessions_delete_done_format', [result.value]))
    selected.value = new Set()
    selecting.value = false
  } else {
    toastError(t('sessions_delete_failed_format', [result.error]))
  }
}

function outcomeLabel(value: SessionOutcome): string {
  if (value === 'WIN') return t('result_win')
  if (value === 'LOSS') return t('result_loss')
  return t('result_draw')
}
</script>

<template>
  <div class="sessions">
    <PageHeader :title="t('nav_sessions')" :subtitle="t('sessions_month_count_format', [allRows.length])">
      <template #actions>
        <button v-if="selecting" class="btn btn--ghost" type="button" @click="toggleSelecting">
          {{ t('action_cancel') }}
        </button>
        <button v-else class="btn btn--ghost" type="button" @click="toggleSelecting">
          {{ t('sessions_select_action') }}
        </button>
        <button
          class="btn btn--ghost filter-btn"
          type="button"
          :class="{ 'filter-btn--active': activeCount > 0 }"
          @click="showFilters = true"
        >
          <AppIcon name="filter" :size="14" />
          {{ t('sessions_filter_action') }}
          <span v-if="activeCount > 0" class="filter-btn__dot num">{{ activeCount }}</span>
        </button>
        <RouterLink to="/sessions/new" class="btn btn--primary">
          <AppIcon name="plus" :size="15" :stroke-width="2.2" />
          {{ t('action_record_session') }}
        </RouterLink>
      </template>
    </PageHeader>

    <div class="toolbar">
      <label class="search">
        <AppIcon name="search" :size="15" class="search__icon" />
        <input v-model="query" class="search__input" :placeholder="t('sessions_search_hint')" />
      </label>
      <div class="toolbar__spacer" />
      <template v-if="selecting">
        <span class="toolbar__hint">{{ t('sessions_selected_format', [selected.size]) }}</span>
        <button class="btn btn--ghost btn--sm" type="button" @click="toggleSelectAll">
          {{ allSelected ? t('sessions_deselect_all') : t('sessions_select_all') }}
        </button>
        <button class="btn btn--danger btn--sm" type="button" :disabled="selected.size === 0" @click="askDelete">
          <AppIcon name="trash" :size="14" />
          {{ t('sessions_delete_action') }}
        </button>
      </template>
    </div>

    <div v-if="filtered.length > 0" class="netband">
      <span class="netband__label">{{ t('sessions_hero_label') }}</span>
      <AmountText :minor="filteredNet" size="lg" />
      <span class="netband__count">{{ t('sessions_month_count_format', [filtered.length]) }}</span>
    </div>

    <Panel v-if="filtered.length > 0">
      <table class="data sessions-table">
        <thead>
          <tr>
            <th v-if="selecting" class="col-check" />
            <th class="col-date">{{ t('session_played_at') }}</th>
            <th>{{ t('session_title_label') }}</th>
            <th class="col-slot">{{ t('sessions_filter_section_time_slot') }}</th>
            <th class="num col-duration">{{ t('session_duration_label') }}</th>
            <th class="num col-amount">{{ t('detail_self_net_label') }}</th>
            <th class="col-result">{{ t('sessions_filter_section_result') }}</th>
            <th class="col-go" />
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.yearMonth">
            <tr class="group-row">
              <td :colspan="selecting ? 8 : 7">
                <div class="group-row__inner">
                  <span class="group-row__label">{{ group.label }}</span>
                  <span class="group-row__count">{{ t('sessions_month_count_format', [group.sessionCount]) }}</span>
                  <span class="group-row__net">{{ t('sessions_month_self_format', [signedYuan(group.selfNetMinor)]) }}</span>
                </div>
              </td>
            </tr>
            <tr
              v-for="row in group.rows"
              :key="row.id"
              class="session-row"
              :class="{ 'session-row--selected': selected.has(row.id) }"
              @click="selecting ? toggleSelected(row.id) : router.push(`/sessions/${row.id}`)"
            >
              <td v-if="selecting" class="col-check" @click.stop>
                <button
                  class="checkbox"
                  type="button"
                  role="checkbox"
                  :aria-checked="selected.has(row.id)"
                  @click="toggleSelected(row.id)"
                >
                  <AppIcon v-if="selected.has(row.id)" name="check" :size="12" :stroke-width="3" />
                </button>
              </td>
              <td class="col-date">
                <span class="num">{{ monthDay(row.playedAt) }}</span>
                <span class="col-date__year faint num">{{ dayKeyOf(row.playedAt).slice(0, 4) }}</span>
              </td>
              <td>
                <div class="session-cell">
                  <span v-if="hasCustomTitle(row)" class="session-cell__title">{{ row.title }}</span>
                  <span class="session-cell__names">
                    {{ row.opponentNames.length > 0 ? row.opponentNames.join(' · ') : t('common_unavailable') }}
                  </span>
                </div>
              </td>
              <td class="col-slot">
                <span class="chip" :class="`chip--slot-${row.timeSlot.toLowerCase()}`">{{ slotLabel(row.timeSlot) }}</span>
              </td>
              <td class="num col-duration">{{ formatHours(row.durationMinutes) }}</td>
              <td class="num col-amount">
                <AmountText :minor="row.selfNetMinor" size="md" />
              </td>
              <td class="col-result">
                <ResultBadge :minor="row.selfNetMinor" compact />
              </td>
              <td class="col-go">
                <AppIcon name="chevron-right" :size="15" class="faint" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </Panel>

    <Panel v-else>
      <EmptyState
        :title="isFilterActive(filters) || query ? t('sessions_filter_empty_title') : t('sessions_empty_title')"
        :desc="isFilterActive(filters) || query ? t('sessions_filter_empty_desc') : t('sessions_empty_desc')"
        icon="list"
      >
        <button v-if="isFilterActive(filters)" class="btn btn--ghost" type="button" @click="resetFilters">
          {{ t('sessions_filter_reset') }}
        </button>
        <RouterLink v-else to="/sessions/new" class="btn btn--primary">
          {{ t('action_record_session') }}
        </RouterLink>
      </EmptyState>
    </Panel>

    <!-- 筛选弹层 -->
    <Teleport to="body">
      <div v-if="showFilters" class="overlay" @click.self="showFilters = false">
        <div class="modal modal--wide filter-modal" role="dialog" aria-modal="true">
          <div class="row row--between">
            <h2 class="modal__title">{{ t('sessions_filter_title') }}</h2>
            <button class="icon-btn" type="button" @click="showFilters = false">
              <AppIcon name="close" :size="16" />
            </button>
          </div>

          <section class="filter-section">
            <h3 class="filter-section__title">{{ t('sessions_filter_section_time_slot') }}</h3>
            <div class="filter-chips">
              <button
                v-for="slot in TIME_SLOT_DISPLAY_ORDER"
                :key="slot"
                class="toggle-chip"
                type="button"
                :aria-pressed="filters.timeSlots.has(slot)"
                @click="toggleTimeSlot(slot)"
              >
                {{ slotLabel(slot) }}
              </button>
            </div>
          </section>

          <section v-if="years.length > 1" class="filter-section">
            <h3 class="filter-section__title">{{ t('sessions_filter_section_year') }}</h3>
            <div class="filter-chips">
              <button
                v-for="year in years"
                :key="year"
                class="toggle-chip"
                type="button"
                :aria-pressed="filters.year === year"
                @click="setYear(year)"
              >
                {{ year }}
              </button>
            </div>
          </section>

          <section class="filter-section">
            <h3 class="filter-section__title">{{ t('sessions_filter_section_month') }}</h3>
            <div class="filter-chips">
              <button
                v-for="month in monthOptions"
                :key="month"
                class="toggle-chip toggle-chip--dense"
                type="button"
                :aria-pressed="filters.month === month"
                @click="setMonth(month)"
              >
                {{ t('sessions_filter_month_format', [month]) }}
              </button>
            </div>
          </section>

          <section class="filter-section">
            <h3 class="filter-section__title">{{ t('sessions_filter_section_date') }}</h3>
            <div class="row">
              <input
                class="input filter-date"
                type="date"
                :value="filters.date ?? ''"
                @input="onDateInput"
              />
              <button v-if="filters.date" class="btn btn--ghost btn--sm" type="button" @click="filters.date = null">
                {{ t('sessions_filter_any') }}
              </button>
            </div>
          </section>

          <section class="filter-section">
            <h3 class="filter-section__title">{{ t('sessions_filter_section_friend') }}</h3>
            <p v-if="friendChoices.length === 0" class="faint filter-empty">
              {{ t('sessions_filter_friend_none') }}
            </p>
            <div v-else class="filter-chips filter-chips--scroll">
              <button
                v-for="friend in friendChoices"
                :key="friend.id"
                class="toggle-chip"
                type="button"
                :aria-pressed="filters.friendIds.has(friend.id)"
                @click="toggleFriend(friend.id)"
              >
                {{ friend.nickname }}
                <span v-if="friend.showId" class="faint">{{ t('sessions_filter_friend_id_format', [friend.id.slice(0, 8)]) }}</span>
              </button>
            </div>
          </section>

          <section class="filter-section">
            <h3 class="filter-section__title">{{ t('sessions_filter_section_result') }}</h3>
            <div class="filter-chips">
              <button
                v-for="value in outcomeValues"
                :key="value"
                class="toggle-chip"
                type="button"
                :aria-pressed="filters.outcomes.has(value)"
                @click="toggleOutcome(value)"
              >
                {{ outcomeLabel(value) }}
              </button>
            </div>
          </section>

          <div class="modal__foot filter-foot">
            <button class="btn btn--ghost" type="button" @click="resetFilters">
              {{ t('sessions_filter_reset') }}
            </button>
            <button class="btn btn--primary" type="button" @click="showFilters = false">
              {{ t('sessions_filter_show_format', [filtered.length]) }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :open="confirmDelete"
      :title="t('sessions_delete_title', [selected.size])"
      :confirm-text="t('sessions_delete_confirm')"
      :cancel-text="t('action_cancel')"
      tone="danger"
      @close="confirmDelete = false"
      @confirm="doDelete"
    >
      {{ t('sessions_delete_message') }}
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.sessions {
  max-width: var(--maxw);
  margin: 0 auto;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar__spacer {
  flex: 1;
}

.toolbar__hint {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
}

.search {
  position: relative;
  display: flex;
  align-items: center;
  width: min(320px, 100%);
}

.search__icon {
  position: absolute;
  left: 12px;
  color: var(--text-3);
  pointer-events: none;
}

.search__input {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 34px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  font-size: 13px;
}

.search__input:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--ring);
}

.filter-btn {
  position: relative;
}

.filter-btn--active {
  border-color: color-mix(in srgb, var(--brand) 45%, transparent);
  color: var(--brand);
}

.filter-btn__dot {
  display: inline-grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--brand);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.netband {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 18px;
  margin-bottom: 12px;
  border-radius: var(--radius-md);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-sm);
}

.netband__label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-2);
  letter-spacing: 0.02em;
}

.netband__count {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-3);
}

.sessions-table td {
  cursor: pointer;
}

.col-check {
  width: 34px;
}

.checkbox {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  border: 1.5px solid var(--border-strong);
  background: var(--surface);
  color: #fff;
  transition: all 0.12s ease;
}

.checkbox[aria-checked='true'] {
  background: var(--brand);
  border-color: var(--brand);
}

.session-row--selected {
  background: color-mix(in srgb, var(--brand-container) 55%, transparent);
}

.group-row td {
  padding: 16px 0 6px;
  border-bottom: 1px solid var(--border);
}

.group-row:first-child td {
  padding-top: 2px;
}

.group-row__inner {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.group-row__label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.group-row__count {
  font-size: 11px;
  color: var(--text-3);
  background: var(--chip);
  border-radius: 999px;
  padding: 0 7px;
  line-height: 17px;
}

.group-row__net {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-2);
  font-family: var(--font-num);
}

.col-date {
  width: 92px;
  font-weight: 600;
}

.col-date__year {
  font-size: 10.5px;
  margin-left: 4px;
  font-weight: 500;
}

.session-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.session-cell__title {
  font-weight: 600;
  font-size: 13px;
}

.session-cell__names {
  font-size: 11.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-slot {
  width: 78px;
}

.chip--slot-morning {
  background: var(--draw-container);
  color: var(--on-draw-container);
}

.chip--slot-afternoon {
  background: var(--loss-container);
  color: var(--on-loss-container);
}

.chip--slot-evening {
  background: var(--brand-container);
  color: var(--on-brand-container);
}

.col-duration {
  width: 64px;
  color: var(--text-2);
  font-size: 12.5px;
}

.col-amount {
  width: 116px;
}

.col-result {
  width: 62px;
}

.col-go {
  width: 26px;
  text-align: right;
}

.filter-modal {
  gap: 14px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.filter-section__title {
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-3);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chips--scroll {
  max-height: 132px;
  overflow-y: auto;
  padding-right: 4px;
}

.toggle-chip--dense {
  padding: 0 10px;
}

.filter-empty {
  font-size: 12px;
}

.filter-date {
  width: 190px;
}

.filter-foot {
  justify-content: space-between;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
</style>
