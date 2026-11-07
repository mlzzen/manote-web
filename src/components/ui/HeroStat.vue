<script setup lang="ts">
import { computed } from 'vue'
import { signedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    label: string
    minor: number | null
    /** 金额为 null 时显示的占位说明。 */
    emptyText?: string
    /** 卡片右上角的辅助说明（例如「本月」「全部时间」）。 */
    caption?: string
    compact?: boolean
  }>(),
  { emptyText: '', caption: '', compact: false },
)

const tone = computed(() => {
  if (props.minor === null) return 'none'
  if (props.minor > 0) return 'win'
  if (props.minor < 0) return 'loss'
  return 'draw'
})

const text = computed(() => (props.minor === null ? '—' : signedYuan(props.minor)))
</script>

<template>
  <section class="hero" :class="{ 'hero--compact': compact }">
    <div class="hero__glow" aria-hidden="true" />
    <header class="hero__head">
      <span class="hero__label">{{ label }}</span>
      <span v-if="caption" class="hero__caption">{{ caption }}</span>
      <slot name="badge" />
    </header>
    <p class="hero__value" :class="`hero__value--${tone}`">{{ text }}</p>
    <p v-if="minor === null && emptyText" class="hero__empty">{{ emptyText }}</p>
    <div v-if="$slots.default" class="hero__meta">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl);
  padding: 22px 24px;
  background: linear-gradient(165deg, var(--hero-top) 0%, var(--hero) 46%, var(--hero-bottom) 100%);
  color: var(--on-hero);
  box-shadow: 0 14px 34px rgba(12, 36, 25, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.hero--compact {
  padding: 16px 18px;
  gap: 2px;
}

.hero__glow {
  position: absolute;
  top: -60%;
  right: -10%;
  width: 60%;
  padding-bottom: 60%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.14), transparent 65%);
  pointer-events: none;
}

.hero__head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--on-hero-muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.hero__caption {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  opacity: 0.72;
}

.hero__value {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-size: 42px;
  line-height: 1.14;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-top: 2px;
}

.hero--compact .hero__value {
  font-size: 28px;
}

.hero__value--win {
  color: var(--hero-win);
}

.hero__value--loss {
  color: var(--hero-loss);
}

.hero__value--draw {
  color: var(--hero-draw);
}

.hero__value--none {
  color: var(--on-hero-muted);
  opacity: 0.55;
}

.hero__empty {
  font-size: 12px;
  color: var(--on-hero-muted);
  opacity: 0.85;
}

.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.hero__meta :deep(.hero-chip) {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--on-hero-chip);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 26px;
}

.hero__meta :deep(.hero-chip b) {
  font-family: var(--font-num);
  font-size: 13px;
  font-weight: 700;
  color: var(--on-hero);
}
</style>
