<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    note?: string
    flush?: boolean
    tone?: 'default' | 'plain'
  }>(),
  { title: '', note: '', flush: false, tone: 'default' },
)
</script>

<template>
  <section class="panel" :class="{ 'panel--flush': flush, 'panel--plain': tone === 'plain' }">
    <header v-if="title || $slots.actions || $slots.title" class="panel__head">
      <div class="panel__title">
        <slot name="title">{{ title }}</slot>
        <slot name="badge" />
      </div>
      <div v-if="$slots.actions" class="panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
    <p v-if="note" class="panel__note">{{ note }}</p>
  </section>
</template>

<style scoped>
.panel--plain {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  backdrop-filter: none;
}
</style>
