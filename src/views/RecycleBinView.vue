<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import AmountText from '@/components/ui/AmountText.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useI18n } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { hasCustomTitle, toRowUi, type SessionRowUi } from '@/domain/sessionView'
import { dateOfKey, dateTime, dayKeyOf } from '@/domain/uiText'
import type { TimeSlot } from '@/domain/timeSlot'

const { t, locale } = useI18n()
const { show, error: showError } = useToast()
const store = useDataStore()

interface BinRowData {
  id: string
  deletedAt: number
  ui: SessionRowUi
}

/** 回收站列表：已按 deletedAt 倒序，行数据复用场次列表的 toRowUi。 */
const rows = computed<BinRowData[]>(() =>
  store.trashWithResults.map((item) => ({
    id: item.session.id,
    deletedAt: item.session.deletedAt ?? item.session.updatedAt,
    ui: toRowUi(item),
  })),
)

const hasTitleColumn = computed(() => rows.value.some((row) => hasCustomTitle(row.ui)))

// 表头与计数没有对应的文案 key，按界面语言提供一组短标签。
const headers = computed(() => {
  const zh = locale.value === 'zh-CN'
  return {
    deletedAt: zh ? '删除时间' : 'Deleted at',
    date: zh ? '日期 / 时段' : 'Date / slot',
    title: t('session_title_label'),
    players: t('nav_friends'),
    net: zh ? '本人净额' : 'My net',
    actions: zh ? '操作' : 'Actions',
  }
})

const tableTitle = computed(() => (locale.value === 'zh-CN' ? '待清理场次' : 'Sessions in the bin'))
const countLabel = computed(() => {
  const count = rows.value.length
  if (locale.value === 'zh-CN') return `${count} 场`
  return `${count} ${count === 1 ? 'session' : 'sessions'}`
})

