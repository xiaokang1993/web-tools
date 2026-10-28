import { ref, watch, type Ref } from 'vue'

/**
 * 与 localStorage 同步的响应式状态。
 * 支持任意可序列化值，自动读/写。
 */
export function useLocalStorage<T>(key: string, initial: T): Ref<T> {
  let stored: T
  try {
    const raw = localStorage.getItem(key)
    stored = raw === null ? initial : (JSON.parse(raw) as T)
  } catch {
    stored = initial
  }

  const state = ref(stored) as Ref<T>

  watch(
    state,
    (val) => {
      try {
        localStorage.setItem(key, JSON.stringify(val))
      } catch {
        // 静默忽略写入失败（如隐私模式/配额）
      }
    },
    { deep: true }
  )

  return state
}
