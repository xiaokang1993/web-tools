<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="page-header">
    <h1>{{ title }}</h1>
    <p v-if="subtitle">{{ subtitle }}</p>
  </header>
</template>

<style scoped>
.page-header {
  padding: 24px 16px 16px;
  text-align: center;
}
.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--fg);
}
.page-header p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 14px;
}
</style>
