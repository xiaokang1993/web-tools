<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, computed } from 'vue'
import type { Editor, EditorConfiguration } from 'codemirror'
import BackHome from '@/components/BackHome.vue'
import { useTheme } from '@/composables/useTheme'
import 'codemirror/lib/codemirror.js'
import 'codemirror/lib/codemirror.css'
import CodeMirror from 'codemirror'

interface DiffItem {
  path: string
  left: string
  right: string
  kind: 'added' | 'removed' | 'modified' | 'type-changed'
}

const { isDark, toggle: toggleTheme } = useTheme()

const leftRef = ref<HTMLTextAreaElement | null>(null)
const rightRef = ref<HTMLTextAreaElement | null>(null)
const leftEditor = shallowRef<Editor | null>(null)
const rightEditor = shallowRef<Editor | null>(null)

const diffs = ref<DiffItem[]>([])
const error = ref<string>('')

const stats = computed(() => {
  const s = { added: 0, removed: 0, modified: 0, 'type-changed': 0 }
  for (const d of diffs.value) s[d.kind] += 1
  return s
})
const total = computed(() => diffs.value.length)

function makeEditor(el: HTMLTextAreaElement): Editor {
  const cfg: EditorConfiguration = {
    mode: 'application/json',
    lineNumbers: true,
    lineWrapping: true,
    theme: isDark.value ? 'abcdef' : 'default',
    indentUnit: 2,
    tabSize: 2,
  }
  return CodeMirror.fromTextArea(el, cfg)
}

function escapeKey(v: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(v) ? v : JSON.stringify(v)
}

function pushDiff(item: DiffItem) {
  diffs.value.push(item)
}

