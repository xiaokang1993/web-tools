<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import BackHome from '@/components/BackHome.vue'
import { useLocalStorage } from '@/composables/useLocalStorage'

interface ReaderSettings {
  fontSize: number
  letterSpacing: number
  lineHeight: number
  paragraphSpacing: number
  theme: string
}

interface BookProgress {
  [fileName: string]: number
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 20,
  letterSpacing: 0,
  lineHeight: 1.9,
  paragraphSpacing: 1.0,
  theme: 'default'
}

const settings = useLocalStorage<ReaderSettings>('reader-settings', DEFAULT_SETTINGS)
const progress = useLocalStorage<BookProgress>('reader-progress', {})

const currentFileName = ref('')
const currentContent = ref('')
const currentPage = ref(1)
const totalPages = ref(0)
const chapters = ref<{ title: string; pIndex: number }[]>([])
const paragraphs = ref<string[]>([])
const pages = ref<string[][]>([])
const showSettings = ref(false)
const showCatalog = ref(false)
const searchVisible = ref(false)
const searchTerm = ref('')
const searchResults = ref<number[]>([])
const searchIndex = ref(-1)
const isPaginating = ref(false)
const rulerRef = ref<HTMLElement | null>(null)
const pageContainerRef = ref<HTMLElement | null>(null)

const themeClass = computed(() => {
  if (settings.value.theme === 'default') return ''
  return settings.value.theme
})

const pageVars = computed(() => ({
  '--r-font-size': `${settings.value.fontSize}px`,
  '--r-line-height': String(settings.value.lineHeight),
  '--r-letter-spacing': `${settings.value.letterSpacing}px`,
  '--r-paragraph-spacing': `${settings.value.paragraphSpacing}em`
}))

const currentPageContent = computed(() => pages.value[currentPage.value - 1] ?? [])
const pageInfo = computed(() => {
  if (totalPages.value === 0) return '-- / -- 页'
  return `${currentPage.value} / ${totalPages.value} 页`
})

const chapterInfo = computed(() => {
  if (chapters.value.length === 0) return ''
  const pageStartPIndex = pages.value[currentPage.value - 1]?.[0]
  if (pageStartPIndex === undefined) return ''
  const idx = paragraphs.value.indexOf(pageStartPIndex)
  let current = null as { title: string; pIndex: number } | null
  for (let i = chapters.value.length - 1; i >= 0; i--) {
    if (chapters.value[i].pIndex <= idx) {
      current = chapters.value[i]
      break
    }
  }
  return current?.title ?? ''
})

const fileInput = ref<HTMLInputElement | null>(null)

const onFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result ?? '')
    currentFileName.value = file.name
    currentContent.value = text
    prepareContent(text)
    nextTick(() => paginate())
  }
  reader.readAsText(file, 'UTF-8')
  target.value = ''
}

const prepareContent = (text: string) => {
  const lines = text.split(/\r?\n/)
  paragraphs.value = lines
  chapters.value = []
  const chapterRegex = /^(第\s*[一二三四五六七八九十百千\d\s]+[章回节卷])|^(Chapter\s+\d+)|(^\d{1,3}\s+)/
  lines.forEach((line, i) => {
    if (chapterRegex.test(line.trim())) {
      chapters.value.push({ title: line.trim(), pIndex: i })
    }
  })
}

const paginate = () => {
  const ruler = rulerRef.value
  const container = pageContainerRef.value
  if (!ruler || !container) return
  isPaginating.value = true
  ruler.style.width = `${container.clientWidth}px`
  ruler.style.height = `${container.clientHeight}px`
  pages.value = []
  let current: string[] = []

  for (const p of paragraphs.value) {
    const trimmed = p.trim()
    if (current.length === 0 && trimmed === '') continue
    ruler.innerText = current.concat([p]).join('\n')
    if (ruler.scrollHeight > ruler.clientHeight && current.length > 0) {
      pages.value.push(current)
      current = trimmed === '' ? [] : [p]
    } else {
      current.push(p)
    }
  }
  if (current.length > 0) pages.value.push(current)
  totalPages.value = pages.value.length

  const saved = progress.value[currentFileName.value]
  currentPage.value = saved && saved <= totalPages.value ? saved : 1
  isPaginating.value = false
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    saveProgress()
  }
}
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    saveProgress()
  }
}
const jumpToPage = (p: number) => {
  if (p >= 1 && p <= totalPages.value) {
    currentPage.value = p
    saveProgress()
  }
}
const saveProgress = () => {
  if (currentFileName.value) {
    progress.value = { ...progress.value, [currentFileName.value]: currentPage.value }
  }
}

const onPageClick = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  if (x < rect.width / 3) prevPage()
  else nextPage()
}

