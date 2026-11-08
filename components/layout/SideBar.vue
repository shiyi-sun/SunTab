<script setup lang="ts">
import { computed, type Component, type CSSProperties } from 'vue';
import {
  IconBox,
  IconCode,
  IconFish,
  IconFolder,
  IconHome,
  IconPalette,
  IconPlus,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-vue';
import type { NavGroup } from '../../shared/types';

const props = defineProps<{
  groups: NavGroup[];
  activeId: string;
  side: 'left' | 'right';
  width: number;
  opacity: number;
  autoHide: boolean;
}>();

defineEmits<{
  select: [id: string];
  addGroup: [];
  settings: [];
  groupMenu: [group: NavGroup, event: MouseEvent];
}>();

const groupIcons: Record<string, Component> = {
  home: IconHome,
  code: IconCode,
  design: IconPalette,
  product: IconBox,
  ai: IconSparkles,
  fun: IconFish,
};

function iconFor(name: string): Component {
  return groupIcons[name] ?? IconFolder;
}

const sidebarStyle = computed<CSSProperties>(() => ({
  width: `${props.width}px`,
  '--sidebar-opacity': String(props.opacity),
}));
</script>

<template>
  <aside
    class="sidebar"
    :class="[`is-${side}`, { 'auto-hide': autoHide }]"
    :style="sidebarStyle"
    aria-label="分组侧边栏"
  >
    <nav class="groups" aria-label="分组">
      <button
        v-for="group in groups"
        :key="group.id"
        type="button"
        class="group-btn"
        :class="{ active: group.id === activeId }"
        :title="group.name"
        :aria-current="group.id === activeId ? 'page' : undefined"
        @click="$emit('select', group.id)"
        @contextmenu.prevent.stop="$emit('groupMenu', group, $event)"
      >
        <span class="active-bar" aria-hidden="true"></span>
        <component :is="iconFor(group.icon)" size="21" stroke="1.8" />
        <span class="group-label">{{ group.name }}</span>
      </button>
    </nav>

    <div class="bottom">
      <button type="button" class="icon-btn" title="新建分组" aria-label="新建分组" @click="$emit('addGroup')">
        <IconPlus size="19" stroke="1.8" />
      </button>
      <button type="button" class="icon-btn" title="设置" aria-label="设置" @click="$emit('settings')">
        <IconSettings size="19" stroke="1.8" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Align the first group with the search field: stage top + clock height + gap. */
  padding: calc(clamp(16px, 3vh, 32px) + 102px + clamp(16px, 2.6vh, 24px) - 4px) 0 16px;
  color: var(--shell-text);
  opacity: var(--sidebar-opacity, 0.5);
  transition:
    opacity 200ms var(--ease),
    background 200ms var(--ease);
}

.sidebar:hover {
  opacity: 1;
}

.sidebar.auto-hide {
  opacity: 0.12;
}

.sidebar.auto-hide:hover {
  opacity: 1;
}

.sidebar.is-left {
  left: 0;
}

.sidebar.is-right {
  right: 0;
}

.groups {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.groups::-webkit-scrollbar {
  display: none;
}

.group-btn {
  position: relative;
  display: flex;
  width: 44px;
  height: 52px;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--shell-text-soft);
  transition:
    background 160ms var(--ease),
    color 160ms var(--ease);
}

.group-btn:hover {
  background: var(--shell-hover);
  color: var(--shell-text);
}

.group-btn.active {
  background: var(--shell-active);
  color: var(--shell-text);
}

.group-btn:focus-visible,
.icon-btn:focus-visible {
  outline: 2px solid var(--shell-focus);
  outline-offset: 2px;
}

.group-label {
  max-width: 40px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-bar {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 20px;
  border-radius: 2px;
  background: var(--shell-text);
  opacity: 0;
  transform: translateY(-50%);
}

.sidebar.is-left .active-bar {
  left: -7px;
}

.sidebar.is-right .active-bar {
  right: -7px;
}

.group-btn.active .active-bar {
  opacity: 1;
}

.bottom {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.icon-btn {
  display: grid;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--shell-text-soft);
  place-items: center;
  transition:
    background 160ms var(--ease),
    color 160ms var(--ease);
}

.icon-btn:hover {
  background: var(--shell-hover);
  color: var(--shell-text);
}
</style>
