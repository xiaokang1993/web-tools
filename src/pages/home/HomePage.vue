<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { navItems, navTypes, TYPE_NAMES, type NavItem, type PageType } from '@/shared/nav'
import { useTheme } from '@/composables/useTheme'
import { useLocalStorage } from '@/composables/useLocalStorage'

defineOptions({ name: 'HomePage' })

const router = useRouter()
const { isDark, toggle } = useTheme()

const search = ref('')
const activeType = ref<PageType | 'all'>('all')

const recent = useLocalStorage<string[]>('recent-tools', [])

const filtered = computed<NavItem[]>(() => {
  const term = search.value.trim().toLowerCase()
  return navItems.filter((item) => {
    const matchType = activeType.value === 'all' || item.type === activeType.value
    const matchSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.desc.toLowerCase().includes(term)
    return matchType && matchSearch
  })
})

const openTool = (item: NavItem) => {
  const next = recent.value.filter((p) => p !== item.path)
  next.unshift(item.path)
  recent.value = next.slice(0, 6)
  router.push(item.path)
}

const recentItems = computed<NavItem[]>(() =>
  recent.value
    .map((p) => navItems.find((i) => i.path === p))
    .filter((i): i is NavItem => Boolean(i))
)
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>Web 工具导航</h1>
      <p>一站式工具集合 · {{ navItems.length }} 个工具</p>
      <button class="theme-toggle" @click="toggle">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </header>

    <div class="search-box">
      <input
        v-model="search"
        type="text"
        placeholder="搜索工具..."
        class="search-input"
      />
    </div>

    <div class="filters">
      <button
        :class="['filter-btn', { active: activeType === 'all' }]"
        @click="activeType = 'all'"
      >
        全部
      </button>
      <button
        v-for="t in navTypes"
        :key="t"
        :class="['filter-btn', { active: activeType === t }]"
        @click="activeType = t"
      >
        {{ TYPE_NAMES[t] }}
      </button>
    </div>

    <div v-if="recentItems.length && !search" class="recent-section">
      <h2>最近使用</h2>
      <div class="recent-list">
        <a
          v-for="item in recentItems"
          :key="`recent-${item.path}`"
          class="recent-chip"
          @click.prevent="openTool(item)"
        >
          <span class="chip-icon">{{ item.icon }}</span>
          <span>{{ item.name }}</span>
        </a>
      </div>
    </div>

    <div class="nav-grid">
      <a
        v-for="(item, index) in filtered"
        :key="item.path"
        class="nav-item"
        :style="{ animationDelay: `${index * 0.04}s` }"
        @click.prevent="openTool(item)"
      >
        <div class="nav-icon">{{ item.icon }}</div>
        <div class="nav-content">
          <div class="nav-title">{{ item.name }}</div>
          <div class="nav-desc">{{ item.desc }}</div>
          <div class="nav-meta">
            <span :class="['tag', item.type]">{{ TYPE_NAMES[item.type] }}</span>
          </div>
        </div>
      </a>
    </div>

    <div v-if="filtered.length === 0" class="no-result">
      <span>🔍</span>
      <p>没有找到匹配的工具</p>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}
.home-header {
  position: relative;
  text-align: center;
  margin-bottom: 24px;
}
.home-header h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
}
.home-header p {
  margin: 8px 0 0;
  color: var(--muted);
}
.theme-toggle {
  position: absolute;
  top: 0;
  right: 0;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  width: 40px;
  height: 40px;
  cursor: pointer;
  font-size: 18px;
}
.search-box {
  margin-bottom: 16px;
}
.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--fg);
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus {
  border-color: var(--accent);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
.filter-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.recent-section {
  margin-bottom: 24px;
}
.recent-section h2 {
  font-size: 14px;
  color: var(--muted);
  margin: 0 0 12px;
}
.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.recent-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.recent-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.chip-icon {
  font-size: 16px;
}
.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.nav-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  animation: fade-in 0.4s ease both;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.nav-item:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}
.nav-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.nav-content {
  flex: 1;
  min-width: 0;
}
.nav-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.nav-desc {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 8px;
}
.nav-meta {
  display: flex;
  gap: 6px;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}
.tag.game {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}
.tag.media {
  background: rgba(236, 72, 153, 0.15);
  color: #ec4899;
}
.tag.read {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}
.tag.util {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}
.no-result {
  text-align: center;
  padding: 64px 16px;
  color: var(--muted);
}
.no-result span {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
