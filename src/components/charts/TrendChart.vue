<script setup lang="ts">
/**
 * 累计净额曲线。
 *
 * 纵轴以 0 线为界：线在 0 线之上是累计赢钱，之下是累计输钱。
 * 横轴按「第几场」等距排布，而不是按真实时间——同一晚连打三场的间隔是几小时，
 * 隔一周再打一场的间隔是七天，按时间排会把三场挤成一个点。
 */
import { computed, ref } from 'vue'
import { useElementWidth } from '@/composables/useElementWidth'
import { monthDay } from '@/domain/uiText'
import { signedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    points: { playedAt: number; cumulativeMinor: number }[]
    height?: number
  }>(),
  { height: 210 },
)

const host = ref<HTMLElement | null>(null)
const width = useElementWidth(host, 640)
const hoverIndex = ref<number | null>(null)

const PAD = { top: 18, right: 14, bottom: 26, left: 56 }

const plot = computed(() => ({
  w: Math.max(60, width.value - PAD.left - PAD.right),
  h: Math.max(60, props.height - PAD.top - PAD.bottom),
}))

const domain = computed(() => {
  const values = props.points.map((it) => it.cumulativeMinor)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  if (max === min) return { min: -100, max: 100 }
  const span = max - min
  const pad = span * 0.12
  return { min: min - pad, max: max + pad }
})

function xAt(index: number): number {
  if (props.points.length <= 1) return PAD.left + plot.value.w / 2
  return PAD.left + (index / (props.points.length - 1)) * plot.value.w
}

function yAt(value: number): number {
  const { min, max } = domain.value
  const ratio = (value - min) / (max - min)
  return PAD.top + (1 - ratio) * plot.value.h
}

const zeroY = computed(() => yAt(0))

