<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue'

withDefaults(
  defineProps<{
    title: string
    desc?: string
    icon?: IconName
    compact?: boolean
  }>(),
  { desc: '', icon: 'sparkles', compact: false },
)
</script>

<template>
  <div class="empty" :class="{ 'empty--compact': compact }">
    <span class="empty__icon">
      <AppIcon :name="icon" :size="21" />
    </span>
    <p class="empty__title">{{ title }}</p>
    <p v-if="desc" class="empty__desc">{{ desc }}</p>
    <div v-if="$slots.default" class="empty__action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty--compact {
  padding: 22px 16px;
}

.empty__action {
  margin-top: 6px;
}
</style>