function walk(left: unknown, right: unknown, path: string) {
  const lType = left === null ? 'null' : Array.isArray(left) ? 'array' : typeof left
  const rType = right === null ? 'null' : Array.isArray(right) ? 'array' : typeof right

  // Both arrays
  if (Array.isArray(left) && Array.isArray(right)) {
    const max = Math.max(left.length, right.length)
    for (let i = 0; i < max; i++) {
      const p = `${path}[${i}]`
      if (i >= left.length) {
        pushDiff({ path: p, left: '—', right: format(right[i]), kind: 'added' })
      } else if (i >= right.length) {
        pushDiff({ path: p, left: format(left[i]), right: '—', kind: 'removed' })
      } else {
        walk(left[i], right[i], p)
      }
    }
    return
  }

  // Both plain objects
  if (isPlainObject(left) && isPlainObject(right)) {
    const lObj = left as Record<string, unknown>
    const rObj = right as Record<string, unknown>
    const keys = new Set([...Object.keys(lObj), ...Object.keys(rObj)])
    for (const k of keys) {
      const p = path ? `${path}.${escapeKey(k)}` : escapeKey(k)
      const inL = Object.prototype.hasOwnProperty.call(lObj, k)
      const inR = Object.prototype.hasOwnProperty.call(rObj, k)
      if (inL && !inR) {
        pushDiff({ path: p, left: format(lObj[k]), right: '—', kind: 'removed' })
      } else if (!inL && inR) {
        pushDiff({ path: p, left: '—', right: format(rObj[k]), kind: 'added' })
      } else {
        walk(lObj[k], rObj[k], p)
      }
    }
    return
  }

  // Type mismatch
  if (lType !== rType) {
    pushDiff({
      path,
      left: format(left),
      right: format(right),
      kind: 'type-changed',
    })
    return
  }

  // Primitives
  if (left !== right) {
    pushDiff({
      path,
      left: format(left),
      right: format(right),
      kind: 'modified',
    })
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function format(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'function') return 'function'
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function compute() {
  diffs.value = []
  error.value = ''
  const lVal = leftEditor.value?.getValue() ?? ''
  const rVal = rightEditor.value?.getValue() ?? ''

  let lJson: unknown = undefined
  let rJson: unknown = undefined
  try {
    lJson = lVal.trim() ? JSON.parse(lVal) : undefined
  } catch (e) {
    error.value = `左侧 JSON 解析失败：${(e as Error).message}`
    return
  }
  try {
    rJson = rVal.trim() ? JSON.parse(rVal) : undefined
  } catch (e) {
    error.value = `右侧 JSON 解析失败：${(e as Error).message}`
    return
  }
  walk(lJson, rJson, '')
}

function formatJson(ed: Editor | null): string {
  if (!ed) return ''
  const v = ed.getValue()
  if (!v.trim()) return ''
  return JSON.stringify(JSON.parse(v), null, 2)
}

function onFormat() {
  try {
    const l = formatJson(leftEditor.value)
    const r = formatJson(rightEditor.value)
    if (l !== '') leftEditor.value?.setValue(l)
    if (r !== '') rightEditor.value?.setValue(r)
  } catch (e) {
    error.value = `格式化失败：${(e as Error).message}`
  }
}

function onCompact() {
  try {
    const l = formatJson(leftEditor.value)
    const r = formatJson(rightEditor.value)
    if (l !== '') leftEditor.value?.setValue(l.replace(/\s+/g, ''))
    if (r !== '') rightEditor.value?.setValue(r.replace(/\s+/g, ''))
  } catch (e) {
    error.value = `压缩失败：${(e as Error).message}`
  }
}

function onClear() {
  leftEditor.value?.setValue('')
  rightEditor.value?.setValue('')
  diffs.value = []
  error.value = ''
}

function onSwap() {
  const l = leftEditor.value?.getValue() ?? ''
  const r = rightEditor.value?.getValue() ?? ''
  leftEditor.value?.setValue(r)
  rightEditor.value?.setValue(l)
}

function applyTheme() {
  const t = isDark.value ? 'abcdef' : 'default'
  leftEditor.value?.setOption('theme', t)
  rightEditor.value?.setOption('theme', t)
}

function onThemeToggle() {
  toggleTheme()
}

onMounted(() => {
  if (leftRef.value) leftEditor.value = makeEditor(leftRef.value)
  if (rightRef.value) rightEditor.value = makeEditor(rightRef.value)

  const onChange = () => compute()
  leftEditor.value?.on('change', onChange)
  rightEditor.value?.on('change', onChange)
})

onUnmounted(() => {
  ;(leftEditor.value as unknown as { toTextArea?: () => void })?.toTextArea?.()
  ;(rightEditor.value as unknown as { toTextArea?: () => void })?.toTextArea?.()
  leftEditor.value = null
  rightEditor.value = null
})

// watch theme via effect
import { watchEffect } from 'vue'
watchEffect(() => {
  applyTheme()
})
</script>

<template>
  <BackHome title="JSON 对比" />
  <div class="jd-wrap">
    <div class="jd-toolbar">
      <div class="jd-stats">
        <span class="jd-stat jd-stat-total">
          共 <b>{{ total }}</b> 处
        </span>
        <span class="jd-stat jd-stat-add" title="新增">新增 {{ stats.added }}</span>
        <span class="jd-stat jd-stat-del" title="删除">删除 {{ stats.removed }}</span>
        <span class="jd-stat jd-stat-mod" title="修改">修改 {{ stats.modified }}</span>
        <span class="jd-stat jd-stat-type" title="类型变更">类型 {{ stats['type-changed'] }}</span>
      </div>
      <div class="jd-controls">
        <button @click="onFormat" title="格式化两侧 JSON">格式化</button>
        <button @click="onCompact" title="压缩两侧 JSON">压缩</button>
        <button @click="onSwap" title="交换左右内容">交换</button>
        <button @click="onClear" title="清空两侧内容">清空</button>
        <button @click="onThemeToggle" title="切换深浅色">🌗</button>
      </div>
    </div>

    <div class="jd-panes">
      <div class="jd-pane">
        <div class="jd-pane-label">左侧 JSON</div>
        <textarea ref="leftRef" placeholder='{"example": 1}'></textarea>
      </div>
      <div class="jd-pane">
        <div class="jd-pane-label">右侧 JSON</div>
        <textarea ref="rightRef" placeholder='{"example": 2}'></textarea>
      </div>
    </div>

    <div v-if="error" class="jd-error">{{ error }}</div>

    <div class="jd-result">
      <div class="jd-result-header">
        差异列表
        <span v-if="total === 0 && !error" class="jd-result-empty">无差异</span>
      </div>
      <div v-if="diffs.length === 0 && !error" class="jd-empty">输入两侧 JSON 后自动对比</div>
      <table v-else class="jd-table">
        <thead>
          <tr>
            <th class="jd-th-path">路径</th>
            <th class="jd-th-left">左侧</th>
            <th class="jd-th-right">右侧</th>
            <th class="jd-th-kind">类型</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in diffs" :key="i" :class="`jd-row jd-${d.kind}`">
            <td class="jd-td-path">{{ d.path }}</td>
            <td class="jd-td-left">{{ d.left }}</td>
            <td class="jd-td-right">{{ d.right }}</td>
            <td class="jd-td-kind">
              <span class="jd-badge" :class="`jd-badge-${d.kind}`">
                {{ d.kind === 'type-changed' ? '类型' : d.kind === 'added' ? '新增' : d.kind === 'removed' ? '删除' : '修改' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.jd-wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 16px 40px;
}

.jd-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.jd-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}

.jd-stat {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}

.jd-stat b {
  color: var(--fg);
}

.jd-stat-add {
  color: var(--success);
}

.jd-stat-del {
  color: var(--error);
}

.jd-stat-mod {
  color: var(--warning);
}

.jd-stat-type {
  color: #f97316;
}

.jd-controls {
  display: flex;
  gap: 6px;
}

.jd-controls button {
  cursor: pointer;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  transition: opacity 0.15s;
}

.jd-controls button:hover {
  opacity: 0.85;
}

.jd-panes {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.jd-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.jd-pane-label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}

.jd-pane :deep(.CodeMirror) {
  border: 1px solid var(--border);
  border-radius: 6px;
  height: 360px;
  font-size: 13px;
}

.jd-error {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--error);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
}

.jd-result {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
}

.jd-result-header {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  background: var(--accent-soft);
  color: var(--fg);
  display: flex;
  align-items: center;
  gap: 12px;
}

.jd-result-empty {
  font-weight: 400;
  font-size: 12px;
  color: var(--success);
}

.jd-empty {
  padding: 24px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.jd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.jd-table th {
  text-align: left;
  padding: 8px 12px;
  background: var(--bg);
  color: var(--muted);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.jd-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  word-break: break-all;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
}

.jd-th-path,
.jd-td-path {
  width: 28%;
}

.jd-th-left,
.jd-td-left,
.jd-th-right,
.jd-td-right {
  width: 30%;
}

.jd-th-kind,
.jd-td-kind {
  width: 12%;
}

.jd-row-added {
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.jd-row-removed {
  background: color-mix(in srgb, var(--error) 12%, transparent);
}

.jd-row-modified {
  background: color-mix(in srgb, var(--warning) 14%, transparent);
}

.jd-row-type-changed {
  background: color-mix(in srgb, #f97316 14%, transparent);
}

.jd-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #fff;
}

.jd-badge-added {
  background: var(--success);
}

.jd-badge-removed {
  background: var(--error);
}

.jd-badge-modified {
  background: var(--warning);
}

.jd-badge-type-changed {
  background: #f97316;
}

@media (max-width: 720px) {
  .jd-panes {
    flex-direction: column;
  }
  .jd-pane :deep(.CodeMirror) {
    height: 240px;
  }
}
</style>
