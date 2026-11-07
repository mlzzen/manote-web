<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import HeroStat from '@/components/ui/HeroStat.vue'
import AmountText from '@/components/ui/AmountText.vue'
import ResultBadge from '@/components/ui/ResultBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { toDetailUi } from '@/domain/sessionView'
import { formatHours } from '@/domain/sessionDuration'
import { SEAT_SELF } from '@/domain/sessionRules'
import type { TimeSlot } from '@/domain/timeSlot'
import { dateTime, sessionClockRange } from '@/domain/uiText'
import { buildSessionCsv, sessionCsvFileName } from '@/data/csv'
import { downloadText } from '@/data/fileTransfer'

const { t } = useI18n()
const { show } = useToast()
const store = useDataStore()
const route = useRoute()
const router = useRouter()

const sessionId = computed(() => String(route.params.id ?? ''))
const raw = computed(() => store.sessionWithResults(sessionId.value))
const session = computed(() => (raw.value && raw.value.session.deletedAt === null ? raw.value : null))
const detail = computed(() => (session.value ? toDetailUi(session.value) : null))
const selfNet = computed(() => detail.value?.seats.find((it) => it.seat === SEAT_SELF)?.netMinor ?? null)

const confirmDelete = ref(false)

function slotLabel(slot: TimeSlot): string {
  if (slot === 'MORNING') return t('time_slot_morning')
  if (slot === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

function seatName(seat: number): string {
  if (seat === 0) return t('seat_self')
  if (seat === 1) return t('seat_upper')
  if (seat === 2) return t('seat_opposite')
  return t('seat_lower')
}

function remove(): void {
  const result = store.moveSessionsToTrash([sessionId.value])
  confirmDelete.value = false
  if (result.ok) {
    show(t('sessions_delete_done_format', [result.value]))
    router.push('/sessions')
  }
}

function exportCsv(): void {
  if (!session.value) return
  const csv = buildSessionCsv(session.value)
  if (!csv) {
    show(t('csv_export_failed'))
    return
  }
  downloadText(csv, sessionCsvFileName(session.value), 'text/csv;charset=utf-8')
  show(t('csv_export_success'))
}
</script>

<template>
  <div class="detail">
    <template v-if="detail">
      <PageHeader
        :title="detail.title"
        :subtitle="`${t('detail_title')} · ${dateTime(detail.playedAt)}`"
        back-to="/sessions"
      >
        <template #actions>
          <button class="btn btn--ghost" type="button" @click="exportCsv">
            <AppIcon name="download" :size="14" />
            {{ t('detail_action_export_csv') }}
          </button>
          <RouterLink :to="`/sessions/${detail.id}/edit`" class="btn btn--ghost">
            <AppIcon name="edit" :size="14" />
            {{ t('detail_action_edit') }}
          </RouterLink>
          <button class="btn btn--danger" type="button" @click="confirmDelete = true">
            <AppIcon name="trash" :size="14" />
            {{ t('detail_action_delete') }}
          </button>
        </template>
      </PageHeader>

      <div class="detail-grid">
        <div class="detail-col">
          <HeroStat
            :label="t('detail_self_net_label')"
            :minor="selfNet"
            :caption="slotLabel(detail.timeSlot)"
          >
            <span class="hero-chip">{{ t('sessions_month_count_format', [detail.seats.length]) }}</span>
            <span class="hero-chip">{{ formatHours(detail.durationMinutes) }} {{ t('session_duration_unit') }}</span>
            <span class="hero-chip">
              {{ t('session_total_label') }}
              <b>{{ detail.totalMinor === 0 ? '0.00' : (detail.totalMinor / 100).toFixed(2) }}</b>
            </span>
          </HeroStat>

          <Panel :title="t('detail_title')">
            <table class="data seats">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ t('session_title_label') }}</th>
                  <th class="num">{{ t('detail_self_net_label') }}</th>
                  <th>{{ t('sessions_filter_section_result') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="seat in detail.seats" :key="seat.seat">
                  <td class="seat-rank">
                    <span class="rank-badge num" :class="{ 'rank-badge--first': seat.rank === 1 }">
                      {{ seat.rank }}
                    </span>
                  </td>
                  <td>
                    <span class="seat-name">{{ seat.nickname }}</span>
                    <span class="seat-pos">{{ seatName(seat.seat) }}</span>
                  </td>
                  <td class="num">
                    <AmountText :minor="seat.netMinor" size="md" />
                  </td>
                  <td><ResultBadge :minor="seat.netMinor" compact /></td>
                </tr>
              </tbody>
            </table>
            <p v-if="detail.seats.length < 4" class="panel__note">
              {{ t('detail_partial_seats_format', [detail.seats.length]) }}
            </p>
          </Panel>

          <Panel :title="t('detail_settlement_title')">
            <template #actions>
              <span v-if="detail.balanced" class="chip chip--brand">{{ t('detail_settlement_hint') }}</span>
            </template>
            <template v-if="detail.balanced">
              <ul v-if="detail.transfers.length > 0" class="transfers">
                <li v-for="(transfer, index) in detail.transfers" :key="index" class="transfer">
                  <span class="transfer__from">{{ detail.seats.find((s) => s.seat === transfer.fromSeat)?.nickname }}</span>
                  <AppIcon name="chevron-right" :size="14" class="faint" />
                  <span class="transfer__to">{{ detail.seats.find((s) => s.seat === transfer.toSeat)?.nickname }}</span>
                  <AmountText :minor="transfer.amountMinor" size="md" class="transfer__amount" />
                </li>
              </ul>
              <p v-else class="faint" style="font-size: 12.5px">{{ t('detail_no_settlement') }}</p>
              <p class="panel__note">{{ t('detail_settlement_hint') }}</p>
            </template>
            <div v-else class="alert">
              <AppIcon name="alert" :size="15" />
              {{ t('detail_unbalanced_format', [(detail.totalMinor / 100).toFixed(2)]) }}
            </div>
          </Panel>
        </div>

        <div class="detail-col">
          <Panel :title="t('session_played_at')">
            <dl class="meta">
              <div>
                <dt>{{ t('session_played_at') }}</dt>
                <dd class="num">{{ dateTime(detail.playedAt) }}</dd>
              </div>
              <div>
                <dt>{{ t('session_duration_label') }}</dt>
                <dd class="num">
                  {{ sessionClockRange(detail.startedAt, detail.playedAt) }}
                  <span class="faint">· {{ formatHours(detail.durationMinutes) }} {{ t('session_duration_unit') }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t('sessions_filter_section_time_slot') }}</dt>
                <dd>
                  <span class="chip" :class="`chip--slot-${detail.timeSlot.toLowerCase()}`">
                    {{ slotLabel(detail.timeSlot) }}
                  </span>
                </dd>
              </div>
              <div v-if="detail.note">
                <dt>{{ t('detail_note_label') }}</dt>
                <dd class="meta__note">{{ detail.note }}</dd>
              </div>
            </dl>
          </Panel>

          <Panel :title="t('detail_self_net_label')">
            <div class="self-net">
              <AmountText :minor="selfNet" size="xl" />
              <ResultBadge :minor="selfNet ?? 0" />
            </div>
            <div class="divider" />
            <ul class="self-list">
              <li v-for="seat in detail.seats" :key="seat.seat">
                <span class="truncate">{{ seat.nickname }}</span>
                <AmountText :minor="seat.netMinor" size="sm" />
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </template>

    <EmptyState
      v-else
      :title="t('detail_missing_title')"
      :desc="t('detail_missing_desc')"
      icon="alert"
    >
      <RouterLink to="/sessions" class="btn btn--primary">{{ t('nav_sessions') }}</RouterLink>
    </EmptyState>

    <ConfirmDialog
      :open="confirmDelete"
      :title="t('detail_delete_title')"
      :confirm-text="t('detail_delete_confirm')"
      :cancel-text="t('action_cancel')"
      tone="danger"
      @close="confirmDelete = false"
      @confirm="remove"
    >
      {{ t('detail_delete_message') }}
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.detail {
  max-width: var(--maxw);
  margin: 0 auto;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: 16px;
  align-items: start;
}

.detail-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.seat-rank {
  width: 46px;
}

.rank-badge {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--chip);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-2);
}

.rank-badge--first {
  background: var(--gold-container);
  color: var(--on-gold-container);
}

.seat-name {
  font-weight: 600;
  font-size: 13.5px;
}

.seat-pos {
  margin-left: 8px;
  font-size: 11px;
  color: var(--text-3);
}

.transfers {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.transfer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  font-size: 13px;
}

.transfer__from {
  color: var(--win);
  font-weight: 600;
}

.transfer__to {
  color: var(--loss);
  font-weight: 600;
}

.transfer__amount {
  margin-left: auto;
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

.meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.meta dt {
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 2px;
}

.meta dd {
  margin: 0;
  font-size: 13px;
  font-weight: 550;
}

.meta__note {
  font-weight: 400 !important;
  font-size: 12.5px !important;
  color: var(--text-2);
  line-height: 1.6;
  white-space: pre-wrap;
}

.self-net {
  display: flex;
  align-items: center;
  gap: 12px;
}

.self-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
}

.self-list li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-2);
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
