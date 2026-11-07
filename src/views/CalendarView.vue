<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import HeroStat from '@/components/ui/HeroStat.vue'
import StatTile from '@/components/ui/StatTile.vue'
import AmountText from '@/components/ui/AmountText.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import MonthHeatmap from '@/components/charts/MonthHeatmap.vue'
import { useI18n } from '@/i18n'
import { useDataStore } from '@/stores/data'
import { monthNetMinor, monthSummaryOf, monthWinRatePercent, yearMonthKey } from '@/domain/monthSummary'
import { formatHours } from '@/domain/sessionDuration'
import { hasCustomTitle } from '@/domain/sessionView'
import type { TimeSlot } from '@/domain/timeSlot'
import { dayKeyOf, monthDayOfKey, monthLabel, signedYuan, timeOfDay } from '@/domain/uiText'

const { t, locale } = useI18n()
const store = useDataStore()
const route = useRoute()
const router = useRouter()

function normalizeMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^\d{4}-\d{2}$/.test(value) ? value : null
}

function normalizeDay(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

const thisMonth = yearMonthKey(Date.now())
const month = ref(normalizeMonth(route.query.month) ?? thisMonth)
const selectedDay = ref<string | null>(normalizeDay(route.query.day))

watch(
  () => route.query,
  (query) => {
    const nextMonth = normalizeMonth(query.month)
    if (nextMonth && nextMonth !== month.value) month.value = nextMonth
    const nextDay = normalizeDay(query.day)
    if (nextDay !== selectedDay.value) selectedDay.value = nextDay
  },
)

const summary = computed(() => monthSummaryOf(store.selfDatedNets, month.value))
const net = computed(() => monthNetMinor(summary.value))
const winRate = computed(() => monthWinRatePercent(summary.value))
const playedDays = computed(() => summary.value.days.size)

const monthRows = computed(() =>
  store.sessionRows.filter((row) => dayKeyOf(row.playedAt).slice(0, 7) === month.value),
)

const visibleRows = computed(() =>
  selectedDay.value
    ? monthRows.value.filter((row) => dayKeyOf(row.playedAt) === selectedDay.value)
    : monthRows.value,
)

const dayNet = computed(() => {
  if (!selectedDay.value) return null
  return summary.value.days.get(selectedDay.value)?.netMinor ?? null
})

function slotLabel(slot: TimeSlot): string {
  if (slot === 'MORNING') return t('time_slot_morning')
  if (slot === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

function shiftMonth(delta: number): void {
  const [year, m] = month.value.split('-').map((it) => Number.parseInt(it, 10))
  const date = new Date(year, m - 1 + delta, 1)
  const next = yearMonthKey(date.getTime())
  month.value = next
  selectedDay.value = null
  void router.replace({ query: { month: next } })
}

function shiftYear(delta: number): void {
  const [year, m] = month.value.split('-').map((it) => Number.parseInt(it, 10))
  const next = yearMonthKey(new Date(year + delta, m - 1, 1).getTime())
  month.value = next
  selectedDay.value = null
  void router.replace({ query: { month: next } })
}

function goToday(): void {
  month.value = thisMonth
  selectedDay.value = null
  void router.replace({ query: { month: thisMonth } })
}

function selectDay(dayKey: string): void {
  selectedDay.value = selectedDay.value === dayKey ? null : dayKey
  void router.replace({ query: { month: month.value, ...(selectedDay.value ? { day: selectedDay.value } : {}) } })
}
</script>

<template>
  <div class="calendar">
    <PageHeader :title="t('calendar_title')" :subtitle="monthLabel(month, locale)">
      <template #actions>
        <div class="month-nav">
          <button class="icon-btn" type="button" :title="t('calendar_prev_year')" @click="shiftYear(-1)">
            <span class="nav-arrow">«</span>
          </button>
          <button class="icon-btn" type="button" :title="t('calendar_prev_month')" @click="shiftMonth(-1)">
            <AppIcon name="chevron-left" :size="16" />
          </button>
          <button class="month-nav__label" type="button" @click="goToday">
            {{ monthLabel(month, locale) }}
          </button>
          <button class="icon-btn" type="button" :title="t('calendar_next_month')" @click="shiftMonth(1)">
            <AppIcon name="chevron-right" :size="16" />
          </button>
          <button class="icon-btn" type="button" :title="t('calendar_next_year')" @click="shiftYear(1)">
            <span class="nav-arrow">»</span>
          </button>
        </div>
      </template>
    </PageHeader>

    <section class="cal-grid">
      <HeroStat
        :label="t('calendar_hero_label')"
        :minor="summary.statistics.sessionCount === 0 ? null : net"
        :empty-text="t('calendar_empty')"
        :caption="monthLabel(month, locale)"
      >
        <span class="hero-chip">{{ t('calendar_hero_days_format', [playedDays]) }}</span>
        <span class="hero-chip">{{ t('calendar_stat_sessions') }} <b>{{ summary.statistics.sessionCount }}</b></span>
        <span class="hero-chip">{{ t('calendar_stat_win_rate') }} <b>{{ winRate }}%</b></span>
      </HeroStat>

      <div class="cal-tiles">
        <StatTile
          :label="t('calendar_stat_sessions')"
          :value="String(summary.statistics.sessionCount)"
          :hint="t('calendar_stat_win_rate') + ' ' + winRate + '%'"
          icon="list"
        />
        <StatTile
          :label="t('calendar_best_day')"
          :value="summary.bestDay ? signedYuan(summary.bestDay.netMinor) : '—'"
          :hint="summary.bestDay ? monthDayOfKey(summary.bestDay.day) : t('common_unavailable')"
          icon="arrow-up"
          tone="win"
        />
        <StatTile
          :label="t('calendar_worst_day')"
          :value="summary.worstDay ? signedYuan(summary.worstDay.netMinor) : '—'"
          :hint="summary.worstDay ? monthDayOfKey(summary.worstDay.day) : t('common_unavailable')"
          icon="arrow-down"
          tone="loss"
        />
        <StatTile
          :label="t('home_stat_net')"
          :value="signedYuan(net)"
          :hint="t('calendar_hero_days_format', [playedDays])"
          icon="chart"
          :tone="net > 0 ? 'loss' : net < 0 ? 'win' : 'draw'"
        />
      </div>
    </section>

    <section class="cal-body">
      <Panel :title="monthLabel(month, locale)">
        <template #actions>
          <button v-if="selectedDay" class="chip chip--brand" type="button" @click="selectedDay = null">
            {{ t('calendar_current_month') }}
            <AppIcon name="close" :size="11" />
          </button>
          <span v-else class="chip chip--outline">{{ t('calendar_current_month') }}</span>
        </template>
        <MonthHeatmap
          :year-month="month"
          :days="summary.days"
          :selected="selectedDay"
          @select="selectDay"
        />
        <p v-if="summary.statistics.sessionCount === 0" class="panel__note">{{ t('calendar_empty_hint') }}</p>
      </Panel>

      <Panel :title="selectedDay ? monthDayOfKey(selectedDay) : t('calendar_sessions_title')">
        <template #actions>
          <span class="chip">
            {{ t('calendar_sessions_count_format', [visibleRows.length]) }}
          </span>
          <AmountText v-if="selectedDay" :minor="dayNet" size="sm" />
        </template>

        <ul v-if="visibleRows.length > 0" class="cal-list">
          <li v-for="row in visibleRows" :key="row.id">
            <RouterLink :to="`/sessions/${row.id}`" class="cal-item">
              <span class="cal-item__date">
                <b class="num">{{ monthDayOfKey(dayKeyOf(row.playedAt)) }}</b>
                <small class="num">{{ timeOfDay(row.playedAt) }}</small>
              </span>
              <span class="cal-item__body">
                <span class="cal-item__title truncate">
                  {{ hasCustomTitle(row) ? row.title : row.opponentNames.join(' · ') || t('common_unavailable') }}
                </span>
                <span class="cal-item__meta">
                  <span class="chip chip--tiny" :class="`chip--slot-${row.timeSlot.toLowerCase()}`">
                    {{ slotLabel(row.timeSlot) }}
                  </span>
                  <span class="faint">{{ formatHours(row.durationMinutes) }} {{ t('session_duration_unit') }}</span>
                </span>
              </span>
              <AmountText :minor="row.selfNetMinor" size="md" />
            </RouterLink>
          </li>
        </ul>

        <EmptyState
          v-else
          compact
          :title="t('calendar_empty')"
          :desc="t('calendar_empty_hint')"
          icon="calendar"
        />
      </Panel>
    </section>
  </div>
</template>

<style scoped>
.calendar {
  max-width: var(--maxw);
  margin: 0 auto;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-sm);
}

.nav-arrow {
  font-size: 15px;
  line-height: 1;
  font-weight: 700;
}

.month-nav__label {
  min-width: 108px;
  height: 28px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 650;
}

.month-nav__label:hover {
  background: var(--chip);
}

.cal-grid {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 16px;
  margin-bottom: 16px;
}

.cal-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.cal-body {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
  align-items: start;
}

.cal-list {
  display: flex;
  flex-direction: column;
}

.cal-item {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
}

.cal-list li:last-child .cal-item {
  border-bottom: none;
}

.cal-item:hover .cal-item__title {
  color: var(--brand);
}

.cal-item__date {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.cal-item__date b {
  font-size: 12.5px;
  font-weight: 650;
}

.cal-item__date small {
  font-size: 10.5px;
  color: var(--text-3);
}

.cal-item__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cal-item__title {
  font-size: 13px;
  font-weight: 550;
}

.cal-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.chip--tiny {
  height: 18px;
  padding: 0 6px;
  font-size: 10px;
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

@media (max-width: 1100px) {
  .cal-grid,
  .cal-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .cal-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
