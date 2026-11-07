<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/ui/AppIcon.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Panel from '@/components/ui/Panel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useI18n, type MessageKey } from '@/i18n'
import { useToast } from '@/composables/useToast'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useDataStore } from '@/stores/data'
import { APP_VERSION } from '@/app/version'
import {
  buildBackup,
  decodeBackup,
  encodeBackup,
  suggestedBackupFileName,
  validateBackup,
  type BackupRejectReason,
  type BackupSummary,
} from '@/data/backup'
import { downloadText, pickTextFile } from '@/data/fileTransfer'
import { createSampleData } from '@/data/sample'
import { MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH, textLength } from '@/domain/sessionRules'
import type { ManoteData } from '@/domain/types'

const { t, locale, setLocale } = useI18n()
const { show, error: showError } = useToast()
const { mode, setMode } = useTheme()
const store = useDataStore()
const router = useRouter()

// ————————————————————— 只读摘要 —————————————————————

const sessionCount = computed(() => store.activeSessions.length)
const friendCount = computed(() => store.friends.length)
const trashCount = computed(() => store.trashedSessions.length)
const selfNickname = computed(() => store.self?.nickname ?? t('default_self_nickname'))
const avatarInitial = computed(() => [...selfNickname.value][0]?.toUpperCase() ?? '')
const appMark = computed(() => [...t('app_name')][0] ?? '')

// 这几处没有单独的文案 key，按界面语言给一组短标签。
const preferencesTitle = computed(() => (locale.value === 'zh-CN' ? '偏好设置' : 'Preferences'))
const themeLabel = computed(() => (locale.value === 'zh-CN' ? '主题' : 'Theme'))
const demoLabel = computed(() => (locale.value === 'zh-CN' ? '演示' : 'Demo'))
const sampleActionLabel = computed(() => (locale.value === 'zh-CN' ? '载入示例数据' : 'Load sample data'))
const sampleLoadedMessage = computed(() => (locale.value === 'zh-CN' ? '示例数据已载入' : 'Sample data loaded'))

const themeOptions = computed<{ value: ThemeMode; label: string }[]>(() => {
  const zh = locale.value === 'zh-CN'
  return [
    { value: 'light', label: zh ? '浅色' : 'Light' },
    { value: 'dark', label: zh ? '深色' : 'Dark' },
    { value: 'system', label: zh ? '跟随系统' : 'System' },
  ]
})

// ————————————————————— 修改昵称 —————————————————————

const renameOpen = ref(false)
const renameValue = ref('')
const renameError = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

watch(renameOpen, async (open) => {
  if (!open) return
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
})

function openRename(): void {
  renameValue.value = selfNickname.value
  renameError.value = ''
  renameOpen.value = true
}

function submitRename(): void {
  const nickname = renameValue.value.trim()
  const length = textLength(nickname)
  if (length < MIN_NICKNAME_LENGTH || length > MAX_NICKNAME_LENGTH) {
    renameError.value = t('error_invalid_nickname')
    return
  }
  // 全新的本机还没有本人档案：先建再改名，避免「修改昵称」在空库上直接失败。
  const result = store.self ? store.renameSelf(nickname) : store.ensureSelf(nickname)
  if (!result.ok) {
    renameError.value = t('error_invalid_nickname')
    return
  }
  renameError.value = ''
  renameOpen.value = false
}

function onRenameEnter(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  submitRename()
}

// ————————————————————— 备份导入 / 导出 —————————————————————

/** 备份拒绝原因 → 文案 key。写成表而不是拼字符串，新增原因时编译器会提醒补文案。 */
const BACKUP_REJECT_KEYS: Record<BackupRejectReason, MessageKey> = {
  UNSUPPORTED_VERSION: 'backup_reject_unsupported_version',
  TOO_LARGE: 'backup_reject_too_large',
  MALFORMED: 'backup_reject_malformed',
  INVALID_SELF: 'backup_reject_invalid_self',
  INVALID_ID: 'backup_reject_invalid_id',
  ORPHAN_REFERENCE: 'backup_reject_orphan_reference',
  INCOMPLETE_SEATS: 'backup_reject_incomplete_seats',
  KIND_MISMATCH: 'backup_reject_kind_mismatch',
  AMOUNT_OUT_OF_RANGE: 'backup_reject_amount_out_of_range',
  INVALID_TEXT: 'backup_reject_invalid_text',
  INVALID_TIME: 'backup_reject_invalid_time',
  INVALID_DURATION: 'backup_reject_invalid_duration',
  INVALID_REVISION: 'backup_reject_invalid_revision',
  LIMIT_EXCEEDED: 'backup_reject_limit_exceeded',
}

