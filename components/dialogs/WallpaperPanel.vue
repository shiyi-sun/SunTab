<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IconUpload, IconX } from '@tabler/icons-vue';
import { useConfigStore } from '../../stores/config';
import { useWallpaperStore } from '../../stores/wallpaper';
import {
  COLOR_PRESETS,
  WALLPAPER_PRESETS,
  type WallpaperPreset,
} from '../../shared/defaults';

const open = defineModel<boolean>('open', { default: false });

const configStore = useConfigStore();
const wallpaperStore = useWallpaperStore();

const tabs = [
  { id: 'gradient', label: '渐变' },
  { id: 'color', label: '纯色' },
  { id: 'upload', label: '上传' },
  { id: 'bing', label: '必应' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const tab = ref<TabId>('gradient');
const colorValue = ref('#0b1026');
const colorPresets = COLOR_PRESETS;

const gradients = WALLPAPER_PRESETS;

const blur = computed({
  get: () => configStore.config.wallpaper.blur,
  set: (value: number) => wallpaperStore.setBlur(value),
});

const dim = computed({
  get: () => configStore.config.wallpaper.dim,
  set: (value: number) => wallpaperStore.setDim(value),
});

const isGradientActive = (value: string) =>
  configStore.config.wallpaper.kind === 'gradient' &&
  configStore.config.wallpaper.value === value;

const isColorActive = (value: string) =>
  configStore.config.wallpaper.kind === 'color' &&
  configStore.config.wallpaper.value === value;

function close() {
  open.value = false;
}

function applyGradient(preset: WallpaperPreset) {
  wallpaperStore.setGradient(preset.value);
  if (typeof preset.dim === 'number') wallpaperStore.setDim(preset.dim);
}

function applyColor() {
  wallpaperStore.setColor(colorValue.value);
}

function applyPresetColor(value: string) {
  colorValue.value = value;
  wallpaperStore.setColor(value);
}

async function handleFile(file: File | null | undefined) {
  if (!file) return;
  await wallpaperStore.uploadFile(file);
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  void handleFile(input.files?.[0]);
  input.value = '';
}

function onDrop(event: DragEvent) {
  void handleFile(event.dataTransfer?.files?.[0]);
}

async function useBing() {
  await wallpaperStore.enableBing();
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close();
}

watch(open, (value) => {
  if (!value) return;
  wallpaperStore.error = '';
  const kind = configStore.config.wallpaper.kind;
  tab.value =
    kind === 'upload' ? 'upload' : kind === 'bing' ? 'bing' : kind === 'color' ? 'color' : 'gradient';
  if (kind === 'color') colorValue.value = configStore.config.wallpaper.value;
  document.body.style.overflow = 'hidden';
});

watch(open, (value) => {
  if (!value) document.body.style.overflow = '';
});

onMounted(() => {
  document.addEventListener('keydown', onEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="wp-fade">
      <div v-if="open" class="wp-overlay" @click.self="close">
        <section class="wp-panel" role="dialog" aria-modal="true" aria-label="壁纸设置">
          <header class="wp-header">
            <div>
              <h2>换壁纸</h2>
              <p>当前：{{ wallpaperStore.currentLabel }} · 改动实时生效</p>
            </div>
            <button type="button" class="wp-close" aria-label="关闭壁纸设置" @click="close">
              <IconX size="18" stroke="2" />
            </button>
          </header>

          <div class="wp-tabs" role="tablist" aria-label="壁纸来源">
            <button
              v-for="item in tabs"
              :key="item.id"
              type="button"
              class="wp-tab"
              :class="{ active: tab === item.id }"
              role="tab"
              :aria-selected="tab === item.id"
              @click="tab = item.id"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="wp-body">
            <div v-if="tab === 'gradient'" class="gradient-grid">
              <button
                v-for="preset in gradients"
                :key="preset.value"
                type="button"
                class="gradient-preset"
                :class="{ active: isGradientActive(preset.value) }"
                :title="`使用${preset.name}壁纸`"
                :aria-label="`使用${preset.name}壁纸`"
                :disabled="wallpaperStore.busy"
                @click="applyGradient(preset)"
              >
                <span class="gradient-swatch" :style="{ background: preset.value }"></span>
                <span class="gradient-name">
                  {{ preset.name }}
                  <em v-if="preset.tone === 'light'">浅色</em>
                </span>
              </button>
            </div>

            <div v-else-if="tab === 'color'" class="color-panel">
              <div class="color-controls">
                <input v-model="colorValue" type="color" aria-label="选择壁纸颜色" :disabled="wallpaperStore.busy" />
                <button type="button" class="primary-btn" :disabled="wallpaperStore.busy" @click="applyColor">
                  应用颜色
                </button>
              </div>
              <div class="color-presets">
                <button
                  v-for="preset in colorPresets"
                  :key="preset.value"
                  type="button"
                  class="color-preset"
                  :class="{ active: isColorActive(preset.value) }"
                  :title="`${preset.name} ${preset.value}`"
                  :aria-label="`使用颜色 ${preset.name} ${preset.value}`"
                  :disabled="wallpaperStore.busy"
                  @click="applyPresetColor(preset.value)"
                >
                  <span class="color-dot" :style="{ background: preset.value }"></span>
                  <span class="color-name">{{ preset.name }}</span>
                </button>
              </div>
            </div>

            <label
              v-else-if="tab === 'upload'"
              class="upload-zone"
              :class="{ busy: wallpaperStore.busy }"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <IconUpload size="28" stroke="1.6" />
              <strong>{{ wallpaperStore.busy ? '处理中…' : '选择或拖入图片' }}</strong>
              <span>支持 JPG / PNG / WebP，最大 8MB</span>
              <input
                type="file"
                accept="image/*"
                class="file-input"
                :disabled="wallpaperStore.busy"
                @change="onFileInput"
              />
            </label>

            <div v-else class="bing-panel">
              <div>
                <h3>必应每日</h3>
                <p>每天从必应获取一张 4K 壁纸，开启时才会联网。</p>
                <p v-if="wallpaperStore.copyright" class="bing-credit">
                  图片来源：{{ wallpaperStore.copyright }}
                </p>
              </div>
              <button
                type="button"
                class="primary-btn"
                :disabled="wallpaperStore.busy"
                @click="useBing"
              >
                {{ wallpaperStore.busy ? '获取中…' : '使用必应每日' }}
              </button>
            </div>

            <p v-if="wallpaperStore.error" class="wp-error">{{ wallpaperStore.error }}</p>
          </div>

          <footer class="wp-sliders">
            <label class="slider-row">
              <span>模糊</span>
              <input v-model.number="blur" type="range" min="0" max="20" step="1" />
              <em>{{ blur }}px</em>
            </label>
            <label class="slider-row">
              <span>遮罩</span>
              <input v-model.number="dim" type="range" min="0" max="60" step="1" />
              <em>{{ dim }}%</em>
            </label>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.wp-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: flex-end;
  background: transparent;
}

.wp-panel {
  display: flex;
  width: min(var(--drawer-width, 460px), 94vw);
  height: 100%;
  flex-direction: column;
  border-left: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  color: var(--panel-text);
}

@media (max-width: 1024px) {
  .wp-overlay {
    background: rgba(5, 8, 16, 0.32);
    backdrop-filter: blur(6px);
  }

  .wp-panel {
    width: 100%;
  }
}

.wp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 16px 12px;
  border-bottom: 1px solid var(--panel-border);
}

.wp-header h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.02em;
}

.wp-header p {
  margin: 4px 0 0;
  color: var(--panel-muted);
  font-size: 11px;
}

.wp-close {
  display: grid;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--panel-input);
  color: var(--panel-muted);
  place-items: center;
}

.wp-close:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.wp-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 16px 0;
}

