<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconX,
} from '@tabler/icons-vue';
import IconThumb from '../../components/grid/IconThumb.vue';
import { getIconColor, getIconInitial } from '../../shared/color';
import { APP_NAME, APP_VERSION } from '../../shared/defaults';
import { saveIconBlob } from '../../shared/iconBlobs';
import { normalizeHttpUrl } from '../../shared/nav';
import {
  createQuickAddIcon,
  findGroupIconByUrl,
  isQuickAddableUrl,
  quickAddName,
} from '../../shared/quickAdd';
import { fetchSiteSvgIcon } from '../../shared/siteIcon';
import { loadConfig, loadNav, writeNav } from '../../shared/storage';
import type { NavGroup, ThemeMode } from '../../shared/types';

interface ChromeTab {
  url?: string;
  title?: string;
}

interface ChromeTabsApi {
  query(
    info: { active: boolean; currentWindow: boolean },
    callback: (tabs: ChromeTab[]) => void,
  ): void;
}

function chromeTabs(): ChromeTabsApi | undefined {
  return (globalThis as unknown as { chrome?: { tabs?: ChromeTabsApi } }).chrome?.tabs;
}

function readActiveTab(): Promise<ChromeTab | null> {
  return new Promise((resolve) => {
    const tabs = chromeTabs();
    if (!tabs?.query) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (tab: ChromeTab | null) => {
      if (settled) return;
      settled = true;
      resolve(tab);
    };
    try {
      tabs.query({ active: true, currentWindow: true }, (result) => {
        finish(result?.[0] ?? null);
      });
    } catch {
      finish(null);
    }
    window.setTimeout(() => finish(null), 1200);
  });
}

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const loading = ref(true);
const busy = ref(false);
const tab = ref<ChromeTab | null>(null);
const groups = ref<NavGroup[]>([]);
const selectedGroupId = ref('');
const name = ref('');
const error = ref('');
const savedName = ref('');
const savedGroupName = ref('');
const savedIconFallback = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
let closeTimer: number | undefined;

const pageUrl = computed(() => tab.value?.url ?? '');
const normalizedUrl = computed(() => normalizeHttpUrl(pageUrl.value) ?? '');
const blockedReason = computed(() => {
  if (!loading.value && !tab.value) return '无法读取当前标签页，请关闭后重试。';
  if (!isQuickAddableUrl(pageUrl.value)) {
    return '浏览器设置页、新标签页等内部页面不能添加为图标，请切换到普通网页后再试。';
  }
  return '';
});
const hostname = computed(() => {
  try {
    return new URL(pageUrl.value).hostname.replace(/^www\./i, '');
  } catch {
    return pageUrl.value;
  }
});
const selectedGroup = computed(
  () => groups.value.find((group) => group.id === selectedGroupId.value) ?? null,
);
const duplicate = computed(() => {
  if (!selectedGroup.value || !normalizedUrl.value) return null;
  return findGroupIconByUrl(selectedGroup.value, normalizedUrl.value);
});
const canAdd = computed(
  () =>
    !loading.value &&
    !busy.value &&
    !blockedReason.value &&
    Boolean(normalizedUrl.value) &&
    Boolean(name.value.trim()) &&
    !duplicate.value &&
    !savedName.value,
);

onMounted(async () => {
  const [tabInfo, config, nav] = await Promise.all([
    readActiveTab(),
    loadConfig(),
    loadNav(),
  ]);
  applyTheme(config.theme.mode);
  tab.value = tabInfo;
  groups.value = nav;
  selectedGroupId.value = nav[0]?.id ?? '';
  if (isQuickAddableUrl(tabInfo?.url)) {
    name.value = quickAddName(tabInfo?.title, tabInfo!.url!);
  }
  loading.value = false;
  await nextTick();
  nameInput.value?.select();
});

async function addToSunTab() {
  if (!canAdd.value) return;
  busy.value = true;
  error.value = '';
  try {
    const latest = await loadNav();
    const group =
      latest.find((candidate) => candidate.id === selectedGroupId.value) ?? latest[0];
    if (!group) throw new Error('没有可用分组');
    if (findGroupIconByUrl(group, normalizedUrl.value)) {
      error.value = `「${group.name}」里已经有这个网址`;
      return;
    }
    const item = createQuickAddIcon(
      normalizedUrl.value,
      tab.value?.title,
      name.value,
    );
    if (!item) throw new Error('网址无效');
    try {
      const svg = await fetchSiteSvgIcon(normalizedUrl.value, {
        timeoutMs: 3500,
      });
      if (svg) {
        item.icon = {
          kind: 'upload',
          value: await saveIconBlob(svg.blob),
          ...(svg.background ? { bg: svg.background } : {}),
        };
      }
    } catch {
      // Fall through to the text initial below.
    }
    if (item.icon.kind !== 'upload') {
      item.icon = {
        kind: 'text',
        value: getIconInitial(item.name),
        bg: getIconColor(item.name),
      };
    }
    group.items.push(item);
    await writeNav(latest);
    groups.value = latest;
    savedName.value = item.name;
    savedGroupName.value = group.name;
    savedIconFallback.value = item.icon.kind !== 'upload';
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => window.close(), 1000);
  } catch {
    error.value = '保存失败，请重试。';
  } finally {
    busy.value = false;
  }
}

function closeWindow() {
  window.close();
}

onBeforeUnmount(() => {
  if (closeTimer) window.clearTimeout(closeTimer);
});
</script>