interface PendingImport {
  summary: BackupSummary
  data: ManoteData
}

const working = ref(false)
const pendingImport = ref<PendingImport | null>(null)

function exportBackup(): void {
  if (working.value) return
  working.value = true
  try {
    const file = buildBackup(store.data, APP_VERSION)
    downloadText(encodeBackup(file), suggestedBackupFileName(), 'application/json')
    show(t('settings_export_success'))
  } catch {
    showError(t('settings_export_failed'))
  } finally {
    working.value = false
  }
}

async function importBackup(): Promise<void> {
  if (working.value) return
  working.value = true
  try {
    const text = await pickTextFile('.json,application/json')
    if (text === null) {
      showError(t('settings_import_read_failed'))
      return
    }
    const file = decodeBackup(text)
    if (file === null) {
      showError(t('settings_import_read_failed'))
      return
    }
    const result = validateBackup(file)
    if (!result.ok) {
      showError(t(BACKUP_REJECT_KEYS[result.reason]))
      return
    }
    // 先问再写：确认框里要摆清楚现在有什么、导入后会变成什么。
    pendingImport.value = { summary: result.summary, data: result.data }
  } catch {
    showError(t('settings_import_failed'))
  } finally {
    working.value = false
  }
}

function confirmImport(): void {
  const pending = pendingImport.value
  if (!pending) return
  const result = store.replaceAll(pending.data)
  pendingImport.value = null
  if (result.ok) show(t('settings_import_success'))
  else showError(t('settings_import_failed'))
}

// ————————————————————— 清空 / 示例 —————————————————————

const clearOpen = ref(false)

function confirmClear(): void {
  store.eraseAll()
  // 清空后立刻补回本人档案：否则首页与记一场都会处于「没有我」的状态。
  store.ensureSelf(t('default_self_nickname'))
  clearOpen.value = false
  show(t('settings_clear_success'))
  void router.push('/')
}

function loadSample(): void {
  if (working.value) return
  const result = store.replaceAll(createSampleData())
  if (result.ok) show(sampleLoadedMessage.value)
  else showError(t('settings_import_failed'))
}

function openTrash(): void {
  void router.push('/trash')
}
</script>

