<script setup lang="ts">
/**
 * 逐场柱状图：向上是赢、向下是输，最近一场在最右边。
 *
 * 与曲线图同一个取舍：横轴按「第几场」等距排布，而不是按真实时间。
 */
import { computed, ref } from 'vue'
import { useElementWidth } from '@/composables/useElementWidth'
import { monthSlashDay, signedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    items: { playedAt: number; netMinor: number }[]
    height?: number
    showLabels?: boolean
  }>(),
  { height: 170, showLabels: true },
)

const host = ref<HTMLElement | null>(null)
const width = useElementWidth(host, 520)
const hoverIndex = ref<number | null>(null)

const PAD = { top: 12, right: 8, bottom: 22, left: 8 }

const plotW = computed(() => Math.max(80, width.value - PAD.left - PAD.right))
const plotH = computed(() => Math.max(50, props.height - PAD.top - PAD.bottom))

const maxAbs = computed(() => Math.max(1, ...props.items.map((it) => Math.abs(it.netMinor))))

function slotWidth(): number {
  return props.items.length === 0 ? plotW.value : plotW.value / props.items.length
}

function barWidth(): number {
  return Math.max(4, Math.min(30, slotWidth() * 0.56))
}

const zeroY = computed(() => PAD.top + plotH.value / 2)

interface Bar {
  x: number
  y: number
  h: number
  positive: boolean
  item: (typeof props.items)[number]
  index: number
}

const bars = computed<Bar[]>(() => {
  const half = plotH.value / 2
  const slot = slotWidth()
  return props.items.map((item, index) => {
    const ratio = Math.abs(item.netMinor) / maxAbs.value
    const h = Math.max(item.netMinor === 0 ? 1.5 : 3, ratio * (half - 6))
    const positive = item.netMinor >= 0
    return {
      x: PAD.left + slot * index + slot / 2,
      y: positive ? zeroY.value - h : zeroY.value,
      h,
      positive,
      item,
      index,
    }
  })
})

function onMove(event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const localX = event.clientX - rect.left - PAD.left
  if (props.items.length === 0) return
  const index = Math.floor(localX / slotWidth())
  hoverIndex.value = Math.min(props.items.length - 1, Math.max(0, index))
}

const hovered = computed(() => {
  if (hoverIndex.value === null) return null
  const bar = bars.value[hoverIndex.value]
  return bar ?? null
})
</script>

<template>
  <div ref="host" class="bars" :style="{ height: `${height}px` }">
    <svg :width="width" :height="height" @mousemove="onMove" @mouseleave="hoverIndex = null">
      <line
        class="bars__zero"
        :x1="PAD.left"
        :x2="PAD.left + plotW"
        :y1="zeroY"
        :y2="zeroY"
      />

      <g v-for="bar in bars" :key="bar.index">
        <rect
          :x="bar.x - barWidth() / 2"
          :y="bar.y"
          :width="barWidth()"
          :height="bar.h"
          :rx="Math.min(4, barWidth() / 2)"
          class="bars__bar"
          :class="[
            bar.positive ? 'bars__bar--up' : 'bars__bar--down',
            { 'bars__bar--dim': hoverIndex !== null && hoverIndex !== bar.index },
          ]"
        />
        <text
          v-if="showLabels && items.length <= 14"
          class="bars__label"
          :x="bar.x"
          :y="height - 6"
          text-anchor="middle"
        >
          {{ monthSlashDay(bar.item.playedAt) }}
        </text>
      </g>
    </svg>

    <div
      v-if="hovered"
      class="bars__tip"
      :style="{
        left: `${Math.min(Math.max(hovered.x, 60), width - 60)}px`,
        top: `${hovered.positive ? Math.max(0, hovered.y - 46) : Math.min(height - 44, hovered.y + 8)}px`,
      }"
    >
      <span class="bars__tip-date">{{ monthSlashDay(hovered.item.playedAt) }}</span>
      <span class="bars__tip-value num" :class="hovered.positive ? 'win' : 'loss'">
        {{ signedYuan(hovered.item.netMinor) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.bars {
  position: relative;
  width: 100%;
}

.bars__zero {
  stroke: var(--outline);
  stroke-width: 1.2;
  opacity: 0.6;
}

.bars__bar {
  transition: opacity 0.12s ease;
}

.bars__bar--up {
  fill: var(--win);
}

.bars__bar--down {
  fill: var(--loss);
}

.bars__bar--dim {
  opacity: 0.35;
}

.bars__label {
  fill: var(--text-3);
  font-size: 9.5px;
  font-family: var(--font-num);
}

.bars__tip {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px 9px;
  border-radius: 9px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;
}

.bars__tip-date {
  font-size: 10px;
  color: var(--text-3);
}

.bars__tip-value {
  font-size: 12.5px;
  font-weight: 700;
}
</style>
