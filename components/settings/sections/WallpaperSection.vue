<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { useConfigStore } from '../../../stores/config';
import { useWallpaperStore } from '../../../stores/wallpaper';
import RangeField from '../RangeField.vue';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';

const emit = defineEmits<{
  open: [];
}>();

const configStore = useConfigStore();
const wallpaperStore = useWallpaperStore();

const blur = computed({
  get: () => configStore.config.wallpaper.blur,
  set: (value: number) => wallpaperStore.setBlur(value),
});

const dim = computed({
  get: () => configStore.config.wallpaper.dim,
  set: (value: number) => wallpaperStore.setDim(value),
});

const previewStyle = computed<CSSProperties>(() => ({
  ...wallpaperStore.backgroundStyle,
  filter:
    wallpaperStore.displayBlur > 0 ? `blur(${wallpaperStore.displayBlur}px)` : 'none',
}));

const previewScrim = computed<CSSProperties>(() => ({
  background: `rgba(0, 0, 0, ${wallpaperStore.displayDim / 100})`,
}));
</script>

<template>
  <SettingsSection title="壁纸" description="图片保存在本地 IndexedDB；导出备份不包含壁纸原图。">
    <div class="wallpaper-preview">
      <div class="wallpaper-preview-bg" :style="previewStyle"></div>
      <div class="wallpaper-preview-scrim" :style="previewScrim"></div>
      <span class="wallpaper-label">{{ wallpaperStore.currentLabel }}</span>
    </div>

    <SettingRow label="壁纸来源" description="渐变、纯色、本地上传或必应每日">
      <button type="button" class="panel-btn primary" @click="emit('open')">打开壁纸面板</button>
    </SettingRow>

    <RangeField v-model="blur" label="模糊" :min="0" :max="20" suffix="px" />
    <RangeField v-model="dim" label="遮罩" :min="0" :max="60" suffix="%" />
  </SettingsSection>
</template>

<style scoped>
.wallpaper-preview {
  position: relative;
  height: 150px;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  background: #0b1026;
}

.wallpaper-preview-bg,
.wallpaper-preview-scrim {
  position: absolute;
  inset: -20px;
}

.wallpaper-preview-bg {
  background-position: center;
  background-size: cover;
  transform: scale(1.04);
}

.wallpaper-preview-scrim {
  inset: 0;
}

.wallpaper-label {
  position: absolute;
  bottom: 10px;
  left: 12px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.28);
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  backdrop-filter: blur(8px);
}
</style>
