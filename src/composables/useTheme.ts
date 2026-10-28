import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export type Theme = 'light' | 'dark'

export interface ThemeApi {
  theme: Ref<Theme>
  isDark: ComputedRef<boolean>
  toggle: () => void
}

/**
 * 全局暗色主题管理：持久化到 localStorage，同步 html.dark class。
 */
export function useTheme(): ThemeApi {
  const theme = ref<Theme>(
    (localStorage.getItem('theme') as Theme) ||
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  )

  const apply = (t: Theme) => {
    const root = document.documentElement
    if (t === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', t)
  }

  const toggle = () => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  const isDark = computed(() => theme.value === 'dark')

  watch(theme, (t) => apply(t), { immediate: true })

  return { theme, isDark, toggle }
}
