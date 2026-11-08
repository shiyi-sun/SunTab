<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
} from 'vue';
import {
  IconClock,
  IconDatabase,
  IconGridDots,
  IconInfoCircle,
  IconLayoutDashboard,
  IconLayoutSidebar,
  IconPalette,
  IconPhoto,
  IconSearch,
  IconX,
} from '@tabler/icons-vue';
import { APP_VERSION } from '../../shared/defaults';
import AboutSection from './sections/AboutSection.vue';
import AppearanceSection from './sections/AppearanceSection.vue';
import ClockSection from './sections/ClockSection.vue';
import DataSection from './sections/DataSection.vue';
import IconSection from './sections/IconSection.vue';
import LayoutSection from './sections/LayoutSection.vue';
import SearchSection from './sections/SearchSection.vue';
import SidebarSection from './sections/SidebarSection.vue';
import WallpaperSection from './sections/WallpaperSection.vue';

type SectionId =
  | 'appearance'
  | 'wallpaper'
  | 'search'
  | 'icon'
  | 'clock'
  | 'layout'
  | 'sidebar'
  | 'data'
  | 'about';

interface Section {
  id: SectionId;
  label: string;
  icon: Component;
}

const sections: Section[] = [
  { id: 'appearance', label: '外观', icon: IconPalette },
  { id: 'wallpaper', label: '壁纸', icon: IconPhoto },
  { id: 'search', label: '搜索', icon: IconSearch },
  { id: 'icon', label: '图标', icon: IconGridDots },
  { id: 'clock', label: '时钟', icon: IconClock },
  { id: 'layout', label: '布局', icon: IconLayoutDashboard },
  { id: 'sidebar', label: '侧边栏', icon: IconLayoutSidebar },
  { id: 'data', label: '数据', icon: IconDatabase },
  { id: 'about', label: '关于', icon: IconInfoCircle },
];

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{
  openWallpaper: [];
}>();

const activeSection = ref<SectionId>('appearance');
const drawerRef = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

function close() {
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return;
  if (document.querySelector('.dialog-overlay, .ctx-menu, .wp-overlay')) return;
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab' || !drawerRef.value) return;
  const focusable = Array.from(
    drawerRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && (active === first || !drawerRef.value.contains(active))) {
    event.preventDefault();
    last.focus();
  }
}

watch(open, async (value) => {
  document.body.style.overflow = value ? 'hidden' : '';
  if (value) {
    previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    drawerRef.value?.querySelector<HTMLElement>('.nav-item')?.focus();
  } else {
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
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div v-if="open" class="settings-overlay" @click.self="close">
        <aside
          ref="drawerRef"
          class="settings-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="设置"
        >
          <header class="settings-header">
            <div>
              <h2>设置</h2>
              <p>本地优先 · 修改自动保存</p>
            </div>
            <button type="button" class="settings-close" aria-label="关闭设置" @click="close">
              <IconX size="18" stroke="2" />
            </button>
          </header>

          <div class="settings-layout">
            <nav class="settings-nav" aria-label="设置分区">
              <button
                v-for="section in sections"
                :key="section.id"
                type="button"
                class="nav-item"
                :class="{ active: activeSection === section.id }"
                :title="section.label"
                :aria-label="section.label"
                :aria-current="activeSection === section.id ? 'page' : undefined"
                @click="activeSection = section.id"
              >
                <component :is="section.icon" size="18" stroke="1.8" />
                <span>{{ section.label }}</span>
              </button>
            </nav>

            <div class="settings-content">
              <AppearanceSection v-if="activeSection === 'appearance'" />
              <WallpaperSection
                v-else-if="activeSection === 'wallpaper'"
                @open="emit('openWallpaper')"
              />
              <SearchSection v-else-if="activeSection === 'search'" />
              <IconSection v-else-if="activeSection === 'icon'" />
              <ClockSection v-else-if="activeSection === 'clock'" />
              <LayoutSection v-else-if="activeSection === 'layout'" />
              <SidebarSection v-else-if="activeSection === 'sidebar'" />
              <DataSection v-else-if="activeSection === 'data'" />
              <AboutSection v-else />
            </div>
          </div>

          <footer class="settings-footer">SunTab v{{ APP_VERSION }} · 数据只保存在本机</footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  justify-content: flex-end;
  background: transparent;
}

.settings-drawer {
  display: flex;
  width: min(var(--drawer-width, 460px), 94vw);
  height: 100%;
  flex-direction: column;
  border-left: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  color: var(--panel-text);
  container-type: inline-size;
}

@media (max-width: 1024px) {
  .settings-overlay {
    background: rgba(5, 8, 16, 0.32);
    backdrop-filter: blur(6px);
  }

  .settings-drawer {
    width: 100%;
  }
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 16px 12px;
  border-bottom: 1px solid var(--panel-border);
}

.settings-header h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.02em;
}

.settings-header p {
  margin: 4px 0 0;
  color: var(--panel-muted);
  font-size: 11px;
}

.settings-close {
  display: grid;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--panel-input);
  color: var(--panel-muted);
  place-items: center;
}

.settings-close:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.settings-layout {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 56px minmax(0, 1fr);
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px;
  overflow-y: auto;
  border-right: 1px solid var(--panel-border);
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 100%;
  padding: 12px 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-muted);
  font-size: 13px;
  text-align: left;
  transition:
    background 160ms var(--ease),
    color 160ms var(--ease);
}

.nav-item span {
  display: none;
}

@container (min-width: 420px) {
  .settings-layout {
    grid-template-columns: 120px minmax(0, 1fr);
  }

  .nav-item {
    justify-content: flex-start;
    gap: 8px;
    padding: 8px 12px;
  }

  .nav-item span {
    display: inline;
  }
}

.nav-item:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.nav-item.active {
  background: rgb(76 141 255 / 16%);
  color: var(--panel-text);
}

.nav-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.settings-content {
  padding: 20px 20px 28px;
  overflow-y: auto;
}

.settings-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--panel-border);
  color: var(--panel-faint);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 180ms var(--ease);
}

.settings-fade-enter-active .settings-drawer,
.settings-fade-leave-active .settings-drawer {
  transition: transform 220ms var(--ease);
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

.settings-fade-enter-from .settings-drawer,
.settings-fade-leave-to .settings-drawer {
  transform: translateX(24px);
}

@media (max-width: 720px) {
  .settings-drawer {
    width: 100%;
  }

  .settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .settings-nav {
    flex-direction: row;
    overflow-x: auto;
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
  }

  .nav-item {
    width: auto;
    flex: none;
    gap: 8px;
    padding: 8px 12px;
    white-space: nowrap;
  }

  .nav-item span {
    display: inline;
  }

  .settings-content {
    padding: 20px 16px 28px;
  }
}
</style>
