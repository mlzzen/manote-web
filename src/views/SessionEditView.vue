<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useI18n } from '@/i18n'
import { errorKey } from '@/i18n/errors'
import { useToast } from '@/composables/useToast'
import { useDataStore } from '@/stores/data'
import { newId } from '@/domain/id'
import { parseAmount, type AmountParseFailure } from '@/domain/amountParser'
import { parseDuration, type DurationParseFailure } from '@/domain/durationParser'
import {
  DEFAULT_MINUTES,
  MAX_MINUTES,
  MINUTES_PER_HOUR,
  formatHours,
  midpointAt,
} from '@/domain/sessionDuration'
import { SEAT_COUNT, SEAT_SELF, textLength } from '@/domain/sessionRules'
import { signedMinor } from '@/domain/sessionValidator'
import { timeSlotOf, type TimeSlot } from '@/domain/timeSlot'
import {
  combineDateAndTime,
  dayKeyOf,
  monthDay,
  sessionClockRange,
  timeOfDay,
} from '@/domain/uiText'
import type { SeatResultInput } from '@/stores/data'

const { t } = useI18n()
const { show, error: toastError } = useToast()
const store = useDataStore()
const route = useRoute()
const router = useRouter()

// 「修改」与「新建」共用同一个表单：有 id 参数就是修改，没有就是新建。
// 不依赖路由名——路由表改名不该悄悄把编辑表单退回成新建。
const editingId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.length > 0 ? id : ''
})
const isEditing = computed(() => editingId.value !== '')

const existing = computed(() => (isEditing.value ? store.sessionWithResults(editingId.value) : null))
const existingDetail = computed(() => existing.value?.session ?? null)

interface SeatForm {
  seat: number
  playerId: string | null
  recorded: boolean
  isWin: boolean
  amountText: string
}

const draftId = ref(newId())
const playedDay = ref(dayKeyOf(Date.now()))
const playedTime = ref(timeOfDay(Date.now()))
const durationText = ref(String(DEFAULT_MINUTES / MINUTES_PER_HOUR))
const titleText = ref('')
const noteText = ref('')
const saving = ref(false)
const confirmSave = ref(false)
const confirmDiscard = ref(false)
const createFriendFor = ref<number | null>(null)
const newFriendName = ref('')
const newFriendNote = ref('')

const seats = reactive<SeatForm[]>(
  Array.from({ length: SEAT_COUNT }, (_, seat) => ({
    seat,
    playerId: null,
    recorded: seat === SEAT_SELF,
    isWin: true,
    amountText: '',
  })),
)

const selfPlayer = computed(() => store.self)
const activeFriends = computed(() => store.activeFriends)

onMounted(() => {
  if (!isEditing.value) {
    // 新建：结束时间取当前时刻，秒与秒以下抹掉，避免「刚打开就比现在晚」的抖动
    const now = new Date()
    now.setSeconds(0, 0)
    playedDay.value = dayKeyOf(now.getTime())
    playedTime.value = timeOfDay(now.getTime())
    if (selfPlayer.value) seats[SEAT_SELF].playerId = selfPlayer.value.id
    return
  }

  const detail = existingDetail.value
  if (!detail) return
  draftId.value = detail.id
  playedDay.value = dayKeyOf(detail.playedAt)
  playedTime.value = timeOfDay(detail.playedAt)
  durationText.value = formatHours(detail.durationMinutes)
  titleText.value = detail.title
  noteText.value = detail.note

  const results = existing.value?.results ?? []
  for (const form of seats) {
    const result = results.find((it) => it.seat === form.seat)
    if (!result) {
      form.recorded = false
      continue
    }
    form.recorded = true
    form.playerId = result.playerId
    form.isWin = result.netMinor >= 0
    form.amountText = (Math.abs(result.netMinor) / 100).toFixed(2)
  }
})

const playedAt = computed(() => {
  const [hour, minute] = playedTime.value.split(':').map((it) => Number.parseInt(it, 10))
  return combineDateAndTime(playedDay.value, hour || 0, minute || 0)
})

