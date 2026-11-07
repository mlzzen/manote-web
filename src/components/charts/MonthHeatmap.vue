<script setup lang="ts">
/**
 * 月历热力格。
 *
 * 只画真的打过的那几天：没有记录的日子留白，而不是画一个「0 元」——
 * 「这天没打」和「这天打了但持平」是两件事。
 */
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import type { DayNet } from '@/domain/streak'
import { compactSignedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    yearMonth: string
    days: Map<string, DayNet>
    selected?: string | null
    compact?: boolean
  }>(),
  { selected: null, compact: false },
)

const emit = defineEmits<{ select: [dayKey: string] }>()
const { t, locale } = useI18n()

const WEEKDAYS_ZH = ['一', '二', '三', '四', '五', '六', '日']
const WEEKDAYS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const weekdayLabels = computed(() => (locale.value === 'zh-CN' ? WEEKDAYS_ZH : WEEKDAYS_EN))

const [year, month] = props.yearMonth.split('-').map((it) => Number.parseInt(it, 10))

const firstWeekday = computed(() => {
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7
})

const daysInMonth = computed(() => new Date(year, month, 0).getDate())

const maxAbs = computed(() => {
  let max = 1
  for (const day of props.days.values()) max = Math.max(max, Math.abs(day.netMinor))
  return max
})

interface Cell {
  dayKey: string
  dayOfMonth: number
  data: DayNet | null
  intensity: number
}

const cells = computed<Cell[]>(() => {
  const result: Cell[] = []
  for (let index = 0; index < firstWeekday.value; index++) {
    result.push({ dayKey: '', dayOfMonth: 0, data: null, intensity: 0 })
  }
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth.value; dayOfMonth++) {
    const dayKey = `${props.yearMonth}-${String(dayOfMonth).padStart(2, '0')}`
    const data = props.days.get(dayKey) ?? null
    const intensity = data ? Math.abs(data.netMinor) / maxAbs.value : 0
    result.push({ dayKey, dayOfMonth, data, intensity })
  }
  return result
})

function tone(cell: Cell): string {
  if (!cell.data) return 'none'
  if (cell.data.netMinor > 0) return 'win'
  if (cell.data.netMinor < 0) return 'loss'
  return 'draw'
}

function cellStyle(cell: Cell): Record<string, string> {
  const kind = tone(cell)
  if (kind === 'none') return {}
  const alpha = 0.08 + cell.intensity * 0.24
  const map: Record<string, string> = { win: '184,58,43', loss: '47,122,85', draw: '169,128,31' }
  return { background: `rgba(${map[kind]}, ${alpha.toFixed(3)})` }
}
</script>

<template>
  <div class="mcal" :class="{ 'mcal--compact': compact }">
    <div class="mcal__head">
      <span v-for="(label, index) in weekdayLabels" :key="`w-${index}`">{{ label }}</span>
    </div>
    <div class="mcal__grid">
      <button
        v-for="(cell, index) in cells"
        :key="cell.dayKey || `blank-${index}`"
        type="button"
        class="mcal__cell"
        :class="[
          `mcal__cell--${tone(cell)}`,
          { 'mcal__cell--blank': !cell.dayKey, 'mcal__cell--selected': selected === cell.dayKey && !!cell.dayKey },
        ]"
        :style="cellStyle(cell)"
        :disabled="!cell.data"
        :title="cell.data ? `${cell.dayKey} ${compactSignedYuan(cell.data.netMinor)}` : ''"
        @click="cell.dayKey && emit('select', cell.dayKey)"
      >
        <span class="mcal__day">{{ cell.dayOfMonth || '' }}</span>
        <span v-if="cell.data" class="mcal__amount num">
          {{ compactSignedYuan(cell.data.netMinor) }}
        </span>
      </button>
    </div>
    <p v-if="days.size === 0" class="mcal__empty">{{ t('home_calendar_empty') }}</p>
  </div>
</template>

<style scoped>
.mcal {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mcal__head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  padding: 0 1px;
}

.mcal__head span {
  text-align: center;
  font-size: 10.5px;
  font-weight: 650;
  color: var(--text-3);
}

.mcal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.mcal__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  aspect-ratio: 1 / 0.94;
  min-height: 44px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--chip) 55%, transparent);
  color: var(--text-2);
  transition: all 0.12s ease;
}

.mcal--compact .mcal__cell {
  min-height: 34px;
  border-radius: 7px;
}

.mcal__cell--blank {
  background: transparent;
  pointer-events: none;
}

.mcal__cell:not(:disabled):hover {
  border-color: var(--outline);
  transform: translateY(-1px);
}

.mcal__cell--selected {
  border-color: var(--brand);
  box-shadow: 0 0 0 2px var(--ring);
}

.mcal__cell--win {
  color: var(--win);
}

.mcal__cell--loss {
  color: var(--loss);
}

.mcal__cell--draw {
  color: var(--draw);
}

.mcal__day {
  font-size: 10.5px;
  font-weight: 650;
  color: var(--text-3);
  line-height: 1;
}

.mcal__cell--win .mcal__day,
.mcal__cell--loss .mcal__day,
.mcal__cell--draw .mcal__day {
  color: inherit;
  opacity: 0.7;
}

.mcal__amount {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.mcal--compact .mcal__amount {
  display: none;
}

.mcal__empty {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  padding: 10px 0 2px;
}
</style>
