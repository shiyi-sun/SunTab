<script setup lang="ts">
import { computed } from 'vue';
import { useConfigStore } from '../../../stores/config';
import ColorField from '../ColorField.vue';
import RangeField from '../RangeField.vue';
import SegmentedControl from '../SegmentedControl.vue';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';
import ToggleSwitch from '../ToggleSwitch.vue';

const configStore = useConfigStore();

const hourFormat = computed({
  get: () => (configStore.config.clock.hour12 ? '12' : '24'),
  set: (value: string) => {
    configStore.config.clock.hour12 = value === '12';
  },
});

const hourOptions = [
  { value: '24', label: '24 小时' },
  { value: '12', label: '12 小时' },
];
</script>

<template>
  <SettingsSection title="时钟" description="大时钟、日期与农历的显示方式。">
    <SettingRow label="显示时钟">
      <ToggleSwitch v-model="configStore.config.clock.show" />
    </SettingRow>
    <SettingRow label="时间格式">
      <SegmentedControl v-model="hourFormat" :options="hourOptions" />
    </SettingRow>
    <SettingRow label="显示秒" description="在时间后追加秒数">
      <ToggleSwitch v-model="configStore.config.clock.seconds" />
    </SettingRow>
    <SettingRow label="显示农历" description="日期行追加农历与当天节气">
      <ToggleSwitch v-model="configStore.config.clock.lunar" />
    </SettingRow>

    <RangeField
      :model-value="configStore.config.clock.size"
      label="字号"
      :min="40"
      :max="140"
      suffix="px"
      @update:model-value="configStore.config.clock.size = $event"
    />
    <SettingRow label="颜色">
      <ColorField
        :model-value="configStore.config.clock.color"
        @update:model-value="configStore.config.clock.color = $event"
      />
    </SettingRow>
  </SettingsSection>
</template>
