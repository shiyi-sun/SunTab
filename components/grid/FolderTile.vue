<script setup lang="ts">
import { computed } from 'vue';
import { IconFolder } from '@tabler/icons-vue';
import type { FolderItem } from '../../shared/types';
import IconThumb from './IconThumb.vue';

const props = defineProps<{
  item: FolderItem;
}>();

const emit = defineEmits<{
  open: [];
  menu: [event: MouseEvent];
}>();

const preview = computed(() => props.item.children.slice(0, 4));
</script>

<template>
  <button
    type="button"
    class="folder-tile"
    :title="item.name"
    :aria-label="`${item.name}，${item.children.length} 个图标`"
    @click="emit('open')"
    @contextmenu.prevent.stop="emit('menu', $event)"
  >
    <span class="folder-visual">
      <span v-if="preview.length" class="folder-preview">
        <span v-for="child in preview" :key="child.id" class="preview-cell">
          <IconThumb :name="child.name" :icon="child.icon" :url="child.url" />
        </span>
        <span
          v-for="index in 4 - preview.length"
          :key="`empty-${index}`"
          class="preview-cell empty"
        ></span>
      </span>
      <IconFolder v-else size="30" stroke="1.6" class="folder-empty-icon" />
    </span>
    <span class="folder-label">
      <span class="folder-name">{{ item.name }}</span>
      <span class="folder-count">{{ item.children.length }}</span>
    </span>
  </button>
</template>

<style scoped>
.folder-tile {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--icon-label-color, #fff);
  user-select: none;
}

.folder-tile:focus-visible {
  border-radius: var(--icon-radius);
  outline: 2px solid var(--shell-focus);
  outline-offset: 4px;
}

.folder-visual {
  position: relative;
  display: grid;
  width: var(--icon-size);
  height: var(--icon-size);
  flex: none;
  overflow: hidden;
  border: 1px solid var(--icon-border);
  border-radius: var(--icon-radius);
  background: var(--icon-glass);
  box-shadow: var(--icon-shadow);
  backdrop-filter: blur(12px);
  place-items: center;
  transition:
    transform 180ms var(--ease),
    background 180ms var(--ease),
    box-shadow 180ms var(--ease),
    border-color 180ms var(--ease);
}

.folder-tile:hover .folder-visual {
  border-color: var(--icon-border-hover);
  background: var(--icon-glass-hover);
  box-shadow: var(--icon-shadow-hover);
  transform: translateY(-3px);
}

.folder-empty-icon {
  opacity: 0.62;
}

.folder-preview {
  display: grid;
  width: calc(var(--icon-size) * 0.7);
  height: calc(var(--icon-size) * 0.7);
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: max(2px, calc(var(--icon-size) * 0.033));
}

.preview-cell {
  display: block;
  overflow: hidden;
  border-radius: calc(var(--icon-size) * 0.1);
}

.preview-cell.empty {
  background: var(--icon-glass-faint);
}

.folder-label {
  display: flex;
  max-width: calc(var(--icon-size) + 20px);
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: var(--icon-label-size, 12px);
  line-height: 1.2;
  text-shadow: var(--icon-label-shadow);
}

.folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-count {
  flex: none;
  color: var(--shell-text-faint);
  font-size: 9px;
}
</style>
