<script setup lang="ts">
const props = defineProps<{
  title: string;
  description?: string;
}>();

void props;
</script>

<template>
  <section class="settings-section">
    <header class="settings-section-header">
      <h3>{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </header>
    <div class="settings-section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section-header h3 {
  margin: 0;
  color: var(--panel-text);
  font-size: 18px;
  letter-spacing: -0.02em;
}

.settings-section-header p {
  margin: 4px 0 0;
  color: var(--panel-muted);
  font-size: 12px;
  line-height: 1.6;
}

.settings-section-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
