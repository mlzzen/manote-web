<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import HeroStat from '@/components/ui/HeroStat.vue'
import StatTile from '@/components/ui/StatTile.vue'
import AmountText from '@/components/ui/AmountText.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import TrendChart from '@/components/charts/TrendChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import MonthHeatmap from '@/components/charts/MonthHeatmap.vue'
import SlotBars from '@/components/charts/SlotBars.vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { cumulativeTrend } from '@/domain/trend'
import { streaksOf } from '@/domain/streak'
import { extremesOf } from '@/domain/sessionExtremes'
import { monthSummaryOf, yearMonthKey, monthNetMinor, monthWinRatePercent } from '@/domain/monthSummary'
import {
  averageNetMinor,
  netMinorOf,
  statisticsOf,
  timeSlotStatisticsOf,
  winRatePercent,
} from '@/domain/statistics'
import { TIME_SLOT_DISPLAY_ORDER, type TimeSlot } from '@/domain/timeSlot'
import { dayKeyOf, monthDayOfKey, signedYuan } from '@/domain/uiText'
import { createSampleData } from '@/data/sample'
import type { SessionRowUi } from '@/domain/sessionView'

const { t, locale } = useI18n()
const { show } = useToast()
const store = useDataStore()
const router = useRouter()

const stats = computed(() => store.selfStatistics)
const nets = computed(() => store.selfDatedNets)
const hasSessions = computed(() => nets.value.length > 0)

const trend = computed(() => cumulativeTrend(nets.value))
const streaks = computed(() => streaksOf(nets.value))
const extremes = computed(() => extremesOf(nets.value))

const netTotal = computed(() => netMinorOf(stats.value))
const winRate = computed(() => winRatePercent(stats.value))
const average = computed(() => averageNetMinor(stats.value))
const netWins = computed(() => stats.value.winCount - stats.value.lossCount)

const last10 = computed(() => nets.value.slice(-10))
const last10Sum = computed(() => last10.value.reduce((sum, it) => sum + it.netMinor, 0))
const last10Record = computed(() => {
  let win = 0
  let loss = 0
  let draw = 0
  for (const item of last10.value) {
    if (item.netMinor > 0) win++
    else if (item.netMinor < 0) loss++
    else draw++
  }
  return { win, loss, draw }
})

const thisMonth = computed(() => yearMonthKey(Date.now()))
const month = computed(() => monthSummaryOf(nets.value, thisMonth.value))

