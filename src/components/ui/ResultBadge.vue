<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const props = withDefaults(defineProps<{ minor: number; compact?: boolean }>(), { compact: false })
const { t } = useI18n()

const tone = computed(() => (props.minor > 0 ? 'win' : props.minor < 0 ? 'loss' : 'draw'))
const label = computed(() =>
  props.minor > 0 ? t('result_win') : props.minor < 0 ? t('result_loss') : t('result_draw'),
)
</script>

<template>
  <span class="chip result" :class="[`chip--${tone}`, { 'result--compact': compact }]">{{ label }}</span>
</template>

<style scoped>
.result {
  justify-content: center;
  min-width: 42px;
}

.result--compact {
  min-width: 0;
  height: 20px;
  padding: 0 6px;
  font-size: 10.5px;
}
</style>
