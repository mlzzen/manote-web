<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue'

withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    icon?: IconName
    tone?: 'default' | 'win' | 'loss' | 'draw' | 'gold'
  }>(),
  { hint: '', icon: 'chart', tone: 'default' },
)
</script>

<template>
  <section class="tile">
    <header class="tile__head">
      <span class="tile__label">{{ label }}</span>
      <span class="tile__icon"><AppIcon :name="icon" :size="14" /></span>
    </header>
    <p class="tile__value num" :class="`tile__value--${tone}`">{{ value }}</p>
    <p v-if="hint" class="tile__hint">{{ hint }}</p>
    <slot />
  </section>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: var(--shadow-sm);
  min-width: 0;
}

.tile__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tile__label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-2);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile__icon {
  color: var(--text-3);
  flex: none;
}

.tile__value {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.tile__value--win {
  color: var(--win);
}

.tile__value--loss {
  color: var(--loss);
}

.tile__value--draw {
  color: var(--draw);
}

.tile__value--gold {
  color: var(--draw);
}

.tile__hint {
  font-size: 11.5px;
  color: var(--text-3);
  line-height: 1.45;
}
</style>
