<script setup lang="ts">
/**
 * 分时段战绩：每个时段一根双向条。
 *
 * 条长按「该时段净额」相对全部分时段的最大绝对值来定，
 * 因此早场与晚场的条长可以直接横比——而不是各自占满一整格。
 */
import { computed } from 'vue'
import { signedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    items: {
      key: string
      label: string
      netMinor: number
      sessionCount: number
      winRate: number
    }[]
  }>(),
  {},
)

const maxAbs = computed(() => Math.max(1, ...props.items.map((it) => Math.abs(it.netMinor))))

function widthOf(netMinor: number): string {
  return `${Math.max(2, (Math.abs(netMinor) / maxAbs.value) * 100)}%`
}
</script>

<template>
  <div class="slots">
    <div v-for="item in items" :key="item.key" class="slots__row">
      <div class="slots__meta">
        <span class="slots__label">{{ item.label }}</span>
        <span class="slots__count num">{{ item.sessionCount }}</span>
      </div>
      <div class="slots__track">
        <span class="slots__axis" aria-hidden="true" />
        <span
          class="slots__fill"
          :class="item.netMinor >= 0 ? 'slots__fill--up' : 'slots__fill--down'"
          :style="{ width: widthOf(item.netMinor) }"
        />
      </div>
      <div class="slots__value">
        <span class="num" :class="item.netMinor > 0 ? 'win' : item.netMinor < 0 ? 'loss' : 'draw'">
          {{ item.sessionCount === 0 ? '—' : signedYuan(item.netMinor) }}
        </span>
        <span v-if="item.sessionCount > 0" class="slots__rate num">{{ item.winRate }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slots__row {
  display: grid;
  grid-template-columns: 56px 1fr minmax(96px, auto);
  align-items: center;
  gap: 12px;
}

.slots__meta {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.slots__label {
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.slots__count {
  font-size: 11px;
  color: var(--text-3);
  background: var(--chip);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 17px;
}

.slots__track {
  position: relative;
  height: 22px;
  border-radius: 6px;
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
  border-radius: 0 6px 6px 0;
  transition: width 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.slots__fill--up {
  background: linear-gradient(90deg, color-mix(in srgb, var(--win) 55%, transparent), var(--win));
}

.slots__fill--down {
  background: linear-gradient(90deg, color-mix(in srgb, var(--loss) 55%, transparent), var(--loss));
}

.slots__value {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 7px;
  font-size: 13px;
  font-weight: 650;
}

.slots__rate {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 500;
  min-width: 30px;
  text-align: right;
}
</style>