const linePath = computed(() => {
  if (props.points.length === 0) return ''
  return props.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(2)},${yAt(point.cumulativeMinor).toFixed(2)}`)
    .join(' ')
})

const areaPath = computed(() => {
  if (props.points.length === 0) return ''
  const base = yAt(0).toFixed(2)
  const body = props.points
    .map((point, index) => `${index === 0 ? 'L' : 'L'}${xAt(index).toFixed(2)},${yAt(point.cumulativeMinor).toFixed(2)}`)
    .join(' ')
  return `M${xAt(0).toFixed(2)},${base} ${body} L${xAt(props.points.length - 1).toFixed(2)},${base} Z`
})

const ticks = computed(() => {
  const { min, max } = domain.value
  const count = 4
  const step = (max - min) / count
  return Array.from({ length: count + 1 }, (_, index) => {
    const value = min + step * index
    return { value: Math.round(value), y: yAt(value) }
  })
})

/** 首、中、尾三个日期标签，避免横轴挤成一片。 */
const xLabels = computed(() => {
  const list = props.points
  if (list.length === 0) return []
  if (list.length === 1) return [{ x: xAt(0), text: monthDay(list[0].playedAt) }]
  const indexes = list.length <= 3 ? list.map((_, index) => index) : [0, Math.floor((list.length - 1) / 2), list.length - 1]
  return indexes.map((index) => ({ x: xAt(index), text: monthDay(list[index].playedAt) }))
})

const hovered = computed(() => {
  if (hoverIndex.value === null) return null
  const point = props.points[hoverIndex.value]
  if (!point) return null
  return {
    point,
    x: xAt(hoverIndex.value),
    y: yAt(point.cumulativeMinor),
    index: hoverIndex.value,
  }
})

function onMove(event: MouseEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const localX = event.clientX - rect.left
  if (props.points.length === 0) return
  const ratio = (localX - PAD.left) / Math.max(1, plot.value.w)
  const index = Math.round(ratio * (props.points.length - 1))
  hoverIndex.value = Math.min(props.points.length - 1, Math.max(0, index))
}

function onLeave(): void {
  hoverIndex.value = null
}

const gradientId = `trend-fill-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div ref="host" class="trend" :style="{ height: `${height}px` }">
    <svg
      :width="width"
      :height="height"
      class="trend__svg"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--loss)" stop-opacity="0.22" />
          <stop offset="100%" stop-color="var(--loss)" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- 水平网格 -->
      <g class="trend__grid">
        <line
          v-for="tick in ticks"
          :key="`g-${tick.value}`"
          :x1="PAD.left"
          :x2="PAD.left + plot.w"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>

      <!-- 0 线 -->
      <line
        class="trend__zero"
        :x1="PAD.left"
        :x2="PAD.left + plot.w"
        :y1="zeroY"
        :y2="zeroY"
      />

      <!-- 刻度文字 -->
      <text
        v-for="tick in ticks"
        :key="`t-${tick.value}`"
        class="trend__axis"
        :x="PAD.left - 8"
        :y="tick.y + 3.5"
        text-anchor="end"
      >
        {{ tick.value === 0 ? '0' : Math.round(tick.value / 100) }}
      </text>

      <path v-if="points.length > 1" :d="areaPath" :fill="`url(#${gradientId})`" />
      <path v-if="points.length > 1" :d="linePath" class="trend__line" />

      <circle
        v-for="(point, index) in points"
        :key="`p-${index}`"
        :cx="xAt(index)"
        :cy="yAt(point.cumulativeMinor)"
        :r="points.length > 30 ? 1.6 : 2.8"
        class="trend__dot"
        :class="{ 'trend__dot--last': index === points.length - 1 }"
      />

      <text
        v-for="label in xLabels"
        :key="`x-${label.text}-${label.x}`"
        class="trend__axis"
        :x="label.x"
        :y="height - 7"
        text-anchor="middle"
      >
        {{ label.text }}
      </text>

      <g v-if="hovered">
        <line
          class="trend__cursor"
          :x1="hovered.x"
          :x2="hovered.x"
          :y1="PAD.top"
          :y2="PAD.top + plot.h"
        />
        <circle :cx="hovered.x" :cy="hovered.y" r="4.5" class="trend__dot trend__dot--hover" />
      </g>
    </svg>

    <div
      v-if="hovered"
      class="trend__tip"
      :style="{
        left: `${Math.min(Math.max(hovered.x, 70), width - 70)}px`,
        top: `${Math.max(4, hovered.y - 52)}px`,
      }"
    >
      <span class="trend__tip-date">{{ monthDay(hovered.point.playedAt) }}</span>
      <span class="trend__tip-value num" :class="hovered.point.cumulativeMinor >= 0 ? 'loss' : 'win'">
        {{ signedYuan(hovered.point.cumulativeMinor) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.trend {
  position: relative;
  width: 100%;
}

.trend__svg {
  display: block;
  overflow: visible;
}

.trend__grid line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 2 5;
}

.trend__zero {
  stroke: var(--outline);
  stroke-width: 1.2;
  opacity: 0.75;
}

.trend__axis {
  fill: var(--text-3);
  font-size: 10px;
  font-family: var(--font-num);
}

.trend__line {
  fill: none;
  stroke: var(--brand);
  stroke-width: 2.2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.trend__dot {
  fill: var(--surface);
  stroke: var(--brand);
  stroke-width: 1.8;
}

.trend__dot--last {
  fill: var(--brand);
  stroke: var(--surface);
  stroke-width: 2.4;
}

.trend__dot--hover {
  fill: var(--surface);
  stroke: var(--brand);
  stroke-width: 3;
}

.trend__cursor {
  stroke: var(--outline);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.trend__tip {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  pointer-events: none;
  white-space: nowrap;
  z-index: 2;
}

.trend__tip-date {
  font-size: 10.5px;
  color: var(--text-3);
}

.trend__tip-value {
  font-size: 13px;
  font-weight: 700;
}
</style>