function slotLabel(slot: TimeSlot): string {
  if (slot === 'MORNING') return t('time_slot_morning')
  if (slot === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

function slotOfRow(row: SessionRowUi): TimeSlot {
  return row.timeSlot
}

const slotItems = computed(() => {
  const bySlot = new Map<TimeSlot, number[]>()
  for (const row of store.sessionRows) {
    const list = bySlot.get(slotOfRow(row))
    if (list) list.push(row.selfNetMinor)
    else bySlot.set(slotOfRow(row), [row.selfNetMinor])
  }
  const statistics = timeSlotStatisticsOf(bySlot)
  return TIME_SLOT_DISPLAY_ORDER.map((slot) => {
    const entry = statistics.find((it) => it.slot === slot)
    const stat = entry?.statistics ?? statisticsOf([])
    return {
      key: slot,
      label: slotLabel(slot),
      netMinor: netMinorOf(stat),
      sessionCount: stat.sessionCount,
      winRate: winRatePercent(stat),
    }
  })
})

const topFriends = computed(() =>
  store.friends
    .map((friend) => {
      const aggregate = store.aggregates.get(friend.id)
      return {
        id: friend.id,
        nickname: friend.nickname,
        sessionCount: aggregate?.sessionCount ?? 0,
        netMinor: aggregate?.netMinor ?? 0,
        badges: store.friendBadges.get(friend.id) ?? new Set<string>(),
      }
    })
    .filter((it) => it.sessionCount > 0)
    .sort((a, b) => b.netMinor - a.netMinor)
    .slice(0, 5),
)

const recent = computed(() => store.sessionRows.slice(0, 6))

function loadSample(): void {
  const sample = createSampleData()
  const result = store.replaceAll(sample)
  if (result.ok) show(t('sample_loaded'))
}

function openDay(dayKey: string): void {
  router.push({ path: '/calendar', query: { month: dayKey.slice(0, 7), day: dayKey } })
}
</script>

<template>
  <div class="dash">
    <PageHeader :title="t('nav_home')" :subtitle="t('home_overview_title')">
      <template #actions>
        <RouterLink to="/sessions" class="btn btn--ghost">
          {{ t('action_view_all') }}
          <AppIcon name="chevron-right" :size="14" />
        </RouterLink>
        <RouterLink to="/sessions/new" class="btn btn--primary">
          <AppIcon name="plus" :size="15" :stroke-width="2.2" />
          {{ t('action_record_session') }}
        </RouterLink>
      </template>
    </PageHeader>

    <EmptyState
      v-if="!hasSessions"
      :title="t('home_empty_title')"
      :desc="t('home_empty_desc')"
      icon="sparkles"
      class="onboarding"
    >
      <div class="row" style="gap: 10px">
        <RouterLink to="/sessions/new" class="btn btn--primary btn--lg">
          <AppIcon name="plus" :size="16" :stroke-width="2.2" />
          {{ t('action_record_session') }}
        </RouterLink>
        <button class="btn btn--ghost btn--lg" type="button" @click="loadSample">
          <AppIcon name="sparkles" :size="16" />
          {{ t('sample_load_action') }}
        </button>
      </div>
    </EmptyState>

    <template v-else>
      <!-- 第一行：累计净输赢 + 四个读数 -->
      <section class="grid grid--row1">
        <HeroStat
          :label="t('home_stat_net')"
          :minor="netTotal"
          :caption="locale === 'zh-CN' ? '全部时间' : 'All time'"
        >
          <span class="hero-chip">{{ t('home_hero_sessions_format', [stats.sessionCount]) }}</span>
          <span class="hero-chip">{{ t('home_stat_win_rate') }} <b>{{ winRate }}%</b></span>
          <span class="hero-chip">{{ t('home_stat_net_wins') }} <b>{{ netWins > 0 ? `+${netWins}` : netWins }}</b></span>
        </HeroStat>

        <div class="tiles">
          <StatTile
            :label="t('home_slot_count')"
            :value="String(stats.sessionCount)"
            :hint="`${t('result_win')} ${stats.winCount} · ${t('result_loss')} ${stats.lossCount} · ${t('result_draw')} ${stats.drawCount}`"
            icon="list"
          />
          <StatTile
            :label="t('home_stat_win_rate')"
            :value="`${winRate}%`"
            :hint="t('home_slot_count_format', [stats.winCount])"
            icon="target"
            tone="draw"
          />
          <StatTile
            :label="t('stat_average')"
            :value="signedYuan(average)"
            :hint="t('home_stat_net')"
            icon="chart"
            :tone="average > 0 ? 'win' : average < 0 ? 'loss' : 'draw'"
          />
          <StatTile
            :label="t('stat_best_win')"
            :value="extremes.bestWin ? signedYuan(extremes.bestWin.netMinor) : '—'"
            :hint="extremes.bestWin ? monthDayOfKey(dayKeyOf(extremes.bestWin.playedAt)) : t('common_unavailable')"
            icon="arrow-up"
            tone="win"
          />
        </div>
      </section>

      <!-- 第二行：累计曲线 + 胜负分布 -->
      <section class="grid grid--row2">
        <Panel :title="t('home_trend_title')">
          <template #actions>
            <span class="chip">{{ t('trend_latest') }} {{ signedYuan(netTotal) }}</span>
          </template>
          <TrendChart :points="trend" :height="236" />
          <p class="panel__note">{{ t('home_trend_note') }}</p>
        </Panel>

        <Panel :title="t('home_slot_title')">
          <div class="dist">
            <DonutChart
              :win="stats.winCount"
              :loss="stats.lossCount"
              :draw="stats.drawCount"
              :center-value="String(stats.sessionCount)"
              :center-label="t('home_slot_count')"
            />
            <ul class="legend">
              <li>
                <span class="legend__dot" style="background: var(--win)" />
                <span class="legend__label">{{ t('result_win') }}</span>
                <span class="legend__value num">{{ stats.winCount }}</span>
                <AmountText :minor="stats.winMinor" size="sm" class="legend__amount" />
              </li>
              <li>
                <span class="legend__dot" style="background: var(--loss)" />
                <span class="legend__label">{{ t('result_loss') }}</span>
                <span class="legend__value num">{{ stats.lossCount }}</span>
                <AmountText :minor="-stats.lossMinor" size="sm" class="legend__amount" />
              </li>
              <li>
                <span class="legend__dot" style="background: var(--draw)" />
                <span class="legend__label">{{ t('result_draw') }}</span>
                <span class="legend__value num">{{ stats.drawCount }}</span>
                <span class="legend__amount faint">{{ t('common_unavailable') }}</span>
              </li>
            </ul>
          </div>
          <div class="extremes">
            <div class="extremes__item">
              <span class="extremes__label">{{ t('stat_worst_loss') }}</span>
              <AmountText :minor="extremes.worstLoss ? extremes.worstLoss.netMinor : null" size="md" />
            </div>
            <div class="extremes__item">
              <span class="extremes__label">{{ t('home_streak_current_win') }}</span>
              <span class="extremes__value num">{{ streaks.currentWinStreak }}</span>
            </div>
          </div>
        </Panel>
      </section>

      <!-- 第三行：近 10 场 + 分时段 + 连输连赢 -->
      <section class="grid grid--row3">
        <Panel :title="t('home_bar_title')">
          <template #actions>
            <span class="chip chip--outline">{{ t('home_bar_sum') }} {{ signedYuan(last10Sum) }}</span>
          </template>
          <BarChart :items="last10" :height="164" />
          <div class="bar-foot">
            <span class="faint">{{ t('home_bar_record') }}</span>
            <span class="num bar-foot__record">
              {{ t('home_bar_record_value', [last10Record.win, last10Record.loss, last10Record.draw]) }}
            </span>
          </div>
        </Panel>

        <Panel :title="t('home_slot_title')">
          <SlotBars :items="slotItems" />
          <p class="panel__note">{{ t('home_slot_count') }} · {{ t('home_stat_win_rate') }}</p>
        </Panel>

        <Panel :title="t('home_streak_title')">
          <ul class="streaks">
            <li>
              <span class="streaks__label">{{ t('home_streak_current_win') }}</span>
              <span class="streaks__value num win">{{ streaks.currentWinStreak }}</span>
            </li>
            <li>
              <span class="streaks__label">{{ t('home_streak_current_loss') }}</span>
              <span class="streaks__value num loss">{{ streaks.currentLossStreak }}</span>
            </li>
            <li>
              <span class="streaks__label">{{ t('home_streak_longest_win') }}</span>
              <span class="streaks__value num">{{ streaks.longestWinStreak }}</span>
            </li>
            <li>
              <span class="streaks__label">{{ t('home_streak_longest_loss') }}</span>
              <span class="streaks__value num">{{ streaks.longestLossStreak }}</span>
            </li>
          </ul>
          <div class="divider" />
          <div class="day-pair">
            <div>
              <span class="faint">{{ t('home_streak_best_day') }}</span>
              <p class="num" :class="(streaks.bestDay?.netMinor ?? 0) >= 0 ? 'loss' : 'win'">
                {{ streaks.bestDay ? signedYuan(streaks.bestDay.netMinor) : '—' }}
              </p>
              <span class="faint">{{ streaks.bestDay ? monthDayOfKey(streaks.bestDay.day) : '' }}</span>
            </div>
            <div>
              <span class="faint">{{ t('home_streak_worst_day') }}</span>
              <p class="num" :class="(streaks.worstDay?.netMinor ?? 0) > 0 ? 'loss' : 'win'">
                {{ streaks.worstDay ? signedYuan(streaks.worstDay.netMinor) : '—' }}
              </p>
              <span class="faint">{{ streaks.worstDay ? monthDayOfKey(streaks.worstDay.day) : '' }}</span>
            </div>
          </div>
        </Panel>
      </section>

      <!-- 第四行：本月日历 + 牌友排行 + 最近场次 -->
      <section class="grid grid--row4">
        <Panel :title="t('home_calendar_title')">
          <template #actions>
            <RouterLink to="/calendar" class="chip chip--brand">
              {{ t('home_calendar_open') }}
              <AppIcon name="chevron-right" :size="12" />
            </RouterLink>
          </template>
          <MonthHeatmap
            :year-month="thisMonth"
            :days="month.days"
            compact
            @select="openDay"
          />
          <div class="month-stats">
            <div>
              <span class="faint">{{ t('home_calendar_sessions') }}</span>
              <p class="num">{{ month.statistics.sessionCount }}</p>
            </div>
            <div>
              <span class="faint">{{ t('home_calendar_win_rate') }}</span>
              <p class="num">{{ monthWinRatePercent(month) }}%</p>
            </div>
            <div>
              <span class="faint">{{ t('home_calendar_net') }}</span>
              <p class="num" :class="monthNetMinor(month) > 0 ? 'loss' : monthNetMinor(month) < 0 ? 'win' : 'draw'">
                {{ signedYuan(monthNetMinor(month)) }}
              </p>
            </div>
          </div>
        </Panel>

        <Panel :title="t('nav_friends')">
          <template #actions>
            <RouterLink to="/friends" class="chip chip--outline">{{ t('action_view_all') }}</RouterLink>
          </template>
          <ul class="rank">
            <li v-for="(friend, index) in topFriends" :key="friend.id" class="rank__row">
              <span class="rank__index num" :class="{ 'rank__index--top': index === 0 }">{{ index + 1 }}</span>
              <RouterLink :to="`/friends/${friend.id}`" class="rank__name truncate">{{ friend.nickname }}</RouterLink>
              <span class="chip chip--compact">{{ t('friends_stat_format', [friend.sessionCount]) }}</span>
              <AmountText :minor="friend.netMinor" size="sm" class="rank__amount" />
            </li>
          </ul>
          <p v-if="topFriends.length === 0" class="faint" style="font-size: 12px">{{ t('friends_empty_title') }}</p>
        </Panel>

        <Panel :title="t('home_recent_title')">
          <template #actions>
            <RouterLink to="/sessions" class="chip chip--outline">{{ t('action_view_all') }}</RouterLink>
          </template>
          <ul class="recent">
            <li v-for="row in recent" :key="row.id">
              <RouterLink :to="`/sessions/${row.id}`" class="recent__row">
                <span class="recent__date num">{{ monthDayOfKey(dayKeyOf(row.playedAt)) }}</span>
                <span class="recent__names truncate">{{ row.opponentNames.join(' · ') || t('session_seat_not_recorded', [t('seat_self')]) }}</span>
                <AmountText :minor="row.selfNetMinor" size="sm" />
              </RouterLink>
            </li>
          </ul>
          <p v-if="recent.length === 0" class="faint" style="font-size: 12px">{{ t('home_empty_title') }}</p>
        </Panel>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dash {
  max-width: var(--maxw);
  margin: 0 auto;
}

.onboarding {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 64px 24px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.grid--row1 {
  grid-template-rows: auto;
}

.grid--row1 > :first-child {
  grid-column: span 5;
}

.grid--row2 > :first-child {
  grid-column: span 8;
}

.grid--row2 > :last-child {
  grid-column: span 4;
}

.grid--row3 > :first-child {
  grid-column: span 5;
}

.grid--row3 > :nth-child(2) {
  grid-column: span 4;
}

.grid--row3 > :last-child {
  grid-column: span 3;
}

.grid--row4 > * {
  grid-column: span 4;
}

.tiles {
  grid-column: span 7;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.dist {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 150px;
}

.legend li {
  display: grid;
  grid-template-columns: 8px 1fr auto auto;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}

.legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 3px;
}

.legend__label {
  color: var(--text-2);
}

.legend__value {
  font-weight: 650;
}

.legend__amount {
  min-width: 74px;
  text-align: right;
}

.extremes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.extremes__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.extremes__label {
  font-size: 11px;
  color: var(--text-3);
}

.extremes__value {
  font-size: 18px;
  font-weight: 700;
}

.bar-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  border-top: 1px solid var(--border);
  padding-top: 9px;
}

.bar-foot__record {
  font-weight: 650;
}

.streaks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
}

.streaks li {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.streaks__label {
  font-size: 10.5px;
  color: var(--text-3);
  line-height: 1.35;
}

.streaks__value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.day-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  font-size: 11px;
}

.day-pair p {
  font-size: 14px;
  font-weight: 650;
  margin: 1px 0;
}

.month-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  font-size: 11px;
}

