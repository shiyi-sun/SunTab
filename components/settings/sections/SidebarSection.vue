<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '../../../stores/config';
import RangeField from '../RangeField.vue';
import SegmentedControl from '../SegmentedControl.vue';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';
import ToggleSwitch from '../ToggleSwitch.vue';

const configStore = useConfigStore();

const side = computed({
  get: () => configStore.config.sidebar.side,
  set: (value: string) => {
    configStore.config.sidebar.side = value === 'right' ? 'right' : 'left';
  },
});

const opacity = computed({
  get: () => Math.round(configStore.config.sidebar.opacity * 100),
  set: (value: number) => {
    configStore.config.sidebar.opacity = value / 100;
  },
});

const sideOptions = [
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
];
</script>

<template>
  <SettingsSection title="侧边栏" description="分组侧栏的位置、宽度与显示方式。">
    <SettingRow label="位置">
      <SegmentedControl v-model="side" :options="sideOptions" />
    </SettingRow>
    <SettingRow label="自动隐藏" description="只保留一条细边，鼠标靠近时展开">
      <ToggleSwitch v-model="configStore.config.sidebar.autoHide" />
    </SettingRow>

    <RangeField
      :model-value="configStore.config.sidebar.width"
      label="宽度"
      :min="40"
      :max="100"
      suffix="px"
      @update:model-value="configStore.config.sidebar.width = $event"
    />
    <RangeField v-model="opacity" label="透明度" :min="10" :max="100" :step="5" suffix="%" />
  </SettingsSection>
</template>