<template>
  <main class="popup">
    <header class="popup-header">
      <span class="sun-mark" aria-hidden="true"></span>
      <div class="brand-copy">
        <strong>{{ APP_NAME }}</strong>
        <small>v{{ APP_VERSION }}</small>
      </div>
      <button type="button" class="close-btn" aria-label="关闭" @click="closeWindow">
        <IconX size="16" stroke="2" />
      </button>
    </header>

    <p v-if="loading" class="loading" role="status">正在读取当前页面…</p>

    <section v-else-if="blockedReason" class="blocked">
      <span class="blocked-icon"><IconAlertTriangle size="20" stroke="1.8" /></span>
      <div>
        <h1>当前页面无法添加</h1>
        <p>{{ blockedReason }}</p>
      </div>
    </section>

    <section v-else-if="savedName" class="saved" role="status">
      <span class="saved-icon"><IconCheck size="24" stroke="2.2" /></span>
      <h1>已添加</h1>
      <p>
        「{{ savedName }}」已保存到「{{ savedGroupName }}」。
      </p>
      <p v-if="savedIconFallback" class="saved-fallback">
        没抓到网站图标，已用文字首字代替。
      </p>
      <p class="auto-close">窗口即将自动关闭…</p>
    </section>

    <form v-else class="quick-form" @submit.prevent="addToSunTab">
      <div class="page-card">
        <span class="page-thumb">
          <IconThumb
            :name="name || tab?.title || hostname"
            :icon="{ kind: 'favicon', value: '' }"
            :url="pageUrl"
          />
        </span>
        <div class="page-copy">
          <span>当前页面</span>
          <strong>{{ tab?.title || hostname }}</strong>
          <small>{{ hostname }}</small>
        </div>
      </div>

      <label class="field">
        <span class="field-label">名称</span>
        <input
          ref="nameInput"
          v-model="name"
          class="popup-input"
          type="text"
          maxlength="48"
          placeholder="图标名称"
          data-autofocus
          @input="error = ''"
        />
      </label>

      <label class="field">
        <span class="field-label">添加到</span>
        <select v-model="selectedGroupId" class="popup-input">
          <option v-for="group in groups" :key="group.id" :value="group.id">
            {{ group.name }}
          </option>
        </select>
      </label>

      <p v-if="duplicate" class="hint warn">
        「{{ selectedGroup?.name }}」里已经有这个网址：{{ duplicate.name }}
      </p>
      <p v-if="error" class="hint error" role="alert">{{ error }}</p>

      <button type="submit" class="primary-btn" :disabled="!canAdd">
        <IconPlus v-if="!busy" size="17" stroke="2" />
        {{ busy ? '保存中…' : '添加到 SunTab' }}
      </button>
    </form>

    <footer class="popup-footer">
      本地保存 · 不上传云端
      <span aria-hidden="true">·</span>
      <a href="#" @click.prevent="closeWindow">关闭</a>
    </footer>
  </main>
</template>

<style scoped>
.popup {
  display: flex;
  min-height: 300px;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background:
    radial-gradient(circle at 100% 0%, rgba(76, 141, 255, 0.2), transparent 55%),
    var(--bg-body);
  color: var(--text-primary);
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.brand-copy strong {
  font-size: 14px;
  letter-spacing: 0.04em;
}

.brand-copy small {
  color: var(--text-tertiary);
  font-size: 11px;
}

.close-btn {
  display: grid;
  width: 28px;
  height: 28px;
  margin-left: auto;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  place-items: center;
}

.close-btn:hover {
  background: var(--surface-glass);
  color: var(--text-primary);
}

.sun-mark {
  position: relative;
  display: inline-block;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--surface-glass);
}

.sun-mark::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffd166;
  box-shadow: 0 0 12px rgba(255, 209, 102, 0.9);
  content: '';
  transform: translate(-50%, -50%);
}

.loading {
  margin: auto 0;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: center;
}

.blocked {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: auto 0;
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-card);
  background: var(--panel-input);
}

.blocked-icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: var(--radius-md);
  background: rgba(224, 162, 63, 0.14);
  color: #e0a23f;
  place-items: center;
}

.blocked h1 {
  margin: 4px 0 8px;
  font-size: 15px;
}

.blocked p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.saved {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: auto 0;
  padding: 20px 12px;
  text-align: center;
}

.saved-icon {
  display: grid;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(76, 195, 138, 0.16);
  color: #4cc38a;
  place-items: center;
}

.saved h1 {
  margin: 4px 0 0;
  font-size: 18px;
}

.saved p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.saved .saved-fallback {
  max-width: 240px;
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 11px;
}

.saved .auto-close {
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 10px;
}

.quick-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  background: var(--surface-glass);
}

.page-thumb {
  display: block;
  width: 38px;
  height: 38px;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--surface-glass-strong);
}

.page-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.page-copy span {
  color: var(--text-tertiary);
  font-size: 9px;
  letter-spacing: 0.08em;
}

.page-copy strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-copy small {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: var(--text-tertiary);
  font-size: 11px;
}

.popup-input {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-sm);
  outline: none;
  background: var(--surface-glass);
  color: var(--text-primary);
  font-size: 12px;
}

.popup-input:focus {
  border-color: var(--accent);
}

.popup-input::placeholder {
  color: var(--text-tertiary);
}

.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
}

.hint.warn {
  color: #e0a23f;
}

.hint.error {
  color: #ff8d8d;
}

.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  margin-top: 4px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.primary-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}

.primary-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.primary-btn:focus-visible,
.close-btn:focus-visible,
.popup-footer a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.popup-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: auto;
  color: var(--text-tertiary);
  font-size: 10px;
}

.popup-footer a {
  color: inherit;
  text-decoration: none;
}

.popup-footer a:hover {
  color: var(--text-primary);
}
</style>
