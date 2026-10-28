<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'
import { useLocalStorage } from '@/composables/useLocalStorage'

type Priority = 'high' | 'medium' | 'low'

interface Todo {
  id: number
  text: string
  completed: boolean
  priority: Priority
  createdAt: string
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: '高', color: 'var(--error)' },
  { value: 'medium', label: '中', color: 'var(--warning)' },
  { value: 'low', label: '低', color: 'var(--success)' }
]

const priorityColor = (p: Priority): string =>
  PRIORITIES.find((it) => it.value === p)?.color ?? 'var(--muted)'

const todos = useLocalStorage<Todo[]>('todos', [])
type Filter = 'all' | 'active' | 'completed'
const filter = ref<Filter>('all')
const newText = ref('')
const newPriority = ref<Priority>('medium')
const editingId = ref<number | null>(null)
const editingText = ref('')
const editInputEl = ref<HTMLInputElement | null>(null)

const toast = ref('')

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string): void {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 1800)
}

const dateDisplay = computed(() => {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  return new Date().toLocaleDateString('zh-CN', opts)
})

const filteredTodos = computed(() => {
  if (filter.value === 'active') return todos.value.filter((t) => !t.completed)
  if (filter.value === 'completed') return todos.value.filter((t) => t.completed)
  return todos.value
})

const activeCount = computed(() => todos.value.filter((t) => !t.completed).length)
const completedCount = computed(() => todos.value.filter((t) => t.completed).length)

const emptyMessage = computed(() => {
  if (filter.value === 'completed') return '还没有已完成的任务'
  if (filter.value === 'active') return '太棒了！所有任务都已完成'
  return '开始添加你的第一个任务吧'
})

const emptyIcon = computed(() => (filter.value === 'completed' ? '📭' : '📝'))

function addTodo(): void {
  const text = newText.value.trim()
  if (!text) return
  const todo: Todo = {
    id: Date.now(),
    text,
    completed: false,
    priority: newPriority.value,
    createdAt: new Date().toISOString()
  }
  todos.value.unshift(todo)
  newText.value = ''
  newPriority.value = 'medium'
}

function toggleTodo(id: number): void {
  const todo = todos.value.find((t) => t.id === id)
  if (todo) todo.completed = !todo.completed
}

function deleteTodo(id: number): void {
  const idx = todos.value.findIndex((t) => t.id === id)
  if (idx !== -1) {
    todos.value.splice(idx, 1)
    showToast('已删除任务')
  }
}

function clearCompleted(): void {
  if (completedCount.value === 0) {
    showToast('没有已完成的任务')
    return
  }
  const n = completedCount.value
  todos.value = todos.value.filter((t) => !t.completed)
  showToast(`已清除 ${n} 个已完成任务`)
}

async function startEdit(todo: Todo): Promise<void> {
  if (todo.completed) return
  editingId.value = todo.id
  editingText.value = todo.text
  await nextTick()
  editInputEl.value?.focus()
  editInputEl.value?.select()
}

function saveEdit(): void {
  if (editingId.value === null) return
  const text = editingText.value.trim()
  const todo = todos.value.find((t) => t.id === editingId.value)
  if (todo) {
    if (text) {
      todo.text = text
    } else {
      // 文本清空则删除该任务
      const idx = todos.value.findIndex((t) => t.id === editingId.value)
      if (idx !== -1) todos.value.splice(idx, 1)
    }
  }
  editingId.value = null
  editingText.value = ''
}

function cancelEdit(): void {
  editingId.value = null
  editingText.value = ''
}

function cyclePriority(todo: Todo): void {
  const order: Priority[] = ['low', 'medium', 'high']
  const idx = order.indexOf(todo.priority)
  todo.priority = order[(idx + 1) % order.length]
}
</script>