const durationMinutes = computed(() => {
  if (durationText.value.trim() === '') return DEFAULT_MINUTES
  const parsed = parseDuration(durationText.value)
  return parsed.ok ? parsed.minutes : null
})

const durationError = computed<string | null>(() => {
  if (durationText.value.trim() === '') return null
  const parsed = parseDuration(durationText.value)
  if (parsed.ok) return null
  return durationMessage(parsed.reason)
})

function durationMessage(reason: DurationParseFailure): string {
  if (reason === 'EMPTY') return t('duration_empty')
  if (reason === 'INVALID_FORMAT') return t('duration_invalid')
  if (reason === 'TOO_MANY_DECIMALS') return t('duration_too_many_decimals')
  return t('duration_out_of_range')
}

function amountMessage(reason: AmountParseFailure): string {
  if (reason === 'EMPTY') return t('amount_empty')
  if (reason === 'INVALID_FORMAT') return t('amount_invalid')
  if (reason === 'TOO_MANY_DECIMALS') return t('amount_too_many_decimals')
  return t('amount_out_of_range')
}

interface SeatState {
  form: SeatForm
  error: string | null
  included: boolean
}

const seatStates = computed<SeatState[]>(() =>
  seats.map((form) => {
    const included = form.seat === SEAT_SELF || form.recorded
    if (!included) return { form, error: null, included }

    const raw = form.amountText.trim()
    if (raw === '') return { form, error: null, included }

    const parsed = parseAmount(raw.startsWith('-') ? raw.slice(1) : raw)
    if (!parsed.ok) return { form, error: amountMessage(parsed.reason), included }
    return { form, error: null, included }
  }),
)

/** 每个已记录座位的带符号净额；有错时该座位置 0 并标记错误。 */
function netOf(state: SeatState): number {
  const raw = state.form.amountText.trim()
  if (raw === '') return 0
  const parsed = parseAmount(raw.startsWith('-') ? raw.slice(1) : raw)
  if (!parsed.ok) return 0
  return signedMinor(parsed.minor, state.form.isWin)
}

const includedStates = computed(() => seatStates.value.filter((it) => it.included))
const hasError = computed(() => includedStates.value.some((it) => it.error !== null))
const total = computed(() =>
  includedStates.value.reduce((sum, state) => sum + netOf(state), 0),
)
const recordedCount = computed(() => includedStates.value.length)
const allZero = computed(() => includedStates.value.every((state) => netOf(state) === 0))

const slot = computed<TimeSlot | null>(() => {
  if (durationMinutes.value === null) return null
  return timeSlotOf(midpointAt(playedAt.value, durationMinutes.value))
})

function slotLabel(value: TimeSlot): string {
  if (value === 'MORNING') return t('time_slot_morning')
  if (value === 'AFTERNOON') return t('time_slot_afternoon')
  return t('time_slot_evening')
}

const durationHint = computed(() => {
  if (durationMinutes.value === null || slot.value === null) return ''
  const start = playedAt.value - durationMinutes.value * 60_000
  return t('session_duration_slot_hint', [
    sessionClockRange(start, playedAt.value),
    slotLabel(slot.value),
  ])
})

const totalHint = computed(() => {
  if (hasError.value) return t('session_total_incomplete')
  if (total.value === 0) return t('session_total_ok')
  return t('session_total_warning', [(total.value / 100).toFixed(2)])
})

function availableFriends(seat: number) {
  const taken = seats
    .filter((it) => it.seat !== seat && it.recorded)
    .map((it) => it.playerId)
    .filter((it): it is string => it !== null)
  return activeFriends.value.filter((it) => !taken.includes(it.id))
}

function onPickFriend(seat: number, event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  const form = seats[seat]
  if (value === '__create__') {
    createFriendFor.value = seat
    newFriendName.value = ''
    newFriendNote.value = ''
    return
  }
  if (value === '') {
    form.playerId = null
    form.recorded = false
    return
  }
  form.playerId = value
  form.recorded = true
}

