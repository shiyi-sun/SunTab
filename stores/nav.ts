import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { createDefaultNav, STORAGE_KEYS } from '../shared/defaults';
import {
  loadNav,
  onStorageChanged,
  sanitizeNavGroups,
  saveNav,
} from '../shared/storage';
import { clampName } from '../shared/nav';
import type { FolderItem, IconItem, NavGroup } from '../shared/types';

let listening = false;

export const useNavStore = defineStore('nav', () => {
  const groups = ref<NavGroup[]>(createDefaultNav());
  const activeGroupId = ref(groups.value[0]?.id ?? '');
  const ready = ref(false);

  const activeGroup = computed<NavGroup>(() => {
    return groups.value.find((group) => group.id === activeGroupId.value) ?? groups.value[0]!;
  });

  async function init() {
    if (ready.value) return;
    groups.value = await loadNav();
    activeGroupId.value = groups.value[0]?.id ?? '';
    ready.value = true;

    if (!listening) {
      listening = true;
      onStorageChanged((changes, areaName) => {
        if (areaName !== 'local' || !changes[STORAGE_KEYS.nav]) return;
        let value = changes[STORAGE_KEYS.nav]?.newValue;
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch {
            return;
          }
        }
        const next = sanitizeNavGroups(value);
        if (!next.length) return;
        if (JSON.stringify(next) === JSON.stringify(groups.value)) return;
        const previousActive = activeGroupId.value;
        groups.value = next;
        activeGroupId.value = next.some((group) => group.id === previousActive)
          ? previousActive
          : next[0]!.id;
      });
    }
  }

  function setActiveGroup(id: string) {
    if (groups.value.some((group) => group.id === id)) {
      activeGroupId.value = id;
    }
  }

  function replaceGroups(next: NavGroup[]) {
    const sanitized = sanitizeNavGroups(next);
    groups.value = sanitized.length ? sanitized : createDefaultNav();
    activeGroupId.value = groups.value[0]!.id;
  }

  function resolveGroup(groupId: string): NavGroup {
    return groups.value.find((group) => group.id === groupId) ?? activeGroup.value;
  }

  function resolveFolder(group: NavGroup, folderId: string | null): FolderItem | null {
    if (!folderId) return null;
    return (
      group.items.find(
        (item): item is FolderItem => item.type === 'folder' && item.id === folderId,
      ) ?? null
    );
  }

  function addIcon(groupId: string, folderId: string | null, icon: IconItem) {
    const group = resolveGroup(groupId);
    const folder = resolveFolder(group, folderId);
    if (folder) {
      folder.children.push(icon);
    } else {
      group.items.push(icon);
    }
  }

  function updateIcon(
    groupId: string,
    folderId: string | null,
    itemId: string,
    patch: Pick<IconItem, 'name' | 'url' | 'icon'>,
  ) {
    const group = resolveGroup(groupId);
    const targetFolder = resolveFolder(group, folderId);
    const list = targetFolder ? targetFolder.children : group.items;
    const index = list.findIndex((item) => item.type === 'icon' && item.id === itemId);
    if (index < 0) return;
    const current = list[index];
    if (!current || current.type !== 'icon') return;
    list[index] = { ...current, ...patch };
  }

  function removeIcon(groupId: string, folderId: string | null, itemId: string) {
    const group = resolveGroup(groupId);
    const targetFolder = resolveFolder(group, folderId);
    const list = targetFolder ? targetFolder.children : group.items;
    const index = list.findIndex((item) => item.type === 'icon' && item.id === itemId);
    if (index >= 0) list.splice(index, 1);
  }

  function moveIconToFolder(groupId: string, itemId: string, folderId: string) {
    const group = resolveGroup(groupId);
    const folder = resolveFolder(group, folderId);
    if (!folder) return;
    const index = group.items.findIndex((item) => item.type === 'icon' && item.id === itemId);
    if (index < 0) return;
    const [item] = group.items.splice(index, 1);
    if (item && item.type === 'icon') folder.children.push(item);
  }

  function moveIconToGroup(groupId: string, itemId: string, targetGroupId: string): boolean {
    if (groupId === targetGroupId) return false;
    const source = groups.value.find((group) => group.id === groupId);
    const target = groups.value.find((group) => group.id === targetGroupId);
    if (!source || !target) return false;
    const index = source.items.findIndex((item) => item.type === 'icon' && item.id === itemId);
    if (index < 0) return false;
    const [item] = source.items.splice(index, 1);
    if (!item) return false;
    target.items.push(item);
    return true;
  }

  function moveIconOutOfFolder(groupId: string, folderId: string, childId: string) {
    const group = resolveGroup(groupId);
    const folder = resolveFolder(group, folderId);
    if (!folder) return;
    const index = folder.children.findIndex((item) => item.id === childId);
    if (index < 0) return;
    const [item] = folder.children.splice(index, 1);
    if (item) group.items.push(item);
  }

  function addFolder(groupId: string, name: string): FolderItem | null {
    const group = resolveGroup(groupId);
    const folder: FolderItem = {
      id: crypto.randomUUID(),
      type: 'folder',
      name: clampName(name) || '新建文件夹',
      children: [],
    };
    group.items.push(folder);
    return folder;
  }

  function renameFolder(groupId: string, folderId: string, name: string) {
    const folder = resolveFolder(resolveGroup(groupId), folderId);
    if (!folder) return;
    folder.name = clampName(name) || folder.name;
  }

  function removeFolder(groupId: string, folderId: string, keepChildren: boolean) {
    const group = resolveGroup(groupId);
    const index = group.items.findIndex(
      (item) => item.type === 'folder' && item.id === folderId,
    );
    if (index < 0) return;
    const folder = group.items[index];
    if (!folder || folder.type !== 'folder') return;
    if (keepChildren) {
      group.items.splice(index, 1, ...folder.children);
    } else {
      group.items.splice(index, 1);
    }
  }

  function moveItem(groupId: string, from: number, to: number) {
    const group = resolveGroup(groupId);
    if (from === to) return;
    if (from < 0 || from >= group.items.length) return;
    if (to < 0 || to >= group.items.length) return;
    const [item] = group.items.splice(from, 1);
    if (item) group.items.splice(to, 0, item);
  }

  function addGroup(name: string): NavGroup {
    const group: NavGroup = {
      id: crypto.randomUUID(),
      name: clampName(name) || '新建分组',
      icon: 'folder',
      items: [],
    };
    groups.value.push(group);
    activeGroupId.value = group.id;
    return group;
  }

  function renameGroup(id: string, name: string) {
    const group = groups.value.find((item) => item.id === id);
    if (!group) return;
    group.name = clampName(name) || group.name;
  }

  function removeGroup(id: string): boolean {
    if (groups.value.length <= 1) return false;
    const index = groups.value.findIndex((group) => group.id === id);
    if (index < 0) return false;
    groups.value.splice(index, 1);
    if (activeGroupId.value === id) {
      const next = groups.value[Math.min(index, groups.value.length - 1)];
      activeGroupId.value = next?.id ?? groups.value[0]!.id;
    }
    return true;
  }

  watch(
    groups,
    () => {
      if (ready.value) saveNav(groups.value);
    },
    { deep: true },
  );

  return {
    groups,
    activeGroupId,
    activeGroup,
    ready,
    init,
    setActiveGroup,
    replaceGroups,
    addIcon,
    updateIcon,
    removeIcon,
    moveIconToFolder,
    moveIconToGroup,
    moveIconOutOfFolder,
    addFolder,
    renameFolder,
    removeFolder,
    moveItem,
    addGroup,
    renameGroup,
    removeGroup,
  };
});
