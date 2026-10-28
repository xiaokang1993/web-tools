<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ title?: string }>()
</script>

<template>
  <div class="back-home">
    <RouterLink to="/">← 返回首页</RouterLink>
    <span v-if="title" class="page-title">{{ title }}</span>
  </div>
</template>

<style scoped>
.back-home {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.back-home a {
  color: var(--accent);
  font-size: 14px;
}
.page-title {
  color: var(--muted);
  font-size: 14px;
}
</style>
