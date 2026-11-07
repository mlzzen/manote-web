import { computed, ref } from 'vue'
import { en, zh, type MessageKey } from './messages'

export type Locale = 'zh-CN' | 'en'

const LOCALE_KEY = 'manote.locale'

/** 界面语言跟随浏览器：中文设备用中文，其余用英文。 */
function detectLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(LOCALE_KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || 'zh-CN'
    if (lang.toLowerCase().startsWith('zh')) return 'zh-CN'
    return 'en'
  }
  return 'zh-CN'
}

const locale = ref<Locale>(detectLocale())

export function setLocale(next: Locale): void {
  locale.value = next
  if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, next)
  if (typeof document !== 'undefined') document.documentElement.lang = next
}

/** 把 `{0}`、`{1}` 换成实际参数。 */
export function format(template: string, params?: readonly (string | number)[]): string {
  if (!params || params.length === 0) return template
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = params[Number.parseInt(index, 10)]
    return value === undefined ? match : String(value)
  })
}

export function translate(key: MessageKey, params?: readonly (string | number)[], override?: Locale): string {
  const dict = (override ?? locale.value) === 'zh-CN' ? zh : en
  return format(dict[key] ?? key, params)
}

/** 组件内使用：`const { t, locale, setLocale } = useI18n()`。 */
export function useI18n() {
  const t = (key: MessageKey, params?: readonly (string | number)[]) => translate(key, params)
  const isZh = computed(() => locale.value === 'zh-CN')
  return { t, locale, setLocale, isZh }
}

export { locale }
export type { MessageKey }
