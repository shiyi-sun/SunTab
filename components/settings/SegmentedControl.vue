<script setup lang="ts">
export interface SegmentOption {
  value: string;
  label: string;
}

defineProps<{
  modelValue: string;
  options: SegmentOption[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <div class="segmented" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segment"
      :class="{ active: option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.segment {
  min-width: 46px;
  padding: 8px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-muted);
  font-size: 12px;
  transition:
    background 160ms var(--ease),
    color 160ms var(--ease);
}

.segment:hover {
  color: var(--panel-text);
}

.segment.active {
  background: var(--accent);
  color: #fff;
}

.segment:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