.wp-tab {
  padding: 8px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-muted);
  font-size: 12px;
}

.wp-tab:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.wp-tab.active {
  background: var(--accent);
  color: #fff;
}

.wp-body {
  min-height: 0;
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.gradient-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.gradient-preset {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--panel-muted);
  text-align: left;
}

.gradient-swatch {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: transform 160ms var(--ease);
}

.gradient-preset:hover .gradient-swatch {
  transform: translateY(-2px);
}

.gradient-preset.active .gradient-swatch {
  border-color: var(--panel-text);
}

.gradient-name {
  display: flex;
  align-items: baseline;
  gap: 4px;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gradient-name em {
  color: var(--accent);
  font-size: 9px;
  font-style: normal;
}

.gradient-preset:disabled,
.color-preset:disabled {
  cursor: default;
  opacity: 0.45;
}

.color-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.color-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-controls input[type='color'] {
  width: 52px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}

.color-presets {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.color-preset {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-muted);
  font-size: 10px;
}

.color-preset:hover {
  background: var(--panel-hover);
}

.color-preset.active {
  border-color: var(--accent);
  color: var(--panel-text);
}

.color-dot {
  width: 28px;
  height: 28px;
  border: 1px solid var(--panel-border);
  border-radius: 50%;
}

.color-name {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.primary-btn {
  padding: 8px 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.primary-btn:hover {
  filter: brightness(1.08);
}

.primary-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.upload-zone {
  display: flex;
  min-height: 170px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  border: 1px dashed var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
  color: var(--panel-muted);
  cursor: pointer;
  text-align: center;
  transition:
    background 160ms var(--ease),
    border-color 160ms var(--ease);
}

.upload-zone:hover,
.upload-zone.busy {
  border-color: var(--panel-faint);
  background: var(--panel-hover);
}

.upload-zone strong {
  color: var(--panel-text);
  font-size: 14px;
}

.upload-zone span {
  font-size: 12px;
}

.file-input {
  display: none;
}

.bing-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.bing-panel h3 {
  margin: 0;
  font-size: 15px;
}

.bing-panel p {
  margin: 8px 0 0;
  color: var(--panel-muted);
  font-size: 12px;
  line-height: 1.6;
}

.bing-credit {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wp-error {
  margin: 12px 0 0;
  color: #ff8d8d;
  font-size: 12px;
}

.wp-sliders {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--panel-border);
}

.slider-row {
  display: grid;
  grid-template-columns: 40px 1fr 44px;
  align-items: center;
  gap: 12px;
  color: var(--panel-muted);
  font-size: 12px;
}

.slider-row input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}

.slider-row em {
  color: var(--panel-faint);
  font-style: normal;
  text-align: right;
}

.wp-fade-enter-active,
.wp-fade-leave-active {
  transition: opacity 180ms var(--ease);
}

.wp-fade-enter-active .wp-panel,
.wp-fade-leave-active .wp-panel {
  transition: transform 220ms var(--ease);
}

.wp-fade-enter-from,
.wp-fade-leave-to {
  opacity: 0;
}

.wp-fade-enter-from .wp-panel,
.wp-fade-leave-to .wp-panel {
  transform: translateX(24px);
}
</style>
