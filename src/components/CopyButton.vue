<script setup lang="ts">
import { useClipboard } from '@/composables/useClipboard'

const props = defineProps<{ text: string; label?: string }>()
const { copied, copy } = useClipboard()
</script>

<template>
  <button class="copy-btn" @click="copy(props.text)">
    {{ copied ? '已复制 ✓' : (label ?? '复制') }}
  </button>
</template>

<style scoped>
.copy-btn {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.copy-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
