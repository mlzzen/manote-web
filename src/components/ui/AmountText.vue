<script setup lang="ts">
import { computed } from 'vue'
import { formatMinor } from '@/domain/money'
import { signedYuan } from '@/domain/uiText'

const props = withDefaults(
  defineProps<{
    minor: number | null
    /** 金额为 null 时的占位符。 */
    placeholder?: string
    /** 是否带正号。 */
    signed?: boolean
    /** 是否附加「赢 / 输 / 持平」字样（不只靠颜色表达输赢）。 */
    label?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { placeholder: '—', signed: true, label: false, size: 'md' },
)

const tone = computed(() => {
  if (props.minor === null) return 'none'
  if (props.minor > 0) return 'win'
  if (props.minor < 0) return 'loss'
  return 'draw'
})

const text = computed(() => {
  if (props.minor === null) return props.placeholder
  if (props.signed) return signedYuan(props.minor)
  return `¥${formatMinor(Math.abs(props.minor))}`
})

const labelText = computed(() => {
  if (props.minor === null) return ''
  if (props.minor > 0) return '赢'
  if (props.minor < 0) return '输'
  return '持平'
})
</script>

<template>
  <span class="amount num" :class="[`amount--${tone}`, `amount--${size}`]">
    <span v-if="label && labelText" class="amount__label">{{ labelText }}</span>
    {{ text }}
  </span>
</template>

<style scoped>
.amount {
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.amount--win {
  color: var(--win);
}

.amount--loss {
  color: var(--loss);
}

.amount--draw {
  color: var(--draw);
}

.amount--none {
  color: var(--text-3);
  font-weight: 500;
}

.amount--sm {
  font-size: 13px;
}

.amount--md {
  font-size: 15px;
}

.amount--lg {
  font-size: 20px;
}

.amount--xl {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.amount__label {
  font-size: 0.72em;
  font-weight: 600;
  margin-right: 2px;
  opacity: 0.85;
  font-family: var(--font-sans);
}
</style>
