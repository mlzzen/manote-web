<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    backTo?: string
    backLabel?: string
    eyebrow?: string
  }>(),
  { subtitle: '', backTo: '', backLabel: '', eyebrow: '' },
)

const { t } = useI18n()
const router = useRouter()

function goBack(): void {
  if (props.backTo) router.push(props.backTo)
}
</script>

<template>
  <header class="page-head">
    <div class="page-head__main">
      <button v-if="backTo" class="page-head__back" type="button" @click="goBack">
        <AppIcon name="chevron-left" :size="15" />
        {{ backLabel || t('action_back') }}
      </button>
      <p v-if="eyebrow" class="page-head__eyebrow">{{ eyebrow }}</p>
      <h1 class="page-head__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-head__subtitle">{{ subtitle }}</p>
    </div>
    <div class="page-head__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.page-head__main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.page-head__eyebrow {
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.page-head__title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.page-head__subtitle {
  font-size: 12.5px;
  color: var(--text-2);
  max-width: 760px;
}

.page-head__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: -5px;
  margin-bottom: 1px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  width: fit-content;
}

.page-head__back:hover {
  color: var(--text);
}

.page-head__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .page-head__title {
    font-size: 20px;
  }
}
</style>
