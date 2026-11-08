<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowReactive,
  watch,
  type CSSProperties,
} from 'vue';
import { storeToRefs } from 'pinia';
import {
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
  IconFolderPlus,
  IconFolderSymlink,
  IconLayoutGrid,
  IconMinimize,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSettings,
  IconTrash,
  IconWallpaper,
} from '@tabler/icons-vue';
import { deleteIconBlob } from '../../shared/iconBlobs';
import { flushConfig, flushNav } from '../../shared/storage';
import { useConfigStore } from '../../stores/config';
import { useNavStore } from '../../stores/nav';
import { useWallpaperStore } from '../../stores/wallpaper';
import { isLightWallpaper } from '../../shared/wallpaper';
import type { FolderItem, IconDraft, IconItem, NavGroup, NavItem } from '../../shared/types';
import ClockPanel from './ClockPanel.vue';
import QuoteFooter from './QuoteFooter.vue';
import SearchBar from './SearchBar.vue';
import SideBar from './SideBar.vue';
import IconGrid from '../grid/IconGrid.vue';
import PromptDialog from '../dialogs/PromptDialog.vue';
import ConfirmDialog from '../dialogs/ConfirmDialog.vue';
import ContextMenu from '../ui/ContextMenu.vue';
import type { MenuEntry } from '../ui/menu';

const WallpaperPanel = defineAsyncComponent(() => import('../dialogs/WallpaperPanel.vue'));
const SettingsDrawer = defineAsyncComponent(
  () => import('../settings/SettingsDrawer.vue'),
);
const IconEditorDialog = defineAsyncComponent(
  () => import('../dialogs/IconEditorDialog.vue'),
);
const FolderDialog = defineAsyncComponent(() => import('../dialogs/FolderDialog.vue'));

const configStore = useConfigStore();
const navStore = useNavStore();
const wallpaperStore = useWallpaperStore();
const { config, isMinimal } = storeToRefs(configStore);
const { groups, activeGroupId, activeGroup } = storeToRefs(navStore);
const lightWallpaper = computed(() => isLightWallpaper(config.value.wallpaper));

const wallpaperPanelOpen = ref(false);
const settingsOpen = ref(false);
const folderState = reactive({ open: false, groupId: '', folderId: '' });
const editor = reactive<{
  open: boolean;
  mode: 'create' | 'edit';
  groupId: string;
  folderId: string | null;
  item: IconItem | null;
}>({
  open: false,
  mode: 'create',
  groupId: '',
  folderId: null,
  item: null,
});

const prompt = reactive({
  open: false,
  title: '',
  subtitle: '',
  label: '名称',
  initial: '',
  placeholder: '',
  confirmLabel: '确定',
  onSubmit: (_value: string) => {},
});

const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  detail: '',
  confirmLabel: '删除',
  extraLabel: '',
  onConfirm: () => {},
  onExtra: () => {},
});

const menu = shallowReactive({
  open: false,
  x: 0,
  y: 0,
  items: [] as MenuEntry[],
});

const toast = ref('');
let toastTimer: number | undefined;

function notify(message: string) {
  toast.value = message;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = '';
  }, 2200);
}

const shellStyle = computed<CSSProperties>(
  () =>
    ({
      '--sidebar-width': `${config.value.sidebar.width}px`,
      '--sidebar-opacity': String(config.value.sidebar.opacity),
      '--icon-size': `${config.value.icon.size}px`,
      '--icon-gap': `${config.value.icon.gap}px`,
      '--icon-radius': `${config.value.icon.radius}px`,
      '--icon-label-size': `${config.value.icon.labelSize}px`,
      '--icon-label-color': lightWallpaper.value
        ? 'var(--shell-text)'
        : config.value.icon.labelColor,
      '--icon-label-display': config.value.icon.showLabel ? 'block' : 'none',
      '--accent': config.value.theme.accent,
    }) as CSSProperties,
);

const wallpaperStyle = computed<CSSProperties>(() => ({
  ...wallpaperStore.backgroundStyle,
  filter:
    wallpaperStore.displayBlur > 0 ? `blur(${wallpaperStore.displayBlur}px)` : 'none',
}));

