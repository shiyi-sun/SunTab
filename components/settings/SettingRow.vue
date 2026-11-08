<script setup lang="ts">
defineProps<{
  label: string;
  description?: string;
}>();
</script>

<template>
  <div class="setting-row">
    <div class="setting-copy">
      <span class="setting-label">{{ label }}</span>
      <span v-if="description" class="setting-description">{{ description }}</span>
    </div>
    <div class="setting-control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  min-height: 40px;
  padding: 12px 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
  flex-wrap: wrap;
}

.setting-copy {
  display: flex;
  min-width: 0;
  flex: 1 1 100px;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  color: var(--panel-text);
  font-size: 13px;
}

.setting-description {
  color: var(--panel-muted);
  font-size: 11px;
  line-height: 1.5;
}

.setting-control {
  flex: none;
  margin-left: auto;
}
</style>