function createFriend(): void {
  const seat = createFriendFor.value
  if (seat === null) return
  const result = store.createFriend(newFriendName.value, newFriendNote.value)
  if (!result.ok) {
    toastError(t(errorKey(result.error)))
    return
  }
  seats[seat].playerId = result.value
  seats[seat].recorded = true
  createFriendFor.value = null
  show(t('friends_add'))
}

function toggleRecorded(seat: number): void {
  if (seat === SEAT_SELF) return
  const form = seats[seat]
  form.recorded = !form.recorded
  if (!form.recorded) {
    form.playerId = null
    form.amountText = ''
  }
}

function seekSave(): void {
  if (hasError.value) {
    toastError(t('session_total_incomplete'))
    return
  }
  if (!selfPlayer.value) return
  const missingPlayer = includedStates.value.some(
    (state) => state.form.seat !== SEAT_SELF && state.form.playerId === null,
  )
  if (missingPlayer) {
    toastError(t('session_pick_friend'))
    return
  }
  if (playedAt.value > Date.now()) {
    toastError(t('error_played_at_in_future'))
    return
  }
  if (durationMinutes.value === null) {
    toastError(t('error_invalid_duration'))
    return
  }
  if (textLength(titleText.value.trim()) > 30) {
    toastError(t('error_invalid_title'))
    return
  }
  if (textLength(noteText.value.trim()) > 100) {
    toastError(t('error_invalid_note'))
    return
  }
  confirmSave.value = true
}

const draftSeats = computed<SeatResultInput[]>(() =>
  includedStates.value
    .filter((state) => state.form.playerId !== null)
    .map((state) => ({
      seat: state.form.seat,
      playerId: state.form.playerId!,
      netMinor: netOf(state),
    })),
)

function doSave(): void {
  saving.value = true
  const duration = durationMinutes.value ?? DEFAULT_MINUTES

  if (isEditing.value) {
    const detail = existingDetail.value
    if (!detail) {
      saving.value = false
      confirmSave.value = false
      toastError(t('session_edit_stale'))
      return
    }
    const nets = new Map<number, number>()
    for (const state of includedStates.value) nets.set(state.form.seat, netOf(state))
    const result = store.updateSession({
      id: detail.id,
      expectedRevision: detail.revision,
      playedAt: playedAt.value,
      title: titleText.value,
      note: noteText.value,
      netMinorBySeat: nets,
      durationMinutes: duration,
    })
    saving.value = false
    confirmSave.value = false
    if (result.ok) {
      show(t('action_save'))
      router.push(`/sessions/${detail.id}`)
    } else {
      toastError(t(errorKey(result.error)))
    }
    return
  }

  const result = store.createSession({
    id: draftId.value,
    playedAt: playedAt.value,
    title: titleText.value,
    note: noteText.value,
    seats: draftSeats.value,
    durationMinutes: duration,
  })
  saving.value = false
  confirmSave.value = false
  if (result.ok) {
    show(t('session_save'))
    router.push(`/sessions/${result.value}`)
  } else {
    toastError(t(errorKey(result.error)))
  }
}

function cancel(): void {
  confirmDiscard.value = true
}

function leave(): void {
  confirmDiscard.value = false
  router.push(isEditing.value ? `/sessions/${editingId.value}` : '/sessions')
}

const maxHours = MAX_MINUTES / MINUTES_PER_HOUR
</script>

