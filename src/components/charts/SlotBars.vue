<script setup lang="ts">
/**
 * 分时段战绩：每个时段一根双向条，右侧给出净额与该时段的场均。
 *
 * 条长按「该时段净额」相对全部分时段的最大绝对值来定，
 * 因此早场与晚场的条长可以直接横比——而不是各自占满一整格。
 *
 * 净额与场均分成两列右对齐，是为了让三个时段的数字在x轴上对齐：
 * 早场输得少、下午场打得多、晚场场均更差，这种差别只有对齐之后才看得见。
 */
import { computed } from 'vue'
import { useI18n } from '@/i18n'
import { signedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    items: {
      key: string
      label: string
      netMinor: number
      averageMinor: number
      sessionCount: number
      winRate: number
    }[]
  }>(),
  {},
)

const { t } = useI18n()

const maxAbs = computed(() => Math.max(1, ...props.items.map((it) => Math.abs(it.netMinor))))

function widthOf(netMinor: number): string {
  return `${Math.max(2, (Math.abs(netMinor) / maxAbs.value) * 100)}%`
}

function toneOf(minor: number): string {
  if (minor > 0) return 'win'
  if (minor < 0) return 'loss'
  return 'draw'
}
</script>

<template>
  <div class="slots">
    <div class="slots__head" aria-hidden="true">
      <span>{{ t('stat_time_slot') }}</span>
      <span />
      <span class="num">{{ t('stat_net') }}</span>
      <span class="num">{{ t('stat_average') }}</span>
    </div>

    <div v-for="item in items" :key="item.key" class="slots__row">
      <div class="slots__meta">
        <span class="slots__label">{{ item.label }}</span>
        <span class="slots__sub num">
          {{ t('home_slot_count_format', [item.sessionCount]) }}
          <template v-if="item.sessionCount > 0"> · {{ item.winRate }}%</template>
        </span>
      </div>

      <div class="slots__track">
        <span class="slots__axis" aria-hidden="true" />
        <span
          class="slots__fill"
          :class="item.netMinor >= 0 ? 'slots__fill--up' : 'slots__fill--down'"
          :style="{ width: widthOf(item.netMinor) }"
        />
      </div>

      <span class="slots__net num" :class="toneOf(item.netMinor)">
        {{ item.sessionCount === 0 ? '—' : signedYuan(item.netMinor) }}
      </span>
      <span class="slots__avg num" :class="toneOf(item.averageMinor)">
        {{ item.sessionCount === 0 ? '—' : signedYuan(item.averageMinor) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.slots {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.slots__head,
.slots__row {
  display: grid;
  grid-template-columns: 62px minmax(48px, 1fr) 78px 74px;
  align-items: center;
  gap: 10px;
}

.slots__head {
  padding-bottom: 4px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--text-3);
}

.slots__head span:last-child,
.slots__head span:nth-child(3) {
  text-align: right;
}

.slots__row {
  padding: 6px 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.slots__meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.slots__label {
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.slots__sub {
  font-size: 10px;
  color: var(--text-3);
  line-height: 1.3;
  white-space: nowrap;
}

.slots__track {
  position: relative;
  height: 18px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--chip) 55%, transparent);
  overflow: hidden;
  display: flex;
  align-items: center;
}

.slots__axis {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--outline);
  opacity: 0.5;
}

.slots__fill {
  height: 100%;
  border-radius: 0 5px 5px 0;
  transition: width 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.slots__fill--up {
  background: linear-gradient(90deg, color-mix(in srgb, var(--win) 55%, transparent), var(--win));
}

.slots__fill--down {
  background: linear-gradient(90deg, color-mix(in srgb, var(--loss) 55%, transparent), var(--loss));
}

.slots__net {
  text-align: right;
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}

.slots__avg {
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.92;
}

@media (max-width: 900px) {
  .slots__head,
  .slots__row {
    grid-template-columns: 56px minmax(40px, 1fr) 72px 68px;
    gap: 8px;
  }
}
</style>
