<script setup lang="ts">
import { IconAlertTriangle } from '@tabler/icons-vue';
import DialogShell from '../ui/DialogShell.vue';

withDefaults(
  defineProps<{
    title: string;
    message: string;
    detail?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    extraLabel?: string;
    danger?: boolean;
  }>(),
  {
    detail: '',
    confirmLabel: '删除',
    cancelLabel: '取消',
    extraLabel: '',
    danger: true,
  },
);

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: []; extra: [] }>();

function confirm() {
  emit('confirm');
  open.value = false;
}

function extra() {
  emit('extra');
  open.value = false;
}
</script>

<template>
  <DialogShell v-model:open="open" :title="title" :width="430">
    <div class="confirm-body">
      <span class="confirm-icon" :class="{ danger }" aria-hidden="true">
        <IconAlertTriangle size="21" stroke="1.8" />
      </span>
      <div class="confirm-text">
        <p class="confirm-message">{{ message }}</p>
        <p v-if="detail" class="confirm-detail">{{ detail }}</p>
      </div>
    </div>

    <template #footer>
      <button v-if="extraLabel" type="button" class="panel-btn extra-btn" @click="extra">
        {{ extraLabel }}
      </button>
      <button type="button" class="panel-btn" @click="open = false">{{ cancelLabel }}</button>
      <button
        type="button"
        class="panel-btn"
        :class="danger ? 'danger-solid' : 'primary'"
        @click="confirm"
      >
        {{ confirmLabel }}
      </button>
    </template>
  </DialogShell>
</template>

<style scoped>
.confirm-body {
  display: flex;
  gap: 12px;
  padding: 4px 0 8px;
}

.confirm-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: var(--radius-md);
  background: var(--panel-hover);
  color: var(--panel-muted);
  place-items: center;
}

.confirm-icon.danger {
  background: rgb(255 107 107 / 12%);
  color: #ff7b7b;
}

.confirm-text {
  min-width: 0;
}

.confirm-message {
  margin: 4px 0 0;
  color: var(--panel-text);
  font-size: 13px;
  line-height: 1.65;
}

.confirm-detail {
  margin: 8px 0 0;
  color: var(--panel-muted);
  font-size: 12px;
  line-height: 1.65;
}

.extra-btn {
  margin-right: auto;
}

.panel-btn.danger-solid {
  border-color: transparent;
  background: #e55353;
  color: #fff;
}

.panel-btn.danger-solid:hover {
  filter: brightness(1.06);
}
</style>