.month-stats p {
  font-size: 15px;
  font-weight: 700;
  margin-top: 1px;
}

.rank {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rank__row {
  display: grid;
  grid-template-columns: 20px 1fr auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  font-size: 13px;
}

.rank__row:last-child {
  border-bottom: none;
}

.rank__index {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  background: var(--chip);
}

.rank__index--top {
  background: var(--gold-container);
  color: var(--on-gold-container);
}

.rank__name {
  font-weight: 550;
}

.rank__name:hover {
  color: var(--brand);
}

.rank__amount {
  min-width: 72px;
  text-align: right;
}

.chip--compact {
  height: 20px;
  padding: 0 7px;
  font-size: 10.5px;
}

.recent {
  display: flex;
  flex-direction: column;
}

.recent__row {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  font-size: 12.5px;
}

.recent li:last-child .recent__row {
  border-bottom: none;
}

.recent__row:hover {
  color: var(--brand);
}

.recent__date {
  color: var(--text-3);
  font-size: 11.5px;
}

.recent__names {
  color: var(--text-2);
}

@media (max-width: 1280px) {
  .grid--row1 > :first-child,
  .tiles {
    grid-column: span 12;
  }

  .grid--row2 > :first-child,
  .grid--row2 > :last-child {
    grid-column: span 12;
  }

  .grid--row3 > * {
    grid-column: span 6;
  }

  .grid--row3 > :last-child {
    grid-column: span 12;
  }

  .grid--row4 > * {
    grid-column: span 6;
  }
}

@media (max-width: 900px) {
  .grid--row3 > *,
  .grid--row4 > * {
    grid-column: span 12;
  }

  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