<template>
  <div class="edit-page">
    <PageHeader
      :title="isEditing ? t('session_edit_title') : t('action_record_session')"
      :subtitle="isEditing ? t('session_edit_roster_locked') : t('session_total_label')"
      :back-to="isEditing ? `/sessions/${editingId}` : '/sessions'"
    >
      <template #actions>
        <button class="btn btn--ghost" type="button" @click="cancel">{{ t('action_cancel') }}</button>
        <button class="btn btn--primary" type="button" :disabled="saving" @click="seekSave">
          <AppIcon name="check" :size="15" :stroke-width="2.4" />
          {{ isEditing ? t('session_edit_save') : t('session_save') }}
        </button>
      </template>
    </PageHeader>

    <div class="edit-grid">
      <div class="edit-main">
        <Panel :title="t('session_played_at')">
          <div class="time-row">
            <input v-model="playedDay" class="input time-date" type="date" />
            <input v-model="playedTime" class="input time-clock" type="time" />
            <span v-if="slot" class="chip" :class="`chip--slot-${slot.toLowerCase()}`">
              {{ slotLabel(slot) }}
            </span>
          </div>
          <div class="field">
            <label class="field__label">
              {{ t('session_duration_label') }}
              <span class="field__hint">{{ t('session_duration_hint') }}</span>
            </label>
            <div class="duration-row">
              <input
                v-model="durationText"
                class="input input--num duration-input"
                inputmode="decimal"
                :aria-invalid="!!durationError"
                :placeholder="String(DEFAULT_MINUTES / MINUTES_PER_HOUR)"
              />
              <span class="duration-unit">{{ t('session_duration_unit') }}</span>
              <span v-if="durationHint" class="duration-hint faint">{{ durationHint }}</span>
            </div>
            <p v-if="durationError" class="field__error">{{ durationError }}</p>
            <p v-else class="faint" style="font-size: 11.5px">
              {{ t('session_duration_hint') }} · 0.5 – {{ maxHours }}
            </p>
          </div>
        </Panel>

        <Panel :title="t('session_total_label')">
          <div class="seats">
            <div
              v-for="state in seatStates"
              :key="state.form.seat"
              class="seat-row"
              :class="{ 'seat-row--off': !state.included }"
            >
              <div class="seat-row__label">
                <span class="seat-row__name">
                  {{ state.form.seat === 0 ? t('seat_self') : state.form.seat === 1 ? t('seat_upper') : state.form.seat === 2 ? t('seat_opposite') : t('seat_lower') }}
                </span>
                <span v-if="state.included" class="seat-row__dot" />
              </div>

              <div class="seat-row__picker">
                <template v-if="state.form.seat === 0">
                  <span class="seat-row__self">{{ selfPlayer?.nickname ?? t('seat_self') }}</span>
                </template>
                <template v-else-if="isEditing">
                  <span class="seat-row__self">
                    {{ store.playerById(state.form.playerId ?? '')?.nickname ?? t('common_unavailable') }}
                  </span>
                </template>
                <template v-else-if="state.form.recorded">
                  <select
                    class="select"
                    :value="state.form.playerId ?? ''"
                    @change="onPickFriend(state.form.seat, $event)"
                  >
                    <option value="" disabled>{{ t('session_pick_friend') }}</option>
                    <option v-for="friend in availableFriends(state.form.seat)" :key="friend.id" :value="friend.id">
                      {{ friend.nickname }}
                    </option>
                    <option value="__create__">＋ {{ t('friend_create_title') }}</option>
                  </select>
                </template>
                <button v-else class="seat-row__add" type="button" @click="toggleRecorded(state.form.seat)">
                  <AppIcon name="plus" :size="13" />
                  {{ t('session_pick_friend') }}
                </button>
              </div>

              <div v-if="state.included" class="segmented seat-row__toggle">
                <button
                  class="segmented__item"
                  type="button"
                  :aria-pressed="state.form.isWin"
                  @click="state.form.isWin = true"
                >
                  {{ t('result_win') }}
                </button>
                <button
                  class="segmented__item"
                  type="button"
                  :aria-pressed="!state.form.isWin"
                  @click="state.form.isWin = false"
                >
                  {{ t('result_loss') }}
                </button>
              </div>

              <div v-if="state.included" class="seat-row__amount">
                <input
                  v-model="state.form.amountText"
                  class="input input--num"
                  inputmode="decimal"
                  :placeholder="t('session_amount_hint')"
                  :aria-invalid="!!state.error"
                />
              </div>

              <button
                v-if="state.form.seat !== 0 && !isEditing"
                class="icon-btn seat-row__remove"
                type="button"
                :title="t('action_cancel')"
                @click="toggleRecorded(state.form.seat)"
              >
                <AppIcon :name="state.form.recorded ? 'close' : 'plus'" :size="14" />
              </button>
            </div>
          </div>
          <p v-for="state in includedStates.filter((it) => it.error)" :key="`err-${state.form.seat}`" class="field__error">
            {{ state.form.seat === 0 ? t('seat_self') : state.form.seat === 1 ? t('seat_upper') : state.form.seat === 2 ? t('seat_opposite') : t('seat_lower') }}
            · {{ state.error }}
          </p>
        </Panel>

        <Panel :title="t('session_note_label')">
          <div class="field">
            <label class="field__label">
              {{ t('session_title_label') }}
              <span class="field__hint">{{ t('session_title_hint') }}</span>
            </label>
            <input v-model="titleText" class="input" maxlength="60" />
          </div>
          <div class="field">
            <label class="field__label">
              {{ t('session_note_label') }}
              <span class="field__hint">{{ t('session_note_hint') }}</span>
            </label>
            <textarea v-model="noteText" class="input" rows="3" maxlength="200" />
          </div>
        </Panel>
      </div>

      <aside class="edit-side">
        <Panel :title="t('session_total_label')">
          <div class="summary">
            <span class="summary__label">{{ t('session_total_label') }}</span>
            <span class="summary__value num" :class="total > 0 ? 'win' : total < 0 ? 'loss' : 'draw'">
              {{ total > 0 ? '+' : '' }}{{ (total / 100).toFixed(2) }}
            </span>
          </div>
          <p class="summary__hint" :class="{ 'summary__hint--warn': total !== 0 }">{{ totalHint }}</p>
          <div class="divider" />
          <ul class="summary__seats">
            <li v-for="state in includedStates" :key="state.form.seat">
              <span class="truncate">
                {{ state.form.seat === 0 ? (selfPlayer?.nickname ?? t('seat_self')) : (store.playerById(state.form.playerId ?? '')?.nickname ?? t('session_pick_friend')) }}
              </span>
              <span class="num" :class="netOf(state) > 0 ? 'win' : netOf(state) < 0 ? 'loss' : 'draw'">
                {{ netOf(state) > 0 ? '+' : '' }}{{ (netOf(state) / 100).toFixed(2) }}
              </span>
            </li>
          </ul>
          <p v-if="recordedCount < 4" class="panel__note">
            {{ t('session_preview_partial_format', [recordedCount]) }}
          </p>
          <button class="btn btn--primary btn--lg btn--block" type="button" :disabled="saving" @click="seekSave">
            {{ saving ? t('session_saving') : isEditing ? t('session_edit_save') : t('session_save') }}
          </button>
        </Panel>
      </aside>
    </div>

    <!-- 确认本场结果 -->
    <ConfirmDialog
      :open="confirmSave"
      :title="t('session_preview_title')"
      :confirm-text="t('session_preview_continue')"
      :cancel-text="t('action_cancel')"
      wide
      @close="confirmSave = false"
      @confirm="doSave"
    >
      <div class="preview">
        <div class="preview__headline">
          <span class="num">{{ monthDay(playedAt) }} {{ timeOfDay(playedAt) }}</span>
          <span v-if="slot" class="chip">{{ slotLabel(slot) }}</span>
          <span v-if="durationMinutes" class="chip">
            {{ formatHours(durationMinutes) }} {{ t('session_duration_unit') }}
          </span>
        </div>
        <ul class="preview__list">
          <li v-for="state in includedStates" :key="state.form.seat">
            <span>
              {{ state.form.seat === 0 ? (selfPlayer?.nickname ?? t('seat_self')) : (store.playerById(state.form.playerId ?? '')?.nickname ?? t('session_pick_friend')) }}
              <span class="faint">· {{ state.form.seat === 0 ? t('seat_self') : state.form.seat === 1 ? t('seat_upper') : state.form.seat === 2 ? t('seat_opposite') : t('seat_lower') }}</span>
            </span>
            <span class="num" :class="netOf(state) > 0 ? 'win' : netOf(state) < 0 ? 'loss' : 'draw'">
              {{ netOf(state) > 0 ? '+' : '' }}{{ (netOf(state) / 100).toFixed(2) }}
            </span>
          </li>
        </ul>
        <p v-if="recordedCount < 4" class="panel__note">
          {{ t('session_preview_partial_format', [recordedCount]) }}
        </p>
        <p v-if="total !== 0" class="alert">
          <AppIcon name="alert" :size="15" />
          {{ t('session_preview_unbalanced', [(total / 100).toFixed(2)]) }}
        </p>
        <p v-else-if="allZero" class="alert">
          <AppIcon name="alert" :size="15" />
          {{ t('session_all_zero_confirm') }}
        </p>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      :open="confirmDiscard"
      :title="t('session_discard_title')"
      :confirm-text="t('session_discard_confirm')"
      :cancel-text="t('session_discard_stay')"
      @close="confirmDiscard = false"
      @confirm="leave"
    >
      {{ t('session_discard_message') }}
    </ConfirmDialog>

    <!-- 新建牌友 -->
    <ConfirmDialog
      :open="createFriendFor !== null"
      :title="t('friend_create_title')"
      :confirm-text="t('friend_action_create')"
      :cancel-text="t('action_cancel')"
      @close="createFriendFor = null"
      @confirm="createFriend"
    >
      <div class="field">
        <label class="field__label">{{ t('friend_nickname_label') }}</label>
        <input v-model="newFriendName" class="input" maxlength="12" autofocus />
      </div>
      <div class="field">
        <label class="field__label">{{ t('friend_note_label') }}</label>
        <input v-model="newFriendNote" class="input" maxlength="100" :placeholder="t('friend_note_hint')" />
      </div>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.edit-page {
  max-width: 1180px;
  margin: 0 auto;
}

