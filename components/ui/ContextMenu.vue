<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MenuEntry } from './menu';

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  items: MenuEntry[];
}>();

const emit = defineEmits<{
  close: [];
  select: [entry: MenuEntry];
}>();

const menuRef = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });
const openSubmenu = ref('');
const flipSubmenu = ref(false);

function findEntry(id: string, entries: MenuEntry[] = props.items): MenuEntry | null {
  for (const entry of entries) {
    if (entry.id === id) return entry;
    if (entry.children?.length) {
      const found = findEntry(id, entry.children);
      if (found) return found;
    }
  }
  return null;
}

async function place() {
  await nextTick();
  const element = menuRef.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const margin = 8;
  const left = Math.max(
    margin,
    Math.min(props.x, window.innerWidth - rect.width - margin),
  );
  const top = Math.max(
    margin,
    Math.min(props.y, window.innerHeight - rect.height - margin),
  );
  position.value = { left, top };
  flipSubmenu.value = left + rect.width + 220 > window.innerWidth;
  await nextTick();
  element.querySelector<HTMLButtonElement>('[data-menu-item]:not(:disabled)')?.focus();
}

function close() {
  emit('close');
}

function choose(entry: MenuEntry) {
  if (entry.disabled) return;
  if (entry.children?.length) {
    openSubmenu.value = openSubmenu.value === entry.id ? '' : entry.id;
    if (openSubmenu.value) {
      void nextTick(() => {
        menuRef.value
          ?.querySelector<HTMLButtonElement>(`[data-submenu="${entry.id}"] [data-menu-item]`)
          ?.focus();
      });
    }
    return;
  }
  entry.action?.();
  emit('select', entry);
  close();
}

function onPointerDown(event: PointerEvent) {
  if (menuRef.value?.contains(event.target as Node)) return;
  close();
  const blockClick = (clickEvent: MouseEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopImmediatePropagation();
    window.removeEventListener('click', blockClick, true);
  };
  window.addEventListener('click', blockClick, true);
  window.setTimeout(() => window.removeEventListener('click', blockClick, true), 350);
}

function onViewportChange() {
  close();
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (openSubmenu.value) {
      openSubmenu.value = '';
    } else {
      close();
    }
    return;
  }
  if (event.key === 'ArrowLeft') {
    if (openSubmenu.value) {
      event.preventDefault();
      openSubmenu.value = '';
    }
    return;
  }
  if (event.key === 'ArrowRight') {
    const active = document.activeElement as HTMLElement | null;
    const wrapper = active?.closest<HTMLElement>('.ctx-row');
    const entry = wrapper ? findEntry(wrapper.dataset.entryId ?? '') : null;
    if (entry?.children?.length) {
      event.preventDefault();
      openSubmenu.value = entry.id;
      void nextTick(() => {
        menuRef.value
          ?.querySelector<HTMLButtonElement>(
            `[data-submenu="${entry.id}"] [data-menu-item]`,
          )
          ?.focus();
      });
    }
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

  const buttons = Array.from(
    menuRef.value?.querySelectorAll<HTMLButtonElement>('[data-menu-item]:not(:disabled)') ?? [],
  );
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const delta = event.key === 'ArrowDown' ? 1 : -1;
  const next = buttons[(index + delta + buttons.length) % buttons.length];
  next?.focus();
}

watch(
  () => [props.open, props.x, props.y] as const,
  ([open]) => {
    openSubmenu.value = '';
    if (open) void place();
  },
  { flush: 'post' },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('resize', onViewportChange);
      window.addEventListener('scroll', onViewportChange, true);
    } else {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    }
  },
);

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div
        v-if="open"
        ref="menuRef"
        class="ctx-menu"
        :class="{ 'flip-left': flipSubmenu }"
        :style="{ left: `${position.left}px`, top: `${position.top}px` }"
        role="menu"
        @contextmenu.prevent
        @mouseleave="openSubmenu = ''"
      >
        <template v-for="entry in items" :key="entry.id">
          <div v-if="entry.divider" class="ctx-divider" role="separator"></div>
          <div
            class="ctx-row"
            :class="{ 'has-sub': entry.children?.length }"
            :data-entry-id="entry.id"
            @mouseenter="entry.children?.length && (openSubmenu = entry.id)"
          >
            <button
              type="button"
              class="ctx-item"
              :class="{ danger: entry.danger }"
              :disabled="entry.disabled"
              :title="entry.title"
              data-menu-item
              role="menuitem"
              :aria-haspopup="entry.children?.length ? 'menu' : undefined"
              :aria-expanded="entry.children?.length ? openSubmenu === entry.id : undefined"
              @click="choose(entry)"
            >
              <span class="ctx-icon">
                <component :is="entry.icon" v-if="entry.icon" size="16" stroke="1.8" />
              </span>
              <span class="ctx-label">{{ entry.label }}</span>
              <span v-if="entry.children?.length" class="ctx-arrow" aria-hidden="true">›</span>
            </button>

            <div
              v-if="entry.children?.length && openSubmenu === entry.id"
              class="ctx-submenu"
              :data-submenu="entry.id"
              role="menu"
            >
              <button
                v-for="child in entry.children"
                :key="child.id"
                type="button"
                class="ctx-item"
                :class="{ danger: child.danger }"
                :disabled="child.disabled"
                data-menu-item
                role="menuitem"
                @click.stop="choose(child)"
              >
                <span class="ctx-icon">
                  <component :is="child.icon" v-if="child.icon" size="16" stroke="1.8" />
                </span>
                <span class="ctx-label">{{ child.label }}</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 95;
  width: 204px;
  padding: 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-bg);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32);
  color: var(--panel-text);
  backdrop-filter: blur(18px);
  transform-origin: top left;
}

.ctx-row {
  position: relative;
}

.ctx-item {
  display: flex;
  width: 100%;
  height: 33px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-text);
  font-size: 13px;
  text-align: left;
}

.ctx-item:hover:not(:disabled),
.ctx-item:focus-visible {
  outline: none;
  background: var(--panel-hover);
}

.ctx-item:disabled {
  cursor: default;
  opacity: 0.45;
}

.ctx-item.danger {
  color: #ff7b7b;
}

.ctx-icon {
  display: grid;
  width: 16px;
  flex: none;
  color: var(--panel-muted);
  place-items: center;
}

.ctx-item.danger .ctx-icon {
  color: #ff7b7b;
}

.ctx-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctx-arrow {
  color: var(--panel-faint);
  font-size: 16px;
  line-height: 1;
}

.ctx-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--panel-border);
}

.ctx-submenu {
  position: absolute;
  top: -6px;
  left: calc(100% + 4px);
  width: 188px;
  max-height: 260px;
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-bg);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
}

.ctx-menu.flip-left .ctx-submenu {
  right: calc(100% + 4px);
  left: auto;
}

.ctx-enter-active,
.ctx-leave-active {
  transition:
    opacity 120ms var(--ease),
    transform 120ms var(--ease);
}

.ctx-enter-from,
.ctx-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
