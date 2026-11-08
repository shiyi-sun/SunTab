<script setup lang="ts">
import { useConfigStore } from '../../../stores/config';
import { createDefaultConfig } from '../../../shared/defaults';
import ColorField from '../ColorField.vue';
import RangeField from '../RangeField.vue';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';
import ToggleSwitch from '../ToggleSwitch.vue';

const configStore = useConfigStore();

function resetIconSettings() {
  configStore.config.icon = createDefaultConfig().icon;
}
</script>

<template>
  <SettingsSection title="图标" description="图标大小、间距、圆角与名称样式；自动图标从浏览器缓存读取。">
    <RangeField
      :model-value="configStore.config.icon.size"
      label="图标大小"
      :min="36"
      :max="120"
      suffix="px"
      @update:model-value="configStore.config.icon.size = $event"
    />
    <RangeField
      :model-value="configStore.config.icon.gap"
      label="间距"
      :min="8"
      :max="64"
      suffix="px"
      @update:model-value="configStore.config.icon.gap = $event"
    />
    <RangeField
      :model-value="configStore.config.icon.radius"
      label="圆角"
      :min="0"
      :max="40"
      suffix="px"
      @update:model-value="configStore.config.icon.radius = $event"
    />
    <RangeField
      :model-value="configStore.config.icon.labelSize"
      label="名称字号"
      :min="9"
      :max="18"
      suffix="px"
      @update:model-value="configStore.config.icon.labelSize = $event"
    />
    <RangeField
      :model-value="configStore.config.icon.maxWidth"
      label="最大宽度"
      :min="600"
      :max="2000"
      :step="10"
      suffix="px"
      @update:model-value="configStore.config.icon.maxWidth = $event"
    />

    <SettingRow label="显示名称" description="关闭后只显示图标">
      <ToggleSwitch v-model="configStore.config.icon.showLabel" />
    </SettingRow>
    <SettingRow label="名称颜色">
      <ColorField
        :model-value="configStore.config.icon.labelColor"
        @update:model-value="configStore.config.icon.labelColor = $event"
      />
    </SettingRow>

    <div class="section-actions">
      <button type="button" class="panel-btn ghost" @click="resetIconSettings">恢复图标默认</button>
    </div>
  </SettingsSection>
</template>

<style scoped>
.section-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}
</style>
