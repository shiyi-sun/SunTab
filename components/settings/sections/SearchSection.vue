<script setup lang="ts">
import { computed, ref } from 'vue';
import { useConfigStore } from '../../../stores/config';
import type { SearchEngine } from '../../../shared/types';
import SettingRow from '../SettingRow.vue';
import SettingsSection from '../SettingsSection.vue';
import ToggleSwitch from '../ToggleSwitch.vue';

const configStore = useConfigStore();

const engines = computed(() => configStore.config.search.engines);
const isSearchVisible = computed({
  get: () => configStore.config.search.show,
  set: (value: boolean) => {
    configStore.config.search.show = value;
  },
});
const openInNewTab = computed({
  get: () => configStore.config.search.openInNewTab,
  set: (value: boolean) => {
    configStore.config.search.openInNewTab = value;
  },
});

const formOpen = ref(false);
const editingId = ref<string | null>(null);
const formName = ref('');
const formUrl = ref('');
const formError = ref('');

function setDefaultEngine(event: Event) {
  configStore.config.search.engineId = (event.target as HTMLSelectElement).value;
}

function startAdd() {
  editingId.value = null;
  formName.value = '';
  formUrl.value = '';
  formError.value = '';
  formOpen.value = true;
}

function startEdit(engine: SearchEngine) {
  editingId.value = engine.id;
  formName.value = engine.name;
  formUrl.value = engine.urlTemplate;
  formError.value = '';
  formOpen.value = true;
}

function cancelForm() {
  formOpen.value = false;
  editingId.value = null;
  formError.value = '';
}

function saveEngine() {
  const name = formName.value.trim();
  const urlTemplate = formUrl.value.trim();
  if (!name) {
    formError.value = '请输入搜索引擎名称';
    return;
  }
  if (!urlTemplate.includes('%s')) {
    formError.value = '搜索地址必须包含 %s';
    return;
  }
  if (!/^https?:\/\//i.test(urlTemplate)) {
    formError.value = '搜索地址必须以 http:// 或 https:// 开头';
    return;
  }

  if (editingId.value) {
    const index = engines.value.findIndex((engine) => engine.id === editingId.value);
    if (index >= 0) {
      engines.value[index] = { ...engines.value[index]!, name, urlTemplate };
    }
  } else {
    const id = `custom-${crypto.randomUUID()}`;
    engines.value.push({ id, name, urlTemplate });
    if (!configStore.config.search.engineId) configStore.config.search.engineId = id;
  }

  cancelForm();
}

function deleteEngine(id: string) {
  if (engines.value.length <= 1) {
    formError.value = '至少保留一个搜索引擎';
    return;
  }
  const index = engines.value.findIndex((engine) => engine.id === id);
  if (index < 0) return;
  engines.value.splice(index, 1);
  if (configStore.config.search.engineId === id) {
    configStore.config.search.engineId = engines.value[0]!.id;
  }
  if (editingId.value === id) cancelForm();
}
</script>

<template>
  <SettingsSection title="搜索" description="搜索栏、默认搜索引擎与打开方式；不请求搜索建议。">
    <SettingRow label="显示搜索栏">
      <ToggleSwitch v-model="isSearchVisible" />
    </SettingRow>
    <SettingRow label="默认搜索引擎">
      <select class="panel-select" :value="configStore.config.search.engineId" @change="setDefaultEngine">
        <option v-for="engine in engines" :key="engine.id" :value="engine.id">
          {{ engine.name }}
        </option>
      </select>
    </SettingRow>
    <SettingRow label="新标签页打开" description="搜索和网址直达是否在新标签页打开">
      <ToggleSwitch v-model="openInNewTab" />
    </SettingRow>

    <div class="engine-header">
      <h4>搜索引擎</h4>
      <button type="button" class="panel-btn" @click="startAdd">添加</button>
    </div>

    <div class="engine-list">
      <div v-for="engine in engines" :key="engine.id" class="engine-row">
        <div class="engine-copy">
          <div class="engine-name">
            {{ engine.name }}
            <span v-if="engine.id === configStore.config.search.engineId" class="engine-badge">默认</span>
          </div>
          <div class="engine-url">{{ engine.urlTemplate }}</div>
        </div>
        <div class="engine-actions">
          <button type="button" class="mini-btn" @click="startEdit(engine)">编辑</button>
          <button type="button" class="mini-btn danger" @click="deleteEngine(engine.id)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="formOpen" class="engine-form">
      <input v-model="formName" class="panel-input" placeholder="名称，例如：知乎" />
      <input
        v-model="formUrl"
        class="panel-input"
        placeholder="https://www.zhihu.com/search?q=%s"
      />
      <p class="form-hint">地址必须包含 %s，搜索词会替换到该位置。</p>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <div class="form-actions">
        <button type="button" class="panel-btn ghost" @click="cancelForm">取消</button>
        <button type="button" class="panel-btn primary" @click="saveEngine">
          {{ editingId ? '保存修改' : '添加' }}
        </button>
      </div>
    </div>
    <p v-else-if="formError" class="form-error">{{ formError }}</p>
  </SettingsSection>
</template>

<style scoped>
.engine-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  padding: 4px 4px 0;
}

.engine-header h4 {
  margin: 0;
  color: var(--panel-text);
  font-size: 13px;
}

.engine-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.engine-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.engine-copy {
  min-width: 0;
}

.engine-name {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--panel-text);
  font-size: 13px;
}

.engine-badge {
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  background: rgb(76 141 255 / 18%);
  color: var(--accent);
  font-size: 10px;
}

.engine-url {
  max-width: 330px;
  margin-top: 4px;
  overflow: hidden;
  color: var(--panel-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engine-actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.mini-btn {
  padding: 4px 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-muted);
  font-size: 11px;
}

.mini-btn:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.mini-btn.danger:hover {
  color: #ff7b7b;
}

.engine-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.form-hint,
.form-error {
  margin: 0;
  color: var(--panel-faint);
  font-size: 11px;
}

.form-error {
  color: #ff7b7b;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
</style>
