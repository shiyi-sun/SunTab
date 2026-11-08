<script setup lang="ts">
import { ref } from 'vue';
import {
  collectBackupIcons,
  createBackup,
  downloadJson,
  parseBackup,
  restoreBackupIcons,
  type BackupStats,
} from '../../../shared/backup';
import { createDefaultConfig } from '../../../shared/defaults';
import type { BackupIconFile, SunTabBackup } from '../../../shared/types';
import { useConfigStore } from '../../../stores/config';
import { useNavStore } from '../../../stores/nav';
import SettingsSection from '../SettingsSection.vue';

const configStore = useConfigStore();
const navStore = useNavStore();

const preview = ref<{ data: SunTabBackup; stats: BackupStats } | null>(null);
const status = ref<{ tone: 'ok' | 'error'; text: string } | null>(null);
const resetConfirm = ref(false);

function stamp(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`;
}

async function exportData() {
  try {
    const icons = await collectBackupIcons(navStore.groups);
    downloadJson(
      `suntab-backup-${stamp()}.json`,
      createBackup(configStore.config, navStore.groups, icons),
    );
    status.value = {
      tone: 'ok',
      text: icons.length ? `已导出备份（含 ${icons.length} 个上传图标）` : '已导出备份文件',
    };
  } catch {
    status.value = { tone: 'error', text: '导出失败，请重试' };
  }
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  const text = await file.text();
  const result = parseBackup(text);
  if (!result.ok) {
    preview.value = null;
    status.value = { tone: 'error', text: result.error };
    return;
  }
  preview.value = { data: result.data, stats: result.stats };
  status.value = null;
}

async function confirmImport() {
  if (!preview.value) return;
  const data = preview.value.data;
  let currentIcons: BackupIconFile[] = [];
  try {
    currentIcons = await collectBackupIcons(navStore.groups);
  } catch {
    currentIcons = [];
  }
  downloadJson(
    `suntab-before-import-${stamp()}.json`,
    createBackup(configStore.config, navStore.groups, currentIcons),
  );
  const restored = await restoreBackupIcons(data.icons ?? []);
  configStore.replaceConfig(data.config);
  navStore.replaceGroups(data.nav);
  preview.value = null;
  status.value = {
    tone: 'ok',
    text: data.icons?.length ? `导入成功，已恢复 ${restored} 个上传图标` : '导入成功',
  };
}

function cancelImport() {
  preview.value = null;
  status.value = null;
}

function resetSettings() {
  configStore.replaceConfig(createDefaultConfig());
  resetConfirm.value = false;
  status.value = { tone: 'ok', text: '已恢复默认设置（图标与分组保留）' };
}
</script>

<template>
  <SettingsSection title="数据" description="设置、导航和上传图标可导出；壁纸图片不包含在 JSON 中。">
    <div class="data-grid">
      <div class="data-card">
        <h4>导出备份</h4>
        <p>下载包含设置、分组和上传图标的 JSON 文件。</p>
        <button type="button" class="panel-btn primary" @click="exportData">导出 JSON</button>
      </div>

      <div class="data-card">
        <h4>导入备份</h4>
        <p>导入前会自动下载当前数据作为备份。</p>
        <label class="panel-btn">
          选择文件
          <input type="file" accept="application/json,.json" @change="onImportFile" />
        </label>
      </div>
    </div>

    <div v-if="preview" class="import-preview">
      <h4>准备导入</h4>
      <p>
        {{ preview.stats.groups }} 个分组 · {{ preview.stats.icons }} 个图标 ·
        {{ preview.stats.folders }} 个文件夹
      </p>
      <p v-if="preview.data.icons?.length" class="muted">
        含 {{ preview.data.icons.length }} 个上传图标，导入后写回浏览器数据库。
      </p>
      <p class="muted">
        壁纸原图不包含在 JSON 中；旧备份不含上传图标时，缺失的图标会回退为地球图标。
      </p>
      <div class="import-actions">
        <button type="button" class="panel-btn ghost" @click="cancelImport">取消</button>
        <button type="button" class="panel-btn primary" @click="confirmImport">确认导入</button>
      </div>
    </div>

    <div class="data-card reset-card">
      <h4>恢复默认设置</h4>
      <p>重置外观、搜索、图标、时钟、布局和侧边栏；保留图标与分组。</p>
      <div v-if="resetConfirm" class="import-actions">
        <button type="button" class="panel-btn ghost" @click="resetConfirm = false">取消</button>
        <button type="button" class="panel-btn danger" @click="resetSettings">确认恢复</button>
      </div>
      <button v-else type="button" class="panel-btn danger" @click="resetConfirm = true">
        恢复默认设置
      </button>
    </div>

    <p v-if="status" class="status" :class="status.tone">{{ status.text }}</p>
  </SettingsSection>
</template>

<style scoped>
.data-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.data-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.data-card h4,
.import-preview h4 {
  margin: 0;
  color: var(--panel-text);
  font-size: 13px;
}

.data-card p,
.import-preview p {
  margin: 0;
  color: var(--panel-muted);
  font-size: 11px;
  line-height: 1.6;
}

.data-card .panel-btn {
  margin-top: 4px;
}

.data-card input[type='file'] {
  display: none;
}

.import-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  background: rgb(76 141 255 / 8%);
}

.muted {
  color: var(--panel-faint) !important;
}

.import-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

.reset-card {
  margin-top: 4px;
}

.status {
  margin: 4px 0 0;
  font-size: 11px;
}

.status.ok {
  color: #4cc38a;
}

.status.error {
  color: #ff7b7b;
}
</style>
