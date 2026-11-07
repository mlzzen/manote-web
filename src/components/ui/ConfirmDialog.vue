<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    confirmText: string
    cancelText: string
    tone?: 'default' | 'danger'
    wide?: boolean
  }>(),
  { tone: 'default', wide: false },
)

const emit = defineEmits<{ close: []; confirm: [] }>()

function onKey(event: KeyboardEvent): void {
  if (!props.open) return
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="open" class="overlay" @click.self="emit('close')">
        <div class="modal" :class="{ 'modal--wide': wide }" role="dialog" aria-modal="true">
          <h2 class="modal__title">{{ title }}</h2>
          <div class="modal__body">
            <slot />
          </div>
          <div class="modal__foot">
            <button class="btn btn--ghost" type="button" @click="emit('close')">{{ cancelText }}</button>
            <button
              class="btn"
              :class="tone === 'danger' ? 'btn--danger' : 'btn--primary'"
              type="button"
              @click="emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.15s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