<template>
  <div class="settings">
    <PageHeader :title="t('nav_settings')" :subtitle="t('app_tagline')">
      <template #actions>
        <span class="chip chip--outline num">{{ t('settings_version_format', [APP_VERSION]) }}</span>
      </template>
    </PageHeader>

    <div class="settings__grid">
      <!-- 左栏：本人档案、偏好、数据管理 -->
      <div class="settings__col">
        <section class="profile">
          <div class="profile__glow" aria-hidden="true" />
          <div class="profile__avatar" aria-hidden="true">{{ avatarInitial }}</div>
          <div class="profile__main">
            <p class="profile__label">{{ t('settings_profile_title') }}</p>
            <p class="profile__name truncate">{{ selfNickname }}</p>
            <div class="profile__chips">
              <span class="profile__chip">{{ t('home_hero_sessions_format', [sessionCount]) }}</span>
              <span class="profile__chip">{{ t('friends_count_format', [friendCount]) }}</span>
            </div>
          </div>
          <button class="btn profile__action" type="button" @click="openRename">
            <AppIcon name="edit" :size="14" />
            {{ t('settings_rename_action') }}
          </button>
        </section>

        <Panel :title="preferencesTitle">
          <div class="prefs">
            <div class="pref">
              <span class="pref__label">{{ t('settings_language_action') }}</span>
              <div class="segmented" role="group" :aria-label="t('settings_language_action')">
                <button
                  class="segmented__item"
                  type="button"
                  :aria-pressed="locale === 'zh-CN'"
                  @click="setLocale('zh-CN')"
                >
                  {{ t('settings_language_zh') }}
                </button>
                <button
                  class="segmented__item"
                  type="button"
                  :aria-pressed="locale === 'en'"
                  @click="setLocale('en')"
                >
                  {{ t('settings_language_en') }}
                </button>
              </div>
            </div>
            <div class="pref">
              <span class="pref__label">{{ themeLabel }}</span>
              <div class="segmented" role="group" :aria-label="themeLabel">
                <button
                  v-for="option in themeOptions"
                  :key="option.value"
                  class="segmented__item"
                  type="button"
                  :aria-pressed="mode === option.value"
                  @click="setMode(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>
        </Panel>

        <Panel :title="t('settings_data_title')">
          <template #actions>
            <span v-if="working" class="chip chip--draw">{{ t('settings_data_working') }}</span>
          </template>
          <p class="data-counts num">{{ t('settings_data_current_format', [sessionCount, friendCount]) }}</p>
          <p class="panel__note">{{ t('settings_data_desc') }}</p>
          <div class="data-actions">
            <button class="btn btn--primary" type="button" :disabled="working" @click="exportBackup()">
              <AppIcon name="download" :size="15" />
              {{ t('settings_export_action') }}
            </button>
            <button class="btn btn--ghost" type="button" :disabled="working" @click="importBackup()">
              <AppIcon name="upload" :size="15" />
              {{ t('settings_import_action') }}
            </button>
          </div>
          <div class="divider" />
          <div class="data-foot">
            <div class="demo-row">
              <span class="chip chip--outline">{{ demoLabel }}</span>
              <button class="btn btn--sm btn--ghost" type="button" :disabled="working" @click="loadSample()">
                <AppIcon name="sparkles" :size="13" />
                {{ sampleActionLabel }}
              </button>
            </div>
            <button class="btn btn--sm btn--danger" type="button" :disabled="working" @click="clearOpen = true">
              <AppIcon name="trash" :size="13" />
              {{ t('settings_clear_action') }}
            </button>
          </div>
        </Panel>
      </div>

      <!-- 右栏：回收站与关于 -->
      <div class="settings__col">
        <Panel :title="t('bin_title')">
          <template #actions>
            <span class="chip num">{{ trashCount }}</span>
          </template>
          <p class="panel__note">{{ t('settings_recycle_bin_desc', [trashCount]) }}</p>
          <button class="btn btn--ghost btn--block" type="button" @click="openTrash">
            <AppIcon name="restore" :size="15" />
            {{ t('settings_recycle_bin_action') }}
            <AppIcon name="chevron-right" :size="14" class="btn__tail" />
          </button>
        </Panel>

        <Panel :title="t('settings_about_title')">
          <div class="about-brand">
            <span class="about-brand__mark" aria-hidden="true">{{ appMark }}</span>
            <div class="about-brand__text">
              <p class="about-brand__name">{{ t('app_name') }}</p>
              <p class="about-brand__tagline">{{ t('app_tagline') }}</p>
            </div>
          </div>
          <p class="panel__note">{{ t('settings_about_body') }}</p>
          <span class="chip chip--outline">{{ t('settings_version_format', [APP_VERSION]) }}</span>
        </Panel>
      </div>
    </div>

    <!-- 修改昵称 -->
    <ConfirmDialog
      :open="renameOpen"
      :title="t('settings_rename_title')"
      :confirm-text="t('action_save')"
      :cancel-text="t('action_cancel')"
      @close="renameOpen = false"
      @confirm="submitRename"
    >
      <label class="field">
        <span class="field__label">{{ t('friend_nickname_label') }}</span>
        <input
          ref="renameInput"
          v-model="renameValue"
          class="input"
          type="text"
          autocomplete="off"
          :aria-invalid="renameError.length > 0"
          @input="renameError = ''"
          @keydown.enter="onRenameEnter"
        />
      </label>
      <p class="field__hint">{{ t('settings_rename_hint') }}</p>
      <p v-if="renameError" class="field__error">{{ renameError }}</p>
    </ConfirmDialog>

    <!-- 导入确认：覆盖前先列清楚两边的数量与本人昵称 -->
    <ConfirmDialog
      :open="pendingImport !== null"
      :title="t('settings_import_confirm_title')"
      :confirm-text="t('settings_import_confirm_action')"
      :cancel-text="t('action_cancel')"
      @close="pendingImport = null"
      @confirm="confirmImport"
    >
      <template v-if="pendingImport">
        <p>{{ t('settings_import_confirm_current_format', [sessionCount, friendCount]) }}</p>
        <p>{{ t('settings_import_confirm_incoming_format', [pendingImport.summary.sessionCount, pendingImport.summary.friendCount]) }}</p>
        <p>{{ t('settings_import_confirm_self_format', [pendingImport.summary.selfNickname]) }}</p>
        <p class="alert alert--danger">
          <AppIcon name="alert" :size="14" />
          <span>{{ t('settings_import_confirm_warning') }}</span>
        </p>
      </template>
    </ConfirmDialog>

    <!-- 清空本机数据 -->
    <ConfirmDialog
      :open="clearOpen"
      :title="t('settings_clear_title')"
      :confirm-text="t('settings_clear_confirm')"
      :cancel-text="t('action_cancel')"
      tone="danger"
      @close="clearOpen = false"
      @confirm="confirmClear"
    >
      <p>{{ t('settings_clear_message') }}</p>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.settings {
  max-width: var(--maxw);
  margin: 0 auto;
}