const scrimStyle = computed<CSSProperties>(() => {
  const dim = Math.min(80, Math.max(0, wallpaperStore.displayDim));
  return { background: `rgba(0, 0, 0, ${dim / 100})` };
});

const stageStyle = computed<CSSProperties>(() => {
  if (isMinimal.value) {
    return {
      '--stage-pad-left': '0px',
      '--stage-pad-right': '0px',
    } as CSSProperties;
  }
  const padding = config.value.sidebar.autoHide
    ? '40px'
    : `${config.value.sidebar.width + 40}px`;
  return (
    config.value.sidebar.side === 'left'
      ? { '--stage-pad-left': padding, '--stage-pad-right': '40px' }
      : { '--stage-pad-left': '40px', '--stage-pad-right': padding }
  ) as CSSProperties;
});

const editorSiblings = computed<IconItem[]>(() => {
  const group = groups.value.find((item) => item.id === editor.groupId);
  if (!group) return [];
  if (editor.folderId) {
    const folder = group.items.find(
      (item): item is FolderItem => item.type === 'folder' && item.id === editor.folderId,
    );
    return folder ? [...folder.children] : [];
  }
  return group.items.filter((item): item is IconItem => item.type === 'icon');
});

const editorLocation = computed(() => {
  const group = groups.value.find((item) => item.id === editor.groupId);
  if (!group) return '';
  if (editor.folderId) {
    const folder = group.items.find(
      (item): item is FolderItem => item.type === 'folder' && item.id === editor.folderId,
    );
    return folder ? `${group.name} / ${folder.name}` : group.name;
  }
  return group.name;
});

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const mode = config.value.theme.mode;
  const dark = mode === 'dark' || (mode === 'auto' && prefersDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    void flushConfig();
    void flushNav();
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  await Promise.all([configStore.init(), navStore.init()]);
  applyTheme();
  try {
    await wallpaperStore.init();
  } finally {
    window.dispatchEvent(new Event('suntab-wallpaper-ready'));
  }
  prefersDark.addEventListener('change', applyTheme);
});

onBeforeUnmount(() => {
  prefersDark.removeEventListener('change', applyTheme);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (toastTimer) window.clearTimeout(toastTimer);
});

watch(() => config.value.theme.mode, applyTheme);

function toggleMinimal() {
  configStore.toggleMinimal();
}

function openUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function findFolder(groupId: string, folderId: string): FolderItem | null {
  const group = groups.value.find((item) => item.id === groupId);
  return (
    group?.items.find(
      (item): item is FolderItem => item.type === 'folder' && item.id === folderId,
    ) ?? null
  );
}

function cleanupIconBlob(item: IconItem) {
  if (item.icon.kind === 'upload' && item.icon.value) {
    void deleteIconBlob(item.icon.value);
  }
}

function cleanupFolderBlobs(folder: FolderItem) {
  for (const child of folder.children) cleanupIconBlob(child);
}

function cleanupGroupBlobs(group: NavGroup) {
  for (const item of group.items) {
    if (item.type === 'icon') cleanupIconBlob(item);
    else cleanupFolderBlobs(item);
  }
}

function openAddIcon(folderId: string | null = null) {
  editor.open = true;
  editor.mode = 'create';
  editor.groupId = activeGroup.value.id;
  editor.folderId = folderId;
  editor.item = null;
}

function openEditIcon(item: IconItem, folderId: string | null = null, groupId?: string) {
  editor.open = true;
  editor.mode = 'edit';
  editor.groupId = groupId ?? activeGroup.value.id;
  editor.folderId = folderId;
  editor.item = item;
}

function handleIconSubmit(draft: IconDraft) {
  const { groupId, folderId, item, mode } = editor;
  if (mode === 'edit' && item) {
    navStore.updateIcon(groupId, folderId, item.id, draft);
    notify('图标已更新');
    return;
  }
  navStore.addIcon(groupId, folderId, {
    id: crypto.randomUUID(),
    type: 'icon',
    ...draft,
  });
  notify(folderId ? '已添加到文件夹' : '图标已添加');
}

