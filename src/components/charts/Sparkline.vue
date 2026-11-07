<script setup lang="ts">
/** 迷你走势：牌友列表里一眼看出「最近手气」。 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    values: number[]
    width?: number
    height?: number
  }>(),
  { width: 96, height: 28 },
)

const geometry = computed(() => {
  if (props.values.length < 2) return null
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const span = max - min || 1
  const pad = 3
  const w = props.width - pad * 2
  const h = props.height - pad * 2
  const points = props.values.map((value, index) => ({
    x: pad + (index / (props.values.length - 1)) * w,
    y: pad + (1 - (value - min) / span) * h,
  }))
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
  return { path, last: points[points.length - 1] }
})

const trendUp = computed(() => {
  const list = props.values
  return list.length >= 2 && list[list.length - 1] >= list[0]
})
</script>

<template>
  <svg
    v-if="geometry"
    :width="width"
    :height="height"
    class="spark"
    :class="trendUp ? 'spark--up' : 'spark--down'"
  >
    <path :d="geometry.path" class="spark__path" />
    <circle :cx="geometry.last.x" :cy="geometry.last.y" r="2.4" class="spark__dot" />
  </svg>
  <span v-else class="spark__empty faint">—</span>
</template>

<style scoped>
.spark {
  display: block;
  overflow: visible;
}

.spark__path {
  fill: none;
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.spark--up .spark__path {
  stroke: var(--loss);
}

.spark--down .spark__path {
  stroke: var(--win);
}

.spark__dot {
  stroke: var(--surface);
  stroke-width: 1.4;
}

.spark--up .spark__dot {
  fill: var(--loss);
}

.spark--down .spark__dot {
  fill: var(--win);
}

.spark__empty {
  font-size: 12px;
}
</style>
