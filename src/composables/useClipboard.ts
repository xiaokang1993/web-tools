import { ref, type Ref } from 'vue'

export interface ClipboardResult {
  copied: Ref<boolean>
  copy: (text: string) => Promise<void>
}

/**
 * 复制到剪贴板，带最近结果状态。
 */
export function useClipboard(): ClipboardResult {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // 降级：使用旧版 execCommand
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        // 忽略不支持
      }
      document.body.removeChild(ta)
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
    }, 1500)
  }

  return { copied, copy }
}