.settings__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
  gap: 16px;
  align-items: start;
}

.settings__col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* ————————————————— 本人档案 ————————————————— */

.profile {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  min-width: 0;
  padding: 22px 24px;
  border-radius: var(--radius-xl);
  background: linear-gradient(165deg, var(--hero-top) 0%, var(--hero) 46%, var(--hero-bottom) 100%);
  color: var(--on-hero);
  box-shadow: var(--shadow-md);
}

.profile__glow {
  position: absolute;
  top: -70%;
  right: -8%;
  width: 55%;
  padding-bottom: 55%;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--on-hero) 16%, transparent), transparent 66%);
  pointer-events: none;
}

.profile__avatar {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 17px;
  background: var(--hero-chip);
  color: var(--on-hero-chip);
  font-size: 24px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--on-hero) 18%, transparent);
}

.profile__main {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.profile__label {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.09em;
  color: var(--on-hero-muted);
}

.profile__name {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.profile__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.profile__chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--on-hero) 12%, transparent);
  color: var(--on-hero-chip);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.profile .profile__action {
  position: relative;
  margin-left: auto;
  border-color: color-mix(in srgb, var(--on-hero-chip) 24%, transparent);
  background: color-mix(in srgb, var(--hero-chip) 76%, transparent);
  color: var(--on-hero-chip);
}

.profile .profile__action:hover {
  background: var(--hero-chip);
  color: var(--on-hero);
}

/* ————————————————— 偏好 ————————————————— */

.prefs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pref {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.pref + .pref {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.pref__label {
  font-size: 13px;
  font-weight: 600;
}

/* ————————————————— 数据管理 ————————————————— */

.data-counts {
  font-size: 13.5px;
  font-weight: 650;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.data-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.demo-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn__tail {
  margin-left: auto;
}

/* ————————————————— 关于 ————————————————— */

.about-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.about-brand__mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(160deg, var(--hero-top), var(--hero-bottom));
  color: var(--on-hero);
  font-size: 18px;
  font-weight: 700;
}

.about-brand__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.about-brand__name {
  font-size: 13.5px;
  font-weight: 700;
}

.about-brand__tagline {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-3);
}

@media (max-width: 1024px) {
  .settings__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .profile {
    gap: 12px;
    padding: 18px;
  }

  .profile__name {
    font-size: 21px;
  }

  .profile .profile__action {
    width: 100%;
    margin-left: 0;
  }

  .pref {
    align-items: flex-start;
    flex-direction: column;
  }

  .pref .segmented {
    display: flex;
    width: 100%;
  }

  .pref .segmented__item {
    flex: 1;
  }
}
</style>
