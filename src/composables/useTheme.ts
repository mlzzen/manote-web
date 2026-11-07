import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'manote.theme'

function readStored(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
}

const mode = ref<ThemeMode>(readStored())
const systemDark = ref(
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false,
)

if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    systemDark.value = event.matches
  })
}

const resolved = computed<'light' | 'dark'>(() =>
  mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
)

function apply(): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolved.value
}

apply()

export function useTheme() {
  function setMode(next: ThemeMode): void {
    mode.value = next
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, next)
    apply()
  }

  function toggle(): void {
    setMode(resolved.value === 'dark' ? 'light' : 'dark')
  }

  return { mode, resolved, setMode, toggle }
}
