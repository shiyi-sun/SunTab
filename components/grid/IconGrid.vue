<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { IconPlus } from '@tabler/icons-vue';
import { useConfigStore } from '../../stores/config';
import { useGridLayout } from '../../composables/useGridLayout';
import { useDragSort } from '../../composables/useDragSort';
import type { NavItem } from '../../shared/types';
import FolderTile from './FolderTile.vue';
import IconTile from './IconTile.vue';

const props = defineProps<{
  items: NavItem[];
}>();

const emit = defineEmits<{
  add: [];
  openFolder: [id: string];
  itemMenu: [item: NavItem, event: MouseEvent];
  blankMenu: [event: MouseEvent];
  reorder: [from: number, to: number];
}>();

const configStore = useConfigStore();
const viewport = ref<HTMLElement | null>(null);

const { columns, gridWidth } = useGridLayout(viewport, () => ({
  size: configStore.config.icon.size,
  gap: configStore.config.icon.gap,
  maxWidth: configStore.config.icon.maxWidth,
  cellCount: props.items.length + 1,
}));

const gridStyle = computed(() => ({
  width: `${gridWidth.value}px`,
  gridTemplateColumns: `repeat(${columns.value}, var(--icon-size))`,
}));

const { dragging, draggingId, indicator } = useDragSort({
  container: viewport,
  onReorder: (from, insertAt) => {
    const to = insertAt > from ? insertAt - 1 : insertAt;
    if (to === from) return;
    void applyReorder(from, to);
  },
});

const indicatorStyle = computed(() => ({
  left: `${indicator.left}px`,
  top: `${indicator.top}px`,
  height: `${indicator.height}px`,
}));

async function applyReorder(from: number, to: number) {
  const grid = viewport.value?.querySelector<HTMLElement>('.grid');
  const before = new Map<string, DOMRect>();
  grid?.querySelectorAll<HTMLElement>('[data-nav-id]').forEach((element) => {
    const id = element.dataset.navId;
    if (id) before.set(id, element.getBoundingClientRect());
  });

  emit('reorder', from, to);
  await nextTick();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  grid?.querySelectorAll<HTMLElement>('[data-nav-id]').forEach((element) => {
    const id = element.dataset.navId;
    const previous = id ? before.get(id) : undefined;
    if (!previous) return;
    const rect = element.getBoundingClientRect();
    const dx = previous.left - rect.left;
    const dy = previous.top - rect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    element.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  });
}

function openBlankMenu(event: MouseEvent) {
  emit('blankMenu', event);
}
</script>

<template>
  <div ref="viewport" class="grid-viewport" @contextmenu.prevent="openBlankMenu">
    <div
      class="grid"
      :class="{ 'is-dragging': dragging }"
      :style="gridStyle"
      aria-label="图标网格"
    >
      <template v-for="(item, index) in props.items" :key="item.id">
        <IconTile
          v-if="item.type === 'icon'"
          :item="item"
          :class="{ 'drag-active': draggingId === item.id }"
          :data-nav-id="item.id"
          :data-index="index"
          @menu="emit('itemMenu', item, $event)"
        />
        <FolderTile
          v-else
          :item="item"
          :class="{ 'drag-active': draggingId === item.id }"
          :data-nav-id="item.id"
          :data-index="index"
          @open="emit('openFolder', item.id)"
          @menu="emit('itemMenu', item, $event)"
        />
      </template>

      <button
        type="button"
        class="add-tile"
        title="添加图标"
        aria-label="添加图标"
        @click="emit('add')"
        @contextmenu.prevent.stop="openBlankMenu"
      >
        <span class="add-box"><IconPlus size="20" stroke="1.8" /></span>
        <span class="add-label">添加</span>
      </button>
    </div>

    <p v-if="!props.items.length" class="empty-hint">
      还没有图标，点“添加”，或右键空白处新建文件夹
    </p>

    <div v-if="indicator.visible" class="drag-indicator" :style="indicatorStyle"></div>
  </div>
</template>

<style scoped>
.grid-viewport {
  position: relative;
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.grid {
  display: grid;
  grid-auto-flow: dense;
  grid-auto-rows: calc(var(--icon-size) + 24px);
  gap: var(--icon-gap);
  user-select: none;
}

.grid > :deep(.drag-active) {
  cursor: grabbing;
}

.add-tile {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--shell-text-soft);
}

.add-tile:focus-visible {
  border-radius: var(--icon-radius);
  outline: 2px solid var(--shell-focus);
  outline-offset: 4px;
}

.add-box {
  display: grid;
  width: var(--icon-size);
  height: var(--icon-size);
  flex: none;
  border: 1px dashed var(--icon-add-border);
  border-radius: var(--icon-radius);
  background: var(--add-glass);
  place-items: center;
  transition:
    background 180ms var(--ease),
    border-color 180ms var(--ease),
    transform 180ms var(--ease);
}

.add-tile:hover .add-box {
  border-color: var(--icon-add-hover-border);
  background: var(--add-glass-hover);
  transform: translateY(-3px);
}

.add-label {
  margin-top: 8px;
  font-size: var(--icon-label-size, 12px);
  line-height: 1.2;
  text-shadow: var(--icon-label-shadow);
}

.empty-hint {
  margin: 16px 0 0;
  color: var(--shell-text-faint);
  font-size: 12px;
  text-shadow: var(--shell-text-shadow);
}

.drag-indicator {
  position: fixed;
  z-index: 96;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
  pointer-events: none;
  transition:
    left 90ms var(--ease),
    top 90ms var(--ease),
    height 90ms var(--ease),
    opacity 120ms var(--ease);
}
</style>