function openFolder(folderId: string) {
  folderState.groupId = activeGroup.value.id;
  folderState.folderId = folderId;
  folderState.open = true;
}

function handleReorder(from: number, to: number) {
  navStore.moveItem(activeGroup.value.id, from, to);
}

function showMenu(event: MouseEvent, items: MenuEntry[]) {
  event.preventDefault();
  menu.items = items;
  menu.x = event.clientX;
  menu.y = event.clientY;
  menu.open = true;
}

function askName(options: {
  title: string;
  subtitle?: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
}) {
  prompt.title = options.title;
  prompt.subtitle = options.subtitle ?? '';
  prompt.label = options.label ?? '名称';
  prompt.initial = options.initial ?? '';
  prompt.placeholder = options.placeholder ?? '';
  prompt.confirmLabel = options.confirmLabel ?? '确定';
  prompt.onSubmit = options.onSubmit;
  prompt.open = true;
}

function askConfirm(options: {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  extraLabel?: string;
  onConfirm: () => void;
  onExtra?: () => void;
}) {
  confirmState.title = options.title;
  confirmState.message = options.message;
  confirmState.detail = options.detail ?? '';
  confirmState.confirmLabel = options.confirmLabel ?? '删除';
  confirmState.extraLabel = options.extraLabel ?? '';
  confirmState.onConfirm = options.onConfirm;
  confirmState.onExtra = options.onExtra ?? (() => {});
  confirmState.open = true;
}

function requestAddGroup() {
  askName({
    title: '新建分组',
    subtitle: '分组会显示在侧边栏，可随时重命名或删除',
    label: '分组名称',
    placeholder: '例如：工作',
    confirmLabel: '创建',
    onSubmit: (name) => {
      navStore.addGroup(name);
      notify(`已创建分组「${name}」`);
    },
  });
}

function requestRenameGroup(group: NavGroup) {
  askName({
    title: '重命名分组',
    label: '分组名称',
    initial: group.name,
    confirmLabel: '保存',
    onSubmit: (name) => {
      navStore.renameGroup(group.id, name);
      notify('分组已重命名');
    },
  });
}

function requestDeleteGroup(group: NavGroup) {
  if (groups.value.length <= 1) {
    notify('至少保留一个分组');
    return;
  }
  const count = group.items.reduce(
    (total, item) => total + (item.type === 'icon' ? 1 : item.children.length),
    0,
  );
  askConfirm({
    title: '删除分组',
    message: `确定删除分组「${group.name}」吗？`,
    detail: count
      ? `分组内 ${count} 个图标会一并删除，且不可恢复。`
      : '删除后不可恢复。',
    confirmLabel: '删除分组',
    onConfirm: () => {
      if (!navStore.removeGroup(group.id)) {
        notify('至少保留一个分组');
        return;
      }
      cleanupGroupBlobs(group);
      notify('分组已删除');
    },
  });
}

function requestAddFolder() {
  const groupId = activeGroup.value.id;
  askName({
    title: '新建文件夹',
    subtitle: `添加到「${activeGroup.value.name}」`,
    label: '文件夹名称',
    initial: '新建文件夹',
    confirmLabel: '创建',
    onSubmit: (name) => {
      if (!navStore.addFolder(groupId, name)) return;
      notify(`已创建文件夹「${name}」`);
    },
  });
}

function requestRenameFolder(groupId: string, folderId: string) {
  const folder = findFolder(groupId, folderId);
  if (!folder) return;
  askName({
    title: '重命名文件夹',
    label: '文件夹名称',
    initial: folder.name,
    confirmLabel: '保存',
    onSubmit: (name) => {
      navStore.renameFolder(groupId, folderId, name);
      notify('文件夹已重命名');
    },
  });
}

