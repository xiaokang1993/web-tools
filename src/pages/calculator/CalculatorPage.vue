<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useTheme } from '@/composables/useTheme'
import BackHome from '@/components/BackHome.vue'

interface HistoryItem {
  expr: string
  result: string
  at: number
}

const { isDark, toggle } = useTheme()

// 计算器状态
const current = ref('0')
const operand = ref<number | null>(null)
const operator = ref<string | null>(null)
const fresh = ref(true)

// 历史记录持久化（最近 20 条）
const history = useLocalStorage<HistoryItem[]>('calc:history', [])
const historyText = computed(() => {
  if (operator.value !== null && operand.value !== null) {
    return `${formatNum(operand.value)} ${displayOp(operator.value)}`
  }
  return ''
})

const MAX_HISTORY = 20

function formatNum(n: number): string {
  // 保留必要精度，避免浮点尾巴
  if (!isFinite(n)) return 'Error'
  const rounded = Math.round((n + Number.EPSILON) * 1e12) / 1e12
  return rounded.toString()
}

function displayOp(op: string): string {
  switch (op) {
    case '+': return '+'
    case '-': return '−'
    case '*': return '×'
    case '/': return '÷'
    default: return op
  }
}

function pushHistory(expr: string, result: string) {
  history.value.unshift({ expr, result, at: Date.now() })
  if (history.value.length > MAX_HISTORY) {
    history.value = history.value.slice(0, MAX_HISTORY)
  }
}

function update() {
  // current 是响应式，渲染自动更新；此函数仅为语义保留
}

function reset() {
  current.value = '0'
  operand.value = null
  operator.value = null
  fresh.value = true
}

function appendNum(num: string) {
  if (fresh.value) {
    current.value = ''
    fresh.value = false
  }
  if (num === '.' && current.value.includes('.')) return
  if (current.value === '0' && num !== '.') current.value = ''
  else if (current.value === '-0' && num !== '.') current.value = '-'
  current.value += num
}

function chooseOp(op: string) {
  if (!fresh.value && operand.value !== null && operator.value !== null) {
    compute()
  }
  operand.value = parseFloat(current.value)
  operator.value = op
  fresh.value = true
}

function compute() {
  if (operator.value === null || operand.value === null) return
  const curr = parseFloat(current.value)
  let result = 0
  switch (operator.value) {
    case '+': result = operand.value + curr; break
    case '-': result = operand.value - curr; break
    case '*': result = operand.value * curr; break
    case '/': result = operand.value / curr; break
  }
  const expr = `${formatNum(operand.value)} ${displayOp(operator.value)} ${formatNum(curr)}`
  const resultStr = formatNum(result)
  pushHistory(expr, resultStr)
  current.value = resultStr
  operator.value = null
  operand.value = null
  fresh.value = true
}

function backspace() {
  if (fresh.value) return
  if (current.value.length > 1) current.value = current.value.slice(0, -1)
  else current.value = '0'
  if (current.value === '-' || current.value === '') current.value = '0'
}

function toggleSign() {
  if (current.value === '0') return
  current.value = (parseFloat(current.value) * -1).toString()
}

function clearHistory() {
  history.value = []
}

// 键盘支持
function handleKeydown(e: KeyboardEvent) {
  const k = e.key
  if ((k >= '0' && k <= '9')) {
    appendNum(k)
  } else if (k === '.') {
    appendNum('.')
  } else if (k === '+' || k === '-' || k === '*' || k === '/') {
    chooseOp(k)
  } else if (k === 'Enter' || k === '=') {
    e.preventDefault()
    compute()
  } else if (k === 'Escape') {
    reset()
  } else if (k === 'Backspace') {
    backspace()
  } else if (k === '%') {
    // 百分比：当前值 / 100
    current.value = (parseFloat(current.value) / 100).toString()
    fresh.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="page">
    <BackHome title="计算器" />
    <div class="calc-wrap">
      <button class="theme-btn" :title="isDark ? '切换浅色' : '切换深色'" @click="toggle">
        {{ isDark ? '☀️' : '🌙' }}
      </button>

      <div class="calc">
        <div class="history-bar">{{ historyText }}</div>
        <div class="display">{{ current }}</div>
        <div class="keys">
          <button class="fun" @click="reset">C</button>
          <button class="fun" @click="backspace">⌫</button>
          <button class="fun" @click="toggleSign">±</button>
          <button class="op" @click="chooseOp('/')">÷</button>

          <button @click="appendNum('7')">7</button>
          <button @click="appendNum('8')">8</button>
          <button @click="appendNum('9')">9</button>
          <button class="op" @click="chooseOp('*')">×</button>

          <button @click="appendNum('4')">4</button>
          <button @click="appendNum('5')">5</button>
          <button @click="appendNum('6')">6</button>
          <button class="op" @click="chooseOp('-')">−</button>

          <button @click="appendNum('1')">1</button>
          <button @click="appendNum('2')">2</button>
          <button @click="appendNum('3')">3</button>
          <button class="op" @click="chooseOp('+')">+</button>

          <button class="zero" @click="appendNum('0')">0</button>
          <button @click="appendNum('.')">.</button>
          <button class="equal" @click="compute">=</button>
        </div>
      </div>

      <div v-if="history.length" class="history-list">
        <div class="history-head">
          <span>历史记录</span>
          <button class="clear-history" @click="clearHistory">清空</button>
        </div>
        <ul>
          <li v-for="item in history" :key="item.at">
            <span class="h-expr">{{ item.expr }} =</span>
            <span class="h-result">{{ item.result }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calc-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
}

.theme-btn {
  position: absolute;
  top: 8px;
  right: 16px;
  font-size: 22px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg);
  height: auto;
  padding: 4px;
}

.calc {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border-radius: 18px;
  padding: 16px;
  box-shadow: 0 2px 6px rgba(60, 64, 67, 0.15);
}

:global(html.dark) .calc {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}

.display {
  background: var(--surface);
  border-radius: 10px;
  margin-bottom: 10px;
  padding: 10px 14px;
  text-align: right;
  font-size: 2.2rem;
  word-break: break-all;
  color: var(--fg);
}

.history-bar {
  font-size: 0.9rem;
  color: var(--fg);
  opacity: 0.7;
  height: 20px;
  margin-bottom: 4px;
  text-align: right;
}

.keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.keys button {
  border: none;
  border-radius: 12px;
  font-size: 1.3rem;
  height: 60px;
  cursor: pointer;
  background: var(--accent-soft);
  color: var(--fg);
  transition: transform 0.1s, background 0.1s;
}

.keys button:active {
  transform: scale(0.95);
}

.keys .op {
  background: var(--border);
}

.keys .fun {
  background: var(--muted);
}

.keys .equal {
  background: var(--accent);
  color: #fff;
}

.keys .zero {
  grid-column: span 2;
}

.keys button:focus {
  outline: none;
}

/* 历史记录列表 */
.history-list {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 2px 6px rgba(60, 64, 67, 0.1);
}

:global(html.dark) .history-list {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 8px;
}

.clear-history {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 0.8rem;
  padding: 2px 6px;
  height: auto;
}

.clear-history:hover {
  color: var(--error);
}

.history-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}

.history-list li {
  display: flex;
  justify-content: space-between;
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.history-list li:last-child {
  border-bottom: none;
}

.h-expr {
  color: var(--muted);
}

.h-result {
  color: var(--fg);
  font-weight: 600;
}
</style>
