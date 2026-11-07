<script setup lang="ts">
/**
 * 赢 / 输 / 持平分布环图。
 *
 * 环心放的是总数，而不是三个数字之一——避免读者把环心当成「占比最大的那一档」。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    win: number
    loss: number
    draw: number
    size?: number
    thickness?: number
    centerLabel?: string
    centerValue?: string
  }>(),
  { size: 132, thickness: 14, centerLabel: '', centerValue: '' },
)

const total = computed(() => props.win + props.loss + props.draw)
const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

interface Arc {
  color: string
  dash: number
  offset: number
}

const arcs = computed<Arc[]>(() => {
  const c = circumference.value
  if (total.value === 0) return []
  const gap = 2.5
  const parts = [
    { value: props.win, color: 'var(--win)' },
    { value: props.loss, color: 'var(--loss)' },
    { value: props.draw, color: 'var(--draw)' },
  ].filter((it) => it.value > 0)

  let running = 0
  return parts.map((part) => {
    const length = (part.value / total.value) * c
    const arc = {
      color: part.color,
      dash: Math.max(0.5, length - gap),
      offset: -running,
    }
    running += length
    return arc
  })
})
</script>

<template>
  <div class="donut" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke-width="thickness"
        class="donut__track"
      />
      <circle
        v-for="(arc, index) in arcs"
        :key="index"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="arc.color"
        :stroke-width="thickness"
        stroke-linecap="round"
        :stroke-dasharray="`${arc.dash} ${circumference - arc.dash}`"
        :stroke-dashoffset="arc.offset"
        class="donut__arc"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <div class="donut__center">
      <span class="donut__value num">{{ centerValue || total }}</span>
      <span v-if="centerLabel" class="donut__label">{{ centerLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.donut {
  position: relative;
  flex: none;
}

.donut__track {
  stroke: var(--chip);
}

.donut__arc {
  transition: stroke-dasharray 0.4s ease;
}

.donut__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  pointer-events: none;
}

.donut__value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.donut__label {
  font-size: 10.5px;
  color: var(--text-3);
}
</style>
