<script setup lang="ts">
import { computed, watch } from 'vue';
import { IconFolder, IconPlus } from '@tabler/icons-vue';
import DialogShell from '../ui/DialogShell.vue';
import IconThumb from '../grid/IconThumb.vue';
import { useNavStore } from '../../stores/nav';
import type { FolderItem, IconItem } from '../../shared/types';

const props = defineProps<{
  groupId: string;
  folderId: string;
}>();

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{
  add: [];
  editChild: [item: IconItem];
  childMenu: [item: IconItem, event: MouseEvent];
  rename: [];
  delete: [];
}>();

const navStore = useNavStore();

const group = computed(() => navStore.groups.find((item) => item.id === props.groupId) ?? null);
const folder = computed<FolderItem | null>(() => {
  return (
    group.value?.items.find(
      (item): item is FolderItem => item.type === 'folder' && item.id === props.folderId,
    ) ?? null
  );
});

const subtitle = computed(() => {
  const count = folder.value?.children.length ?? 0;
  return `${group.value?.name ?? ''} · ${count} 个图标`;
});

watch(folder, (value) => {
  if (!value && open.value) open.value = false;
});

function openChild(item: IconItem) {
  if (!/^https?:\/\//i.test(item.url)) return;
  window.open(item.url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <DialogShell
    v-model:open="open"
    :title="folder?.name ?? '文件夹'"
    :subtitle="subtitle"
    :width="560"
  >
    <div v-if="folder" class="folder-body">
      <div v-if="folder.children.length" class="folder-grid">
        <button
          v-for="child in folder.children"
          :key="child.id"
          type="button"
          class="child-item"
          :title="child.name"
          @click="openChild(child)"
          @contextmenu.prevent.stop="emit('childMenu', child, $event)"
        >
          <span class="child-thumb">
            <IconThumb :name="child.name" :icon="child.icon" :url="child.url" />
          </span>
          <span class="child-name">{{ child.name }}</span>
        </button>

        <button type="button" class="child-item add-child" @click="emit('add')">
          <span class="child-thumb add-box"><IconPlus size="20" stroke="1.8" /></span>
          <span class="child-name">添加</span>
        </button>
      </div>

      <div v-else class="folder-empty">
        <span class="empty-icon"><IconFolder size="34" stroke="1.5" /></span>
        <strong>文件夹是空的</strong>
        <span>添加图标，或从桌面右键图标选择“移动到文件夹”。</span>
        <button type="button" class="panel-btn primary" @click="emit('add')">添加图标</button>
      </div>
    </div>

    <template #footer>
      <button type="button" class="panel-btn rename-btn" @click="emit('rename')">重命名</button>
      <button type="button" class="panel-btn danger delete-btn" @click="emit('delete')">删除文件夹</button>
      <button type="button" class="panel-btn primary" @click="emit('add')">添加图标</button>
    </template>
  </DialogShell>
</template>

<style scoped>
.folder-body {
  min-height: 120px;
}

.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 8px;
}

.child-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--panel-text);
}

.child-item:hover {
  background: var(--panel-hover);
}

.child-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.child-thumb {
  display: block;
  width: 52px;
  height: 52px;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--panel-input);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
}

.child-name {
  max-width: 100%;
  overflow: hidden;
  color: var(--panel-muted);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-child .child-thumb {
  display: grid;
  border: 1px dashed var(--panel-border);
  background: transparent;
  box-shadow: none;
  color: var(--panel-faint);
  place-items: center;
}

.add-child:hover .child-thumb {
  border-color: var(--panel-faint);
  background: var(--panel-hover);
  color: var(--panel-text);
}

.folder-empty {
  display: flex;
  min-height: 190px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--panel-muted);
  text-align: center;
}

.empty-icon {
  display: grid;
  width: 58px;
  height: 58px;
  border: 1px dashed var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
  color: var(--panel-faint);
  place-items: center;
}

.folder-empty strong {
  color: var(--panel-text);
  font-size: 14px;
}

.folder-empty span {
  max-width: 300px;
  font-size: 12px;
  line-height: 1.6;
}

.folder-empty .panel-btn {
  margin-top: 4px;
}

.rename-btn {
  margin-right: auto;
}

.panel-btn.danger {
  color: #ff7b7b;
}
</style>