function requestDeleteFolder(groupId: string, folderId: string) {
  const folder = findFolder(groupId, folderId);
  if (!folder) return;
  const count = folder.children.length;
  askConfirm({
    title: '删除文件夹',
    message: count
      ? `「${folder.name}」中还有 ${count} 个图标。`
      : `确定删除文件夹「${folder.name}」吗？`,
    detail: count
      ? '选择“移到分组”会保留图标；选择“全部删除”会连同图标一起删除。'
      : '删除后不可恢复。',
    confirmLabel: count ? '全部删除' : '删除',
    extraLabel: count ? `移到分组（${count}）` : '',
    onConfirm: () => {
      cleanupFolderBlobs(folder);
      navStore.removeFolder(groupId, folderId, false);
      notify('文件夹已删除');
    },
    onExtra: () => {
      navStore.removeFolder(groupId, folderId, true);
      notify(`文件夹已删除，${count} 个图标已移到分组`);
    },
  });
}

function requestDeleteIcon(item: IconItem, folderId: string | null, groupId: string) {
  askConfirm({
    title: '删除图标',
    message: `确定删除「${item.name}」吗？`,
    detail: '删除后不可恢复。',
    confirmLabel: '删除',
    onConfirm: () => {
      navStore.removeIcon(groupId, folderId, item.id);
      cleanupIconBlob(item);
      notify('图标已删除');
    },
  });
}

function isNativeMenuTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  );
}

function onShellContextMenu(event: MouseEvent) {
  if (event.defaultPrevented || isNativeMenuTarget(event.target)) return;
  openBlankMenu(event);
}

function openBlankMenu(event: MouseEvent) {
  showMenu(event, [
    {
      id: 'add-icon',
      label: '添加图标',
      icon: IconPlus,
      action: () => openAddIcon(),
    },
    {
      id: 'add-folder',
      label: '新建文件夹',
      icon: IconFolderPlus,
      action: requestAddFolder,
    },
    {
      id: 'add-group',
      label: '新建分组',
      icon: IconLayoutGrid,
      action: requestAddGroup,
    },
    {
      id: 'wallpaper',
      label: '换壁纸',
      icon: IconWallpaper,
      divider: true,
      action: () => {
        wallpaperPanelOpen.value = true;
      },
    },
    {
      id: 'settings',
      label: '设置',
      icon: IconSettings,
      action: () => {
        settingsOpen.value = true;
      },
    },
  ]);
}

function openItemMenu(item: NavItem, event: MouseEvent) {
  if (item.type === 'folder') {
    openFolderMenu(item, event);
  } else {
    openIconMenu(item, event);
  }
}

function openIconMenu(item: IconItem, event: MouseEvent) {
  const groupId = activeGroup.value.id;
  const folders = activeGroup.value.items.filter(
    (candidate): candidate is FolderItem => candidate.type === 'folder',
  );
  const otherGroups = groups.value.filter((group) => group.id !== groupId);

  const entries: MenuEntry[] = [
    {
      id: 'open',
      label: '打开',
      icon: IconExternalLink,
      action: () => openUrl(item.url),
    },
    {
      id: 'edit',
      label: '编辑',
      icon: IconPencil,
      action: () => openEditIcon(item, null, groupId),
    },
  ];

  if (otherGroups.length) {
    entries.push({
      id: 'move-to-group',
      label: '移动到分组',
      icon: IconLayoutGrid,
      children: otherGroups.map((group) => ({
        id: `move-group-${group.id}`,
        label: group.name,
        icon: IconLayoutGrid,
        action: () => {
          if (navStore.moveIconToGroup(groupId, item.id, group.id)) {
            notify(`已移动到「${group.name}」`);
          }
        },
      })),
    });
  }

  if (folders.length) {
    entries.push({
      id: 'move-to-folder',
      label: '移动到文件夹',
      icon: IconFolderSymlink,
      children: folders.map((folder) => ({
        id: `move-${folder.id}`,
        label: folder.name,
        icon: IconFolder,
        action: () => {
          navStore.moveIconToFolder(groupId, item.id, folder.id);
          notify(`已移动到「${folder.name}」`);
        },
      })),
    });
  }

  entries.push({
    id: 'delete',
    label: '删除',
    icon: IconTrash,
    danger: true,
    divider: true,
    action: () => requestDeleteIcon(item, null, groupId),
  });

  showMenu(event, entries);
}