<template>
  <BackHome title="我的待办" />
  <div class="todo-wrap">
    <div class="container">
      <header>
        <h1>我的待办</h1>
        <div class="date-display">{{ dateDisplay }}</div>
      </header>

      <div class="input-group">
        <select v-model="newPriority" class="priority-select" aria-label="新任务优先级">
          <option value="high">高优先级</option>
          <option value="medium">中优先级</option>
          <option value="low">低优先级</option>
        </select>
        <input
          v-model="newText"
          type="text"
          class="todo-input"
          placeholder="添加新任务... (按回车确认)"
          @keyup.enter="addTodo"
        />
        <button class="add-btn" aria-label="添加" @click="addTodo">+</button>
      </div>

      <div class="filters">
        <button
          class="filter-btn"
          :class="{ active: filter === 'all' }"
          @click="filter = 'all'"
        >
          全部
        </button>
        <button
          class="filter-btn"
          :class="{ active: filter === 'active' }"
          @click="filter = 'active'"
        >
          进行中
        </button>
        <button
          class="filter-btn"
          :class="{ active: filter === 'completed' }"
          @click="filter = 'completed'"
        >
          已完成
        </button>
      </div>

      <ul class="todo-list">
        <li v-if="filteredTodos.length === 0" class="empty-state">
          <span class="empty-icon">{{ emptyIcon }}</span>
          <p>{{ emptyMessage }}</p>
        </li>
        <li
          v-for="todo in filteredTodos"
          :key="todo.id"
          class="todo-item"
          :class="{ completed: todo.completed }"
        >
          <div
            class="checkbox"
            role="checkbox"
            :aria-checked="todo.completed"
            tabindex="0"
            @click="toggleTodo(todo.id)"
            @keyup.enter="toggleTodo(todo.id)"
          />
          <button
            class="priority-bar"
            :style="{ background: priorityColor(todo.priority) }"
            :title="`优先级：点击切换（当前 ${todo.priority}）`"
            :aria-label="`优先级 ${todo.priority}`"
            @click="cyclePriority(todo)"
          />
          <input
            v-if="editingId === todo.id"
            ref="editInputEl"
            v-model="editingText"
            class="edit-input"
            type="text"
            @keyup.enter="saveEdit"
            @keyup.esc="cancelEdit"
            @blur="saveEdit"
          />
          <span
            v-else
            class="todo-text"
            @dblclick="startEdit(todo)"
          >{{ todo.text }}</span>
          <button class="delete-btn" aria-label="删除" @click="deleteTodo(todo.id)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </li>
      </ul>

      <div class="stats">
        <span>{{ activeCount }} 个任务未完成</span>
        <button class="clear-btn" @click="clearCompleted">清除已完成</button>
      </div>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.todo-wrap {
  min-height: calc(100vh - 48px);
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.container {
  width: 100%;
  max-width: 540px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 30px;
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

header {
  margin-bottom: 24px;
  text-align: center;
}

h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 5px;
  color: var(--accent);
}

.date-display {
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 500;
}

.input-group {
  position: relative;
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
}

.priority-select {
  padding: 0 12px;
  border: 2px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 12px;
  font-size: 0.9rem;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}

.priority-select:focus {
  border-color: var(--accent);
}

.todo-input {
  flex: 1;
  padding: 16px 52px 16px 20px;
  border: 2px solid transparent;
  background: var(--bg);
  color: var(--fg);
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  outline: none;
}

.todo-input::placeholder {
  color: var(--muted);
}

.todo-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.add-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--accent);
  color: #fff;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: all 0.2s;
}

.add-btn:hover {
  filter: brightness(0.92);
  transform: translateY(-50%) scale(1.05);
}

.add-btn:active {
  transform: translateY(-50%) scale(0.95);
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border);
}

.filter-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-weight: 600;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 8px;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.filter-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
}

.todo-list {
  list-style: none;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 5px;
}

.todo-item {
  background: var(--bg);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--border);
  animation: fadeIn 0.3s ease-out;
}

.todo-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
}

.todo-item.completed {
  opacity: 0.7;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  color: var(--muted);
}

.checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkbox::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  transition: transform 0.2s;
}

.todo-item.completed .checkbox {
  background: var(--success);
  border-color: var(--success);
}

.todo-item.completed .checkbox::after {
  transform: translate(-50%, -50%) scale(1);
}

.priority-bar {
  width: 6px;
  height: 26px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: transform 0.15s;
}

.priority-bar:hover {
  transform: scaleX(1.4);
}

.todo-text {
  flex: 1;
  font-size: 1rem;
  line-height: 1.4;
  word-break: break-all;
  cursor: text;
}

.edit-input {
  flex: 1;
  font-size: 1rem;
  line-height: 1.4;
  padding: 6px 10px;
  border: 2px solid var(--accent);
  background: var(--surface);
  color: var(--fg);
  border-radius: 8px;
  outline: none;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  transition: all 0.2s;
  opacity: 0;
  display: flex;
  align-items: center;
}

.todo-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: var(--error);
  background: var(--accent-soft);
}

.empty-state {
  text-align: center;
  padding: 40px 0;
  color: var(--muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 10px;
  display: block;
  opacity: 0.6;
}

.stats {
  margin-top: 18px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--muted);
  font-size: 0.85rem;
}

.clear-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px 6px;
  border-radius: 6px;
}

.clear-btn:hover {
  color: var(--fg);
  background: var(--accent-soft);
}

.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--fg);
  color: var(--bg);
  padding: 10px 20px;
  border-radius: 24px;
  font-size: 0.9rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 50;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}
</style>
