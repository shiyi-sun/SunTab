<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '../../../stores/config';
import type { ThemeMode } from '../../../shared/types';
import ColorField from '../ColorField.vue';
import SegmentedControl from '../SegmentedControl.vue';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';

const configStore = useConfigStore();

const themeOptions = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const themeMode = computed({
  get: () => configStore.config.theme.mode,
  set: (value: string) => {
    configStore.config.theme.mode = value as ThemeMode;
  },
});

const accent = computed({
  get: () => configStore.config.theme.accent,
  set: (value: string) => {
    configStore.config.theme.accent = value;
  },
});
</script>

<template>
  <SettingsSection title="外观" description="主题模式与主题色；浅色壁纸会自动切换为深墨文字，保证可读。">
    <SettingRow label="主题模式" description="影响设置面板、壁纸面板与控件的明暗">
      <SegmentedControl v-model="themeMode" :options="themeOptions" />
    </SettingRow>
    <SettingRow label="主题色" description="按钮与选中状态的主色">
      <ColorField v-model="accent" />
    </SettingRow>
  </SettingsSection>
</template>