function openFolderMenu(folder: FolderItem, event: MouseEvent) {
  const groupId = activeGroup.value.id;
  showMenu(event, [
    {
      id: 'open',
      label: '打开',
      icon: IconFolderOpen,
      action: () => openFolder(folder.id),
    },
    {
      id: 'rename',
      label: '重命名',
      icon: IconPencil,
      action: () => requestRenameFolder(groupId, folder.id),
    },
    {
      id: 'delete',
      label: '删除',
      icon: IconTrash,
      danger: true,
      divider: true,
      action: () => requestDeleteFolder(groupId, folder.id),
    },
  ]);
}

function openChildMenu(item: IconItem, event: MouseEvent) {
  const { groupId, folderId } = folderState;
  if (!folderId) return;
  showMenu(event, [
    {
      id: 'open',
      label: '打开',
      icon: IconExternalLink,
      action: () => openUrl(item.url),
    },
    {
      id: 'edit',
      label: '编辑',
      icon: IconPencil,
      action: () => openEditIcon(item, folderId, groupId),
    },
    {
      id: 'move-out',
      label: '移出到分组',
      icon: IconFolderSymlink,
      action: () => {
        navStore.moveIconOutOfFolder(groupId, folderId, item.id);
        notify('已移出到分组');
      },
    },
    {
      id: 'delete',
      label: '删除',
      icon: IconTrash,
      danger: true,
      divider: true,
      action: () => requestDeleteIcon(item, folderId, groupId),
    },
  ]);
}

function openGroupMenu(group: NavGroup, event: MouseEvent) {
  const canDelete = groups.value.length > 1;
  showMenu(event, [
    {
      id: 'rename-group',
      label: '重命名分组',
      icon: IconPencil,
      action: () => requestRenameGroup(group),
    },
    {
      id: 'add-group',
      label: '新建分组',
      icon: IconPlus,
      action: requestAddGroup,
    },
    {
      id: 'delete-group',
      label: '删除分组',
      icon: IconTrash,
      danger: true,
      disabled: !canDelete,
      title: canDelete ? undefined : '至少保留一个分组',
      divider: true,
      action: () => requestDeleteGroup(group),
    },
  ]);
}
</script>

