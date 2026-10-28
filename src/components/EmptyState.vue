<script setup lang="ts">
defineProps<{ icon?: string; message: string }>()
</script>

<template>
  <div class="empty-state">
    <span v-if="icon" class="empty-icon">{{ icon }}</span>
    <p>{{ message }}</p>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--muted);
}
.empty-icon {
  font-size: 48px;
}
</style>
