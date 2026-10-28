<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <KeepAlive include="HomePage">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>
</template>
