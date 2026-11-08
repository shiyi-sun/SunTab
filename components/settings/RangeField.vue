<script setup lang="ts">
const props = defineProps<{
  label: string;
  modelValue: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

function update(event: Event) {
  emit('update:modelValue', Number((event.target as HTMLInputElement).value));
}

void props;
</script>

<template>
  <label class="range-field">
    <span class="range-label">{{ label }}</span>
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step ?? 1"
      @input="update"
    />
    <span class="range-value">{{ modelValue }}{{ suffix ?? '' }}</span>
  </label>
</template>

<style scoped>
.range-field {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) 52px;
  align-items: center;
  gap: 12px;
  color: var(--panel-muted);
  font-size: 12px;
}

.range-label {
  color: var(--panel-text);
}

.range-field input {
  width: 100%;
  accent-color: var(--accent);
}

.range-value {
  color: var(--panel-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