const searchAll = () => {
  const term = searchTerm.value.trim()
  if (!term) return
  searchResults.value = []
  paragraphs.value.forEach((p, i) => {
    if (p.includes(term)) searchResults.value.push(i)
  })
  searchIndex.value = searchResults.value.length > 0 ? 0 : -1
  if (searchResults.value.length > 0) {
    jumpToParagraph(searchResults.value[0])
  }
}
const searchPrev = () => {
  if (searchIndex.value > 0) {
    searchIndex.value--
    jumpToParagraph(searchResults.value[searchIndex.value])
  }
}
const searchNext = () => {
  if (searchIndex.value < searchResults.value.length - 1) {
    searchIndex.value++
    jumpToParagraph(searchResults.value[searchIndex.value])
  }
}
const jumpToParagraph = (pIndex: number) => {
  for (let i = 0; i < pages.value.length; i++) {
    if (pages.value[i].includes(paragraphs.value[pIndex])) {
      jumpToPage(i + 1)
      break
    }
  }
}

const resetSetting = (key: keyof ReaderSettings) => {
  settings.value = { ...settings.value, [key]: DEFAULT_SETTINGS[key] }
}
const factoryReset = () => {
  settings.value = { ...DEFAULT_SETTINGS }
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowLeft') prevPage()
  else if (e.key === 'ArrowRight') nextPage()
  else if (e.key === 'Escape') {
    showSettings.value = false
    showCatalog.value = false
    searchVisible.value = false
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

watch(() => settings.value.fontSize, () => {
  if (currentFileName.value) nextTick(() => paginate())
})
watch(() => settings.value.lineHeight, () => {
  if (currentFileName.value) nextTick(() => paginate())
})
</script>

<template>
  <div :class="['reader-root', themeClass]" :style="pageVars">
    <BackHome title="纯文本阅读器" />
    <input ref="fileInput" type="file" accept=".txt" style="display: none" @change="onFileChange" />

    <div class="reader-container">
      <header>
        <p class="filename">{{ currentFileName || '请选择文件开始阅读' }}</p>
        <div class="controls">
          <button class="ctrl-btn" @click="fileInput?.click()">打开文件</button>
          <button class="ctrl-btn" @click="searchVisible = !searchVisible">搜索</button>
          <button class="ctrl-btn" @click="showSettings = true">设置</button>
          <button v-if="chapters.length" class="ctrl-btn" @click="showCatalog = true">目录</button>
          <select v-model="settings.theme" class="ctrl-btn">
            <option value="default">默认护眼</option>
            <option value="theme-dark">暗黑模式</option>
            <option value="theme-green">护眼绿</option>
            <option value="theme-blue">静谧蓝</option>
            <option value="theme-gray">简约灰</option>
          </select>
        </div>
      </header>

      <div v-if="searchVisible" class="search-bar">
        <input v-model="searchTerm" type="text" placeholder="输入关键词..." @keyup.enter="searchAll" />
        <button class="ctrl-btn" @click="searchAll">全文</button>
        <button class="ctrl-btn" :disabled="searchIndex <= 0" @click="searchPrev">&lt;</button>
        <button class="ctrl-btn" :disabled="searchIndex >= searchResults.length - 1" @click="searchNext">&gt;</button>
        <span class="search-info">
          {{ searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : '无结果' }}
        </span>
        <button class="ctrl-btn close-search" @click="searchVisible = false">×</button>
      </div>

      <main ref="pageContainerRef" class="content-wrapper" @click="onPageClick">
        <div v-if="!currentFileName" class="empty-page">
          <p>请选择一个 .txt 文件开始阅读</p>
        </div>
        <div v-else class="page">
          <p
            v-for="(p, i) in currentPageContent"
            :key="i"
            :class="{ 'chapter-title': chapters.some(c => paragraphs.indexOf(p) === c.pIndex) }"
          >{{ p }}</p>
        </div>
      </main>

      <footer>
        <span class="chapter-info">{{ chapterInfo }}</span>
        <span class="page-info" @click="showCatalog = true">{{ pageInfo }}</span>
      </footer>
    </div>

    <div v-show="showSettings" class="modal" @click.self="showSettings = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>阅读设置</h2>
          <button class="close-btn" @click="showSettings = false">×</button>
        </div>
        <div class="settings-list">
          <div class="setting-item font-control">
            <span>字号</span>
            <input type="range" min="12" max="36" step="1" v-model.number="settings.fontSize" />
            <span class="slider-value">{{ settings.fontSize }}px</span>
            <button class="ctrl-btn reset-btn" @click="resetSetting('fontSize')">重置</button>
          </div>
          <div class="setting-item font-control">
            <span>字距</span>
            <input type="range" min="0" max="5" step="0.1" v-model.number="settings.letterSpacing" />
            <span class="slider-value">{{ settings.letterSpacing.toFixed(1) }}px</span>
            <button class="ctrl-btn reset-btn" @click="resetSetting('letterSpacing')">重置</button>
          </div>
          <div class="setting-item font-control">
            <span>行距</span>
            <input type="range" min="1.2" max="3" step="0.1" v-model.number="settings.lineHeight" />
            <span class="slider-value">{{ settings.lineHeight.toFixed(1) }}</span>
            <button class="ctrl-btn reset-btn" @click="resetSetting('lineHeight')">重置</button>
          </div>
          <div class="setting-item font-control">
            <span>段距</span>
            <input type="range" min="0.5" max="3" step="0.1" v-model.number="settings.paragraphSpacing" />
            <span class="slider-value">{{ settings.paragraphSpacing.toFixed(1) }}em</span>
            <button class="ctrl-btn reset-btn" @click="resetSetting('paragraphSpacing')">重置</button>
          </div>
          <div class="setting-item">
            <button class="ctrl-btn factory-reset" @click="factoryReset">恢复所有默认设置</button>
          </div>
        </div>
      </div>
    </div>

    <div v-show="showCatalog" class="modal" @click.self="showCatalog = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>章节目录</h2>
          <button class="close-btn" @click="showCatalog = false">×</button>
        </div>
        <ul class="modal-list">
          <li v-for="ch in chapters" :key="ch.pIndex" @click="jumpToParagraph(ch.pIndex); showCatalog = false">
            {{ ch.title }}
          </li>
        </ul>
      </div>
    </div>

    <div ref="rulerRef" class="ruler"></div>
  </div>
</template>

<style scoped>
.reader-root {
  --r-bg: #fdf6e3;
  --r-text: #586e75;
  --r-border: #eee8d5;
  --r-highlight: rgba(0, 0, 0, 0.05);
  --r-search-bg: #ffd900;
  --r-search-text: #000;
  height: calc(100vh - 49px);
  display: flex;
  flex-direction: column;
  background: var(--r-bg);
  color: var(--r-text);
}
.reader-root.theme-dark {
  --r-bg: #212529;
  --r-text: #adb5bd;
  --r-border: #495057;
  --r-highlight: rgba(255, 255, 255, 0.08);
}
.reader-root.theme-green {
  --r-bg: #cce8cf;
  --r-text: #3d5b3d;
  --r-border: #b7d6b9;
}
.reader-root.theme-blue {
  --r-bg: #e0f0f8;
  --r-text: #3a506b;
  --r-border: #c9dce8;
}
.reader-root.theme-gray {
  --r-bg: #e1e1e1;
  --r-text: #333333;
  --r-border: #cccccc;
}
.reader-container {
  flex: 1;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
header {
  padding: 8px 0;
  border-bottom: 1px solid var(--r-border);
}
.filename {
  text-align: center;
  margin: 0 0 6px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 10px;
}
.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ctrl-btn {
  padding: 5px 10px;
  border: 1px solid var(--r-border);
  background: transparent;
  color: var(--r-text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.ctrl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.search-bar {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 8px 5px;
  background: var(--r-highlight);
  border-bottom: 1px solid var(--r-border);
}
.search-bar input {
  flex-grow: 1;
  min-width: 120px;
  background: var(--r-bg);
  border: 1px solid var(--r-border);
  color: var(--r-text);
  padding: 5px;
  border-radius: 4px;
}
.search-info {
  font-size: 14px;
  min-width: 50px;
  text-align: center;
}
.close-search {
  font-weight: bold;
  margin-left: auto;
}
.content-wrapper {
  flex-grow: 1;
  border: 1px solid var(--r-border);
  border-radius: 5px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.empty-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--r-text);
  opacity: 0.5;
}
.page {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 20px;
  overflow-y: auto;
  text-align: justify;
  font-size: var(--r-font-size, 20px);
  line-height: var(--r-line-height, 1.9);
  letter-spacing: var(--r-letter-spacing, 0px);
}
.page p {
  margin-top: 0;
  margin-bottom: var(--r-paragraph-spacing, 1em);
}
.page p.chapter-title {
  font-weight: bold;
  font-size: 1.2em;
  text-align: center;
  margin-top: 1em;
  margin-bottom: 1.5em;
}
footer {
  padding: 8px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  opacity: 0.8;
}
.page-info {
  cursor: pointer;
}
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: var(--r-bg);
  color: var(--r-text);
  border: 1px solid var(--r-border);
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.modal-header h2 {
  margin: 0;
}
.close-btn {
  font-size: 24px;
  font-weight: bold;
  background: none;
  border: none;
  color: var(--r-text);
  cursor: pointer;
}
.modal-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
}
.modal-list li {
  padding: 10px 5px;
  border-bottom: 1px solid var(--r-border);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.modal-list li:hover {
  background: var(--r-highlight);
}
.settings-list {
  overflow-y: auto;
}
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 5px;
  border-bottom: 1px solid var(--r-border);
}
.setting-item.font-control {
  flex-wrap: nowrap;
  gap: 10px;
}
.setting-item.font-control span:first-child {
  flex-basis: 50px;
  flex-shrink: 0;
}
.slider-value {
  flex-basis: 60px;
  text-align: right;
}
.reset-btn {
  padding: 2px 8px;
  font-size: 12px;
}
.factory-reset {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
  margin: 0 auto;
}
.ruler {
  visibility: hidden;
  position: absolute;
  top: -9999px;
  left: -9999px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
