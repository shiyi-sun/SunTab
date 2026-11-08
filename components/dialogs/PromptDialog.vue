<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import DialogShell from '../ui/DialogShell.vue';
import { clampName } from '../../shared/nav';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    label?: string;
    placeholder?: string;
    initial?: string;
    confirmLabel?: string;
    maxLength?: number;
  }>(),
  {
    subtitle: '',
    label: '名称',
    placeholder: '',
    initial: '',
    confirmLabel: '确定',
    maxLength: 48,
  },
);

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ submit: [value: string] }>();

const value = ref('');
const valid = computed(() => Boolean(value.value.trim()));

watch(open, (next) => {
  if (next) value.value = props.initial;
});

function submit() {
  if (!valid.value) return;
  emit('submit', clampName(value.value, props.maxLength));
  open.value = false;
}
</script>

<template>
  <DialogShell v-model:open="open" :title="title" :subtitle="subtitle" :width="420">
    <form class="prompt-form" @submit.prevent="submit">
      <label class="prompt-label">
        <span>{{ label }}</span>
        <input
          v-model="value"
          class="panel-input"
          type="text"
          :maxlength="maxLength"
          :placeholder="placeholder"
          data-autofocus
        />
      </label>
    </form>

    <template #footer>
      <button type="button" class="panel-btn" @click="open = false">取消</button>
      <button type="button" class="panel-btn primary" :disabled="!valid" @click="submit">
        {{ confirmLabel }}
      </button>
    </template>
  </DialogShell>
</template>

<style scoped>
.prompt-form {
  padding: 4px 0 8px;
}

.prompt-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--panel-muted);
  font-size: 12px;
}

.prompt-label input {
  font-size: 13px;
}
</style>
