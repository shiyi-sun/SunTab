<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function update(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
}

void props;
</script>

<template>
  <span class="color-field">
    <input type="color" :value="modelValue" @input="update" />
    <span class="color-value">{{ modelValue }}</span>
  </span>
</template>

<style scoped>
.color-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.color-field input {
  width: 34px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.color-value {
  color: var(--panel-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
}
</style>
