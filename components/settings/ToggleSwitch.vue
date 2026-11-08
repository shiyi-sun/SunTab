<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

function toggle() {
  emit('update:modelValue', !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    role="switch"
    :aria-checked="modelValue"
    @click="toggle"
  >
    <span class="knob" :class="{ on: modelValue }"></span>
  </button>
</template>

<style scoped>
.toggle {
  position: relative;
  width: 40px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--panel-input);
  transition: background 160ms var(--ease);
}

.toggle[aria-checked='true'] {
  border-color: transparent;
  background: var(--accent);
}

.toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--panel-muted);
  transition:
    transform 160ms var(--ease),
    background 160ms var(--ease);
}

.knob.on {
  background: #fff;
  transform: translateX(16px);
}
</style>