<template>
  <div
    class="shell"
    :class="{
      'is-minimal': isMinimal,
      'is-light': lightWallpaper,
      'is-drawer-open': settingsOpen || wallpaperPanelOpen,
    }"
    :style="shellStyle"
    @contextmenu="onShellContextMenu"
  >
    <div class="wallpaper" :style="wallpaperStyle"></div>
    <div class="scrim" :style="scrimStyle"></div>

    <SideBar
      v-if="!isMinimal"
      :groups="groups"
      :active-id="activeGroupId"
      :side="config.sidebar.side"
      :width="config.sidebar.width"
      :opacity="config.sidebar.opacity"
      :auto-hide="config.sidebar.autoHide"
      @select="navStore.setActiveGroup"
      @add-group="requestAddGroup"
      @settings="settingsOpen = true"
      @group-menu="openGroupMenu"
    />

    <main class="stage" :style="stageStyle">
      <div class="hero">
        <ClockPanel :clock="config.clock" :light="lightWallpaper" @toggle="toggleMinimal" />
        <div v-if="config.search.show" class="search-wrap">
          <SearchBar
            :engines="config.search.engines"
            :engine-id="config.search.engineId"
            :open-in-new-tab="config.search.openInNewTab"
            :groups="groups"
            @update:engine-id="configStore.setEngine"
          />
        </div>
      </div>

      <div v-if="!isMinimal" class="grid-wrap">
        <IconGrid
          :items="activeGroup.items"
          @add="openAddIcon()"
          @open-folder="openFolder"
          @item-menu="openItemMenu"
          @blank-menu="openBlankMenu"
          @reorder="handleReorder"
        />
      </div>

      <div v-if="config.layout.showQuote" class="quote-wrap">
        <QuoteFooter />
      </div>
    </main>

    <div class="toolbar">
      <button
        type="button"
        class="tool-button wallpaper-button"
        title="换壁纸"
        aria-label="换壁纸"
        @click="wallpaperPanelOpen = true"
      >
        <IconPhoto size="19" stroke="1.8" />
      </button>
      <button
        type="button"
        class="tool-button settings-button"
        title="设置"
        aria-label="设置"
        @click="settingsOpen = true"
      >
        <IconSettings size="19" stroke="1.8" />
      </button>
      <button
        type="button"
        class="tool-button mode-toggle"
        :title="isMinimal ? '显示图标' : '进入极简模式'"
        :aria-label="isMinimal ? '显示图标' : '进入极简模式'"
        @click="toggleMinimal"
      >
        <IconLayoutGrid v-if="isMinimal" size="19" stroke="1.8" />
        <IconMinimize v-else size="19" stroke="1.8" />
      </button>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>

    <WallpaperPanel v-model:open="wallpaperPanelOpen" />
    <SettingsDrawer
      v-model:open="settingsOpen"
      @open-wallpaper="wallpaperPanelOpen = true"
    />

    <IconEditorDialog
      v-model:open="editor.open"
      :mode="editor.mode"
      :item="editor.item"
      :siblings="editorSiblings"
      :location-label="editorLocation"
      @submit="handleIconSubmit"
    />

    <FolderDialog
      v-model:open="folderState.open"
      :group-id="folderState.groupId"
      :folder-id="folderState.folderId"
      @add="openAddIcon(folderState.folderId)"
      @edit-child="(item) => openEditIcon(item, folderState.folderId, folderState.groupId)"
      @child-menu="openChildMenu"
      @rename="requestRenameFolder(folderState.groupId, folderState.folderId)"
      @delete="requestDeleteFolder(folderState.groupId, folderState.folderId)"
    />

    <PromptDialog
      v-model:open="prompt.open"
      :title="prompt.title"
      :subtitle="prompt.subtitle"
      :label="prompt.label"
      :initial="prompt.initial"
      :placeholder="prompt.placeholder"
      :confirm-label="prompt.confirmLabel"
      @submit="prompt.onSubmit"
    />

    <ConfirmDialog
      v-model:open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :detail="confirmState.detail"
      :confirm-label="confirmState.confirmLabel"
      :extra-label="confirmState.extraLabel"
      @confirm="confirmState.onConfirm"
      @extra="confirmState.onExtra"
    />

    <ContextMenu
      :open="menu.open"
      :x="menu.x"
      :y="menu.y"
      :items="menu.items"
      @close="menu.open = false"
    />
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  width: 100%;
  min-height: 100vh;
  overflow-x: clip;
  background: transparent;
  color: var(--shell-text);
  --icon-add-border: rgba(255, 255, 255, 0.34);
  --icon-add-hover-border: rgba(255, 255, 255, 0.5);
  --add-glass: rgba(255, 255, 255, 0.1);
  --add-glass-hover: rgba(255, 255, 255, 0.12);
}

