<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '../../../stores/config';
import SegmentedControl from '../SegmentedControl.vue';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';
import ToggleSwitch from '../ToggleSwitch.vue';

const configStore = useConfigStore();

const layoutMode = computed({
  get: () => configStore.config.layout.mode,
  set: (value: string) => {
    configStore.config.layout.mode = value === 'minimal' ? 'minimal' : 'widgets';
  },
});

const layoutOptions = [
  { value: 'widgets', label: '组件模式' },
  { value: 'minimal', label: '极简模式' },
];
</script>

<template>
  <SettingsSection title="布局" description="切换桌面或极简模式；点击时钟也能快速切换。">
    <SettingRow label="布局模式">
      <SegmentedControl v-model="layoutMode" :options="layoutOptions" />
    </SettingRow>
    <SettingRow label="底部引用" description="在页面底部显示一句本地经典短句">
      <ToggleSwitch v-model="configStore.config.layout.showQuote" />
    </SettingRow>
  </SettingsSection>
</template>