.edit-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 316px;
  gap: 16px;
  align-items: start;
}

.edit-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.edit-side {
  position: sticky;
  top: 24px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.time-date {
  width: 168px;
}

.time-clock {
  width: 120px;
}

.duration-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-input {
  width: 100px;
}

.duration-unit {
  font-size: 12.5px;
  color: var(--text-3);
}

.duration-hint {
  font-size: 11.5px;
  font-family: var(--font-num);
}

.seats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.seat-row {
  display: grid;
  grid-template-columns: 66px minmax(140px, 1fr) 108px 132px 28px;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.seat-row:last-child {
  border-bottom: none;
}

.seat-row--off {
  grid-template-columns: 66px 1fr 28px;
  opacity: 0.72;
}

.seat-row__label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.seat-row__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.seat-row__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--brand);
}

.seat-row__picker {
  min-width: 0;
}

.seat-row__picker .select {
  width: 100%;
}

.seat-row__self {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-alt);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 550;
  width: 100%;
}

.seat-row__add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-strong);
  color: var(--text-2);
  font-size: 12.5px;
  width: 100%;
}

.seat-row__add:hover {
  border-color: var(--brand);
  color: var(--brand);
}

.seat-row__toggle {
  width: 108px;
  justify-content: center;
}

.seat-row__amount .input {
  height: 34px;
}

.seat-row__remove {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--text-3);
}

.seat-row__remove:hover {
  color: var(--danger);
  background: var(--danger-container);
}

.summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.summary__label {
  font-size: 12px;
  color: var(--text-3);
}

.summary__value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.summary__hint {
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.55;
}

.summary__hint--warn {
  color: var(--draw);
}

.summary__seats {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
}

.summary__seats li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-2);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview__headline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.preview__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.preview__list li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  padding: 3px 0;
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

@media (max-width: 1024px) {
  .edit-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .edit-side {
    position: static;
  }

  .seat-row {
    grid-template-columns: 60px minmax(120px, 1fr) 96px 110px 26px;
  }
}

@media (max-width: 700px) {
  .seat-row,
  .seat-row--off {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px 0;
  }

  .seat-row__toggle {
    width: 100%;
  }

  .seat-row__remove {
    display: none;
  }
}
</style>
