<script lang="ts">
import { reactive } from 'vue';

const dialogStack = reactive<symbol[]>([]);
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IconX } from '@tabler/icons-vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    width?: number;
  }>(),
  { subtitle: '', width: 480 },
);

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLElement | null>(null);
const panelStyle = computed(() => ({ '--dialog-width': `${props.width}px` }));
const instanceId = Symbol('suntab-dialog');
const overlayStyle = computed(() => {
  const depth = dialogStack.findIndex((id) => id === instanceId);
  return { zIndex: 70 + Math.max(0, depth) * 2 };
});
let previousOverflow = '';
let previousFocus: HTMLElement | null = null;

function close() {
  if (!open.value) return;
  open.value = false;
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value || dialogStack[dialogStack.length - 1] !== instanceId) return;
  if (document.querySelector('.ctx-menu')) return;
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key !== 'Tab' || !panelRef.value) return;
  const focusable = Array.from(
    panelRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (active === first || !panelRef.value.contains(active))) {
    event.preventDefault();
    last.focus();
  }
}

function removeFromStack() {
  const index = dialogStack.indexOf(instanceId);
  if (index >= 0) dialogStack.splice(index, 1);
}

watch(open, async (value) => {
  if (value) {
    previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    removeFromStack();
    dialogStack.push(instanceId);
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    await nextTick();
    const target =
      panelRef.value?.querySelector<HTMLElement>('[data-autofocus]') ??
      panelRef.value?.querySelector<HTMLElement>('input, textarea, button');
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  } else {
    removeFromStack();
    document.body.style.overflow = previousOverflow;
    const restore = previousFocus;
    previousFocus = null;
    await nextTick();
    if (restore?.isConnected) restore.focus({ preventScroll: true });
  }
});

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  removeFromStack();
  if (open.value) {
    document.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="open" class="dialog-overlay" :style="overlayStyle" @click.self="close">
        <section
          ref="panelRef"
          class="dialog-panel"
          :style="panelStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="dialog-header">
            <div>
              <h2>{{ title }}</h2>
              <p v-if="subtitle">{{ subtitle }}</p>
            </div>
            <button type="button" class="dialog-close" aria-label="关闭" @click="close">
              <IconX size="18" stroke="2" />
            </button>
          </header>

          <div class="dialog-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="dialog-footer">
            <slot name="footer" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  padding: 24px;
  background: rgba(5, 8, 16, 0.58);
  place-items: center;
  backdrop-filter: blur(8px);
}

.dialog-panel {
  display: flex;
  width: min(var(--dialog-width), 100%);
  max-height: min(88vh, 820px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  color: var(--panel-text);
}

.dialog-header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
}

.dialog-header h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.02em;
}

.dialog-header p {
  margin: 4px 0 0;
  color: var(--panel-muted);
  font-size: 12px;
  line-height: 1.5;
}

.dialog-close {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--panel-input);
  color: var(--panel-muted);
  place-items: center;
}

.dialog-close:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.dialog-body {
  flex: 1;
  overflow: auto;
  padding: 4px 24px 20px;
}

.dialog-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--panel-border);
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 160ms var(--ease);
}

.dialog-fade-enter-active .dialog-panel,
.dialog-fade-leave-active .dialog-panel {
  transition:
    transform 180ms var(--ease),
    opacity 180ms var(--ease);
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-panel,
.dialog-fade-leave-to .dialog-panel {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@media (max-width: 560px) {
  .dialog-overlay {
    padding: 12px;
  }
}
</style>