.shell.is-light {
  --shell-text: #20242a;
  --shell-text-soft: rgba(32, 36, 42, 0.68);
  --shell-text-faint: rgba(32, 36, 42, 0.45);
  --shell-glass: rgba(255, 255, 255, 0.52);
  --shell-glass-strong: rgba(255, 255, 255, 0.74);
  --shell-border: rgba(32, 36, 42, 0.12);
  --shell-hover: rgba(32, 36, 42, 0.06);
  --shell-active: rgba(255, 255, 255, 0.64);
  --shell-focus: rgba(32, 36, 42, 0.5);
  --icon-glass: rgba(255, 255, 255, 0.5);
  --icon-glass-hover: rgba(255, 255, 255, 0.68);
  --icon-glass-faint: rgba(32, 36, 42, 0.04);
  --icon-border: rgba(32, 36, 42, 0.12);
  --icon-border-hover: rgba(32, 36, 42, 0.22);
  --icon-add-border: rgba(32, 36, 42, 0.26);
  --icon-add-hover-border: rgba(32, 36, 42, 0.42);
  --add-glass: rgba(255, 255, 255, 0.5);
  --add-glass-hover: rgba(255, 255, 255, 0.68);
  --icon-shadow:
    0 0 5px rgba(32, 36, 42, 0.1),
    0 8px 20px rgba(32, 36, 42, 0.06);
  --icon-shadow-hover:
    0 0 10px rgba(32, 36, 42, 0.16),
    0 12px 26px rgba(32, 36, 42, 0.1);
  --icon-edge: 0 0 0 1px rgba(32, 36, 42, 0.06);
  --icon-edge-hover: 0 0 0 1px rgba(32, 36, 42, 0.1);
  --icon-label-shadow: none;
  --search-bg: rgba(255, 255, 255, 0.62);
  --search-bg-hover: rgba(255, 255, 255, 0.78);
  --search-bg-focus: #ffffff;
  --search-border: rgba(32, 36, 42, 0.1);
  --search-border-focus: rgba(32, 36, 42, 0.2);
  --search-shadow:
    0 1px 2px rgba(32, 36, 42, 0.04),
    0 10px 26px rgba(32, 36, 42, 0.06);
  --search-text: #1f2937;
  --search-muted: rgba(31, 41, 55, 0.48);
  --search-hover: rgba(31, 41, 55, 0.06);
  --clock-shadow: none;
  --shell-text-shadow: none;
}

.wallpaper {
  position: fixed;
  inset: -30px;
  background-position: center;
  background-size: cover;
  transform: scale(1.04);
  transition: filter 300ms var(--ease);
}

.scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.stage {
  position: relative;
  z-index: 2;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  padding-top: clamp(16px, 3vh, 32px);
  padding-right: var(--stage-pad-right, 40px);
  padding-bottom: 12px;
  padding-left: var(--stage-pad-left, 40px);
  transition: padding 240ms var(--ease);
}

.hero {
  display: flex;
  width: min(640px, 100%);
  flex-direction: column;
  align-items: center;
}

.search-wrap {
  width: 100%;
  margin-top: clamp(16px, 2.6vh, 24px);
}

@media (min-width: 1025px) {
  .shell.is-drawer-open .stage {
    padding-right: calc(var(--drawer-width) + 40px);
  }
}

.grid-wrap {
  display: flex;
  width: 100%;
  flex: 1;
  justify-content: center;
  align-items: flex-start;
  padding-top: clamp(20px, 4vh, 44px);
}

.quote-wrap {
  display: flex;
  width: 100%;
  justify-content: center;
  margin-top: auto;
  padding: 16px 0 8px;
}

.toolbar {
  position: fixed;
  top: 18px;
  right: 20px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

.tool-button {
  display: grid;
  width: 36px;
  height: 36px;
  border: 1px solid var(--shell-border);
  border-radius: var(--radius-md);
  background: var(--shell-glass);
  color: var(--shell-text-soft);
  opacity: 0.55;
  place-items: center;
  backdrop-filter: blur(12px);
  transition:
    opacity 160ms var(--ease),
    background 160ms var(--ease),
    color 160ms var(--ease);
}

.tool-button:hover {
  background: var(--shell-glass-strong);
  color: var(--shell-text);
  opacity: 1;
}

.tool-button:focus-visible {
  outline: 2px solid var(--shell-focus);
  outline-offset: 2px;
}

.shell.is-minimal .stage {
  padding-top: clamp(88px, 16vh, 180px);
}

.shell.is-minimal .quote-wrap {
  margin-top: auto;
}

.toast {
  position: fixed;
  bottom: 76px;
  left: 50%;
  z-index: 30;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-md);
  background: rgba(15, 18, 30, 0.82);
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms var(--ease),
    transform 180ms var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}

@media (max-width: 720px) {
  .search-wrap {
    width: calc(100vw - 96px);
  }

  .stage {
    padding-bottom: 8px;
  }
}
</style>
