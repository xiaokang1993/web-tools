type AnyFn = (...args: never[]) => unknown

/**
 * 防抖函数：延迟 wait 毫秒执行，期间再次调用会重置计时。
 */
export function debounce<T extends AnyFn>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

/**
 * 防抖组合式函数。等同 debounce，保留命名以贴合组合式 API 风格。
 */
export const useDebounce = debounce