function slotLabel(slot: TimeSlot): string {
  if (slot === 'MORNING') return t('time_slot_morning')
  if (slot === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

function playersText(row: SessionRowUi): string {
  return row.opponentNames.length > 0 ? row.opponentNames.join(' · ') : t('common_unavailable')
}

// ————————————————————— 还原 / 彻底删除 —————————————————————

function restore(id: string): void {
  const result = store.restoreSession(id)
  if (result.ok) {
    show(t('bin_restore_success'))
    return
  }
  showError(result.error === 'SESSION_LIMIT_REACHED' ? t('error_session_limit_reached') : t('bin_purge_failed'))
}

const purgeTarget = ref<BinRowData | null>(null)

const purgeLabel = computed(() => {
  const target = purgeTarget.value
  if (!target) return ''
  const date = dateOfKey(dayKeyOf(target.ui.playedAt))
  const slot = slotLabel(target.ui.timeSlot)
  return hasCustomTitle(target.ui) ? `${date} · ${slot} · ${target.ui.title}` : `${date} · ${slot}`
})

function confirmPurge(): void {
  const target = purgeTarget.value
  purgeTarget.value = null
  if (!target) return
  const result = store.purgeSessions([target.id])
  if (result.ok) show(t('bin_purge_success'))
  else showError(t('bin_purge_failed'))
}

// ————————————————————— 清空回收站 —————————————————————

const emptyOpen = ref(false)

function confirmEmpty(): void {
  const result = store.emptyTrash()
  emptyOpen.value = false
  if (result.ok) show(t('bin_empty_success_format', [result.value]))
  else showError(t('bin_purge_failed'))
}
</script>

<template>
  <div class="bin">
    <PageHeader
      back-to="/settings"
      :back-label="t('action_back')"
      :title="t('bin_title')"
      :subtitle="t('bin_retention_note')"
    >
      <template #actions>
        <button
          class="btn btn--danger"
          type="button"
          :disabled="rows.length === 0"
          @click="emptyOpen = true"
        >
          <AppIcon name="trash" :size="15" />
          {{ t('bin_empty_action') }}
        </button>
      </template>
    </PageHeader>

    <Panel v-if="rows.length === 0">
      <EmptyState :title="t('bin_empty_title')" :desc="t('bin_empty_desc')" icon="restore">
        <RouterLink to="/sessions" class="btn btn--primary">
          <AppIcon name="list" :size="15" />
          {{ t('nav_sessions') }}
        </RouterLink>
      </EmptyState>
    </Panel>

    <Panel v-else>
      <template #title>
        <AppIcon name="trash" :size="15" />
        {{ tableTitle }}
      </template>
      <template #actions>
        <span class="chip num">{{ countLabel }}</span>
      </template>

      <div class="table-wrap">
        <table class="data bin-table">
          <thead>
            <tr>
              <th scope="col">{{ headers.deletedAt }}</th>
              <th scope="col">{{ headers.date }}</th>
              <th v-if="hasTitleColumn" scope="col">{{ headers.title }}</th>
              <th scope="col">{{ headers.players }}</th>
              <th scope="col" class="num">{{ headers.net }}</th>
              <th scope="col">{{ headers.actions }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <span class="deleted-at num">{{ dateTime(row.deletedAt) }}</span>
              </td>
              <td>
                <div class="date-cell">
                  <span class="date-cell__date num">{{ dateOfKey(dayKeyOf(row.ui.playedAt)) }}</span>
                  <span class="chip chip--compact" :class="`slot--${row.ui.timeSlot.toLowerCase()}`">
                    {{ slotLabel(row.ui.timeSlot) }}
                  </span>
                </div>
              </td>
              <td v-if="hasTitleColumn">
                <span v-if="hasCustomTitle(row.ui)" class="cell-title truncate" :title="row.ui.title">
                  {{ row.ui.title }}
                </span>
                <span v-else class="faint">{{ t('common_unavailable') }}</span>
              </td>
              <td>
                <span class="cell-players truncate" :title="playersText(row.ui)">{{ playersText(row.ui) }}</span>
              </td>
              <td class="num">
                <AmountText :minor="row.ui.selfNetMinor" size="md" />
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn--sm btn--ghost" type="button" @click="restore(row.id)">
                    <AppIcon name="restore" :size="13" />
                    {{ t('bin_restore_action') }}
                  </button>
                  <button class="btn btn--sm btn--danger" type="button" @click="purgeTarget = row">
                    <AppIcon name="trash" :size="13" />
                    {{ t('bin_purge_action') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>

    <!-- 彻底删除单场 -->
    <ConfirmDialog
      :open="purgeTarget !== null"
      :title="t('bin_purge_confirm_title')"
      :confirm-text="t('bin_purge_action')"
      :cancel-text="t('action_cancel')"
      tone="danger"
      @close="purgeTarget = null"
      @confirm="confirmPurge"
    >
      <p>{{ t('bin_purge_confirm_message') }}</p>
      <p v-if="purgeLabel" class="confirm-context">{{ purgeLabel }}</p>
    </ConfirmDialog>

    <!-- 清空回收站 -->
    <ConfirmDialog
      :open="emptyOpen"
      :title="t('bin_empty_confirm_title')"
      :confirm-text="t('bin_empty_action')"
      :cancel-text="t('action_cancel')"
      tone="danger"
      @close="emptyOpen = false"
      @confirm="confirmEmpty"
    >
      <p>{{ t('bin_empty_confirm_message', [rows.length]) }}</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.bin {
  max-width: var(--maxw);
  margin: 0 auto;
}

.bin-table {
  min-width: 720px;
}

.deleted-at {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.date-cell {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.date-cell__date {
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.chip--compact {
  height: 20px;
  padding: 0 7px;
  font-size: 10.5px;
}

.slot--morning {
  background: var(--draw-container);
  color: var(--on-draw-container);
}

.slot--afternoon {
  background: var(--loss-container);
  color: var(--on-loss-container);
}

.slot--evening {
  background: var(--brand-container);
  color: var(--on-brand-container);
}

.cell-title,
.cell-players {
  display: inline-block;
  max-width: 200px;
  vertical-align: middle;
  font-size: 12.5px;
  color: var(--text-2);
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  white-space: nowrap;
}

.bin-table th:last-child,
.bin-table td:last-child {
  text-align: right;
}

.confirm-context {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  font-size: 12.5px;
  color: var(--text-2);
}

@media (max-width: 900px) {
  .bin-table {
    min-width: 680px;
  }
}
</style>
