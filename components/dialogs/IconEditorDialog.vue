<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { IconUpload } from '@tabler/icons-vue';
import DialogShell from '../ui/DialogShell.vue';
import IconThumb from '../grid/IconThumb.vue';
import {
  DEFAULT_ICON_BG,
  getIconColor,
  ICON_BACKGROUND_PALETTE,
  TEXT_ICON_PALETTE,
  TRANSPARENT_ICON_BG,
} from '../../shared/color';
import { deleteIconBlob, saveIconBlob } from '../../shared/iconBlobs';
import { processIconImage } from '../../shared/image';
import { clampName, findIconByUrl, normalizeHttpUrl, normalizeIconUrl } from '../../shared/nav';
import type { IconDraft, IconItem, IconKind, IconSpec } from '../../shared/types';

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit';
    item?: IconItem | null;
    siblings?: IconItem[];
    locationLabel?: string;
  }>(),
  { item: null, siblings: () => [], locationLabel: '' },
);

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ submit: [draft: IconDraft] }>();

const sources: Array<{ id: IconKind; label: string }> = [
  { id: 'favicon', label: '自动' },
  { id: 'text', label: '文字' },
  { id: 'upload', label: '上传' },
  { id: 'url', label: '地址' },
];

const name = ref('');
const url = ref('');
const kind = ref<IconKind>('favicon');
const iconValue = ref('');
const textValue = ref('');
const bg = ref(TEXT_ICON_PALETTE[0]!);
const error = ref('');
const busy = ref(false);

const nameInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const pendingBlob = ref<Blob | null>(null);
const pendingPreview = ref('');

const title = computed(() => (props.mode === 'edit' ? '编辑图标' : '添加图标'));
const previewName = computed(() => clampName(name.value) || '新图标');
const previewSpec = computed<IconSpec>(() => {
  if (kind.value === 'upload') {
    if (pendingPreview.value) {
      return { kind: 'url', value: pendingPreview.value, bg: bg.value };
    }
    return {
      kind: 'upload',
      value: props.item?.icon.kind === 'upload' ? props.item.icon.value : '',
      bg: bg.value,
    };
  }
  if (kind.value === 'text') {
    return { kind: 'text', value: Array.from(textValue.value.trim()).slice(0, 2).join(''), bg: bg.value };
  }
  if (kind.value === 'url') {
    return { kind: 'url', value: iconValue.value.trim(), bg: bg.value };
  }
  return { kind: 'favicon', value: '', bg: bg.value };
});
const duplicate = computed(() => {
  const normalized = normalizeHttpUrl(url.value);
  if (!normalized) return null;
  return findIconByUrl(props.siblings, normalized, props.item?.id);
});
const hasUpload = computed(
  () =>
    Boolean(pendingPreview.value) ||
    props.item?.icon.kind === 'upload',
);

function releasePending() {
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
  pendingPreview.value = '';
  pendingBlob.value = null;
}

function reset() {
  const item = props.item;
  name.value = item?.name ?? '';
  url.value = item?.url ?? '';
  kind.value = item?.icon.kind ?? 'favicon';
  iconValue.value = item?.icon.kind === 'url' ? item.icon.value : '';
  textValue.value = item?.icon.kind === 'text' ? item.icon.value : '';
  if (item) {
    bg.value =
      item.icon.bg ||
      (item.icon.kind === 'text' ? getIconColor(item.name) : DEFAULT_ICON_BG);
  } else {
    bg.value = DEFAULT_ICON_BG;
  }
  error.value = '';
  busy.value = false;
  releasePending();
  void nextTick(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
  });
}

watch(open, (value) => {
  if (value) reset();
  else releasePending();
});

function setKind(next: IconKind) {
  kind.value = next;
  error.value = '';
  if (next === 'text') {
    if (!textValue.value) {
      textValue.value = Array.from(name.value.trim()).slice(0, 2).join('');
    }
    if (
      !bg.value ||
      bg.value === DEFAULT_ICON_BG ||
      bg.value === TRANSPARENT_ICON_BG
    ) {
      bg.value = getIconColor(name.value || '新图标');
    }
  }
}

function chooseFile() {
  fileInput.value?.click();
}

async function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  await handleFile(file);
}

async function handleFile(file: File | null | undefined) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    error.value = '图标图片不能超过 5MB';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const blob = await processIconImage(file);
    releasePending();
    pendingBlob.value = blob;
    pendingPreview.value = URL.createObjectURL(blob);
    kind.value = 'upload';
  } catch {
    error.value = '图标处理失败，请换一张图片';
  } finally {
    busy.value = false;
  }
}

function onDrop(event: DragEvent) {
  void handleFile(event.dataTransfer?.files[0]);
}

async function submit() {
  if (busy.value) return;
  error.value = '';
  const cleanName = clampName(name.value);
  if (!cleanName) {
    error.value = '请输入名称';
    nameInput.value?.focus();
    return;
  }
  const normalizedUrl = normalizeHttpUrl(url.value);
  if (!normalizedUrl) {
    error.value = '请输入有效的网址（http/https）';
    return;
  }

  let icon: IconSpec;
  let uploadId = '';
  if (kind.value === 'upload') {
    if (pendingBlob.value) {
      busy.value = true;
      try {
        uploadId = await saveIconBlob(pendingBlob.value);
      } catch {
        error.value = '图标保存失败，请重试';
        busy.value = false;
        return;
      }
    } else {
      uploadId = props.item?.icon.kind === 'upload' ? props.item.icon.value : '';
    }
    if (!uploadId) {
      error.value = '请选择一张图片';
      busy.value = false;
      return;
    }
    icon = { kind: 'upload', value: uploadId, bg: bg.value };
  } else if (kind.value === 'text') {
    icon = {
      kind: 'text',
      value: Array.from(textValue.value.trim()).slice(0, 2).join(''),
      bg: bg.value,
    };
  } else if (kind.value === 'url') {
    const normalizedIcon = normalizeIconUrl(iconValue.value);
    if (!normalizedIcon) {
      error.value = '请输入有效的图片地址';
      busy.value = false;
      return;
    }
    icon = { kind: 'url', value: normalizedIcon, bg: bg.value };
  } else {
    icon = { kind: 'favicon', value: '', bg: bg.value };
  }

  const previousUpload =
    props.item?.icon.kind === 'upload' &&
    (icon.kind !== 'upload' || icon.value !== props.item.icon.value)
      ? props.item.icon.value
      : '';

  emit('submit', { name: cleanName, url: normalizedUrl, icon });
  if (previousUpload) void deleteIconBlob(previousUpload);
  busy.value = false;
  open.value = false;
}
</script>

<template>
  <DialogShell
    v-model:open="open"
    :title="title"
    :subtitle="locationLabel ? `保存到 ${locationLabel}` : undefined"
    :width="500"
  >
    <div class="editor">
      <div class="preview-row">
        <span class="preview-box">
          <IconThumb
            :name="previewName"
            :icon="previewSpec"
            :url="normalizeHttpUrl(url) ?? ''"
          />
        </span>
        <div class="preview-meta">
          <strong>{{ previewName }}</strong>
          <span>{{ normalizeHttpUrl(url) || '填写网址后使用网站图标' }}</span>
        </div>
      </div>

      <label class="field">
        <span class="field-label">名称</span>
        <input
          ref="nameInput"
          v-model="name"
          class="panel-input"
          type="text"
          maxlength="48"
          placeholder="例如：GitHub"
          data-autofocus
          @input="error = ''"
        />
      </label>

      <label class="field">
        <span class="field-label">网址</span>
        <input
          v-model="url"
          class="panel-input"
          type="text"
          maxlength="2048"
          placeholder="https://example.com"
          spellcheck="false"
          @input="error = ''"
        />
      </label>
      <p v-if="duplicate" class="hint warn">
        当前列表中已有相同网址：{{ duplicate.name }}
      </p>

      <div class="field">
        <span class="field-label">图标来源</span>
        <div class="source-tabs" role="tablist" aria-label="图标来源">
          <button
            v-for="source in sources"
            :key="source.id"
            type="button"
            class="source-tab"
            :class="{ active: kind === source.id }"
            role="tab"
            :aria-selected="kind === source.id"
            @click="setKind(source.id)"
          >
            {{ source.label }}
          </button>
        </div>
      </div>

      <div class="source-body">
        <p v-if="kind === 'favicon'" class="hint">
          从 Chromium 本地图标缓存读取，卡片内居中显示；没有可用图标时显示地球图标。
        </p>

        <template v-else-if="kind === 'text'">
          <div class="inline-fields">
            <label class="field compact">
              <span class="field-label">图标文字</span>
              <input
                v-model="textValue"
                class="panel-input"
                maxlength="2"
                placeholder="自动"
              />
            </label>
            <label class="field compact">
              <span class="field-label">背景色</span>
              <span class="color-row">
                <input v-model="bg" class="color-input" type="color" aria-label="图标背景色" />
                <span class="color-presets">
                  <button
                    v-for="color in TEXT_ICON_PALETTE"
                    :key="color"
                    type="button"
                    class="color-dot"
                    :class="{ active: bg === color }"
                    :style="{ background: color }"
                    :title="color"
                    :aria-label="`使用颜色 ${color}`"
                    @click="bg = color"
                  ></button>
                </span>
              </span>
            </label>
          </div>
        </template>

        <template v-else-if="kind === 'upload'">
          <div class="upload-row">
            <button type="button" class="upload-box" :disabled="busy" @click="chooseFile" @dragover.prevent @drop.prevent="onDrop">
              <span v-if="pendingPreview" class="upload-thumb">
                <img :src="pendingPreview" alt="上传预览" />
              </span>
              <span v-else-if="hasUpload" class="upload-thumb">
                <IconThumb
                  :name="previewName"
                  :icon="previewSpec"
                  :url="normalizeHttpUrl(url) ?? ''"
                />
              </span>
              <IconUpload v-else size="24" stroke="1.6" />
              <strong>{{ busy ? '处理中…' : pendingPreview || hasUpload ? '更换图片' : '选择图片' }}</strong>
              <span>PNG / JPG / WebP，最大 5MB，自动处理为 128px</span>
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="file-input"
              @change="onFileInput"
            />
          </div>
        </template>

        <template v-else>
          <label class="field">
            <span class="field-label">图片地址</span>
            <input
              v-model="iconValue"
              class="panel-input"
              type="text"
              maxlength="2048"
              placeholder="https://example.com/icon.png"
              spellcheck="false"
              @input="error = ''"
            />
          </label>
          <p class="hint">支持 http/https 图片直链，或扩展内的 /icons/... 路径。</p>
        </template>
      </div>

      <div v-if="kind !== 'text'" class="field">
        <span class="field-label">图标底色</span>
        <div class="color-row">
          <span class="color-presets">
            <button
              v-for="color in ICON_BACKGROUND_PALETTE"
              :key="color"
              type="button"
              class="color-dot"
              :class="{ active: bg === color }"
              :style="{ background: color }"
              :title="color"
              :aria-label="`使用底色 ${color}`"
              @click="bg = color"
            ></button>
            <button
              type="button"
              class="color-dot color-dot-clear"
              :class="{ active: bg === TRANSPARENT_ICON_BG }"
              title="透明"
              aria-label="使用透明底色"
              @click="bg = TRANSPARENT_ICON_BG"
            ></button>
          </span>
          <input v-model="bg" class="color-input" type="color" aria-label="自定义图标底色" />
        </div>
        <p class="hint">透明背景的图标会铺上这层底色，深色壁纸下也能看清。</p>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>

    <template #footer>
      <button type="button" class="panel-btn" @click="open = false">取消</button>
      <button type="button" class="panel-btn primary" :disabled="busy" @click="submit">
        {{ mode === 'edit' ? '保存' : '添加' }}
      </button>
    </template>
  </DialogShell>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.preview-box {
  display: block;
  width: 64px;
  height: 64px;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--icon-border);
  border-radius: var(--radius-lg);
  background: var(--icon-glass);
  box-shadow: var(--icon-shadow);
}

.preview-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.preview-meta strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meta span {
  overflow: hidden;
  color: var(--panel-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field.compact {
  flex: 1;
  min-width: 0;
}

.field-label {
  color: var(--panel-muted);
  font-size: 12px;
  font-weight: 500;
}

.hint {
  margin: 0;
  color: var(--panel-faint);
  font-size: 11px;
  line-height: 1.6;
}

.hint.warn {
  margin-top: -8px;
  color: #e0a23f;
}

.source-tabs {
  display: flex;
  gap: 8px;
}

.source-tab {
  padding: 8px 12px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--panel-muted);
  font-size: 12px;
}

.source-tab:hover {
  background: var(--panel-hover);
  color: var(--panel-text);
}

.source-tab.active {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.source-body {
  padding: 12px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-input);
}

.inline-fields {
  display: flex;
  gap: 12px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 34px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: transparent;
}

.color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.color-dot {
  width: 17px;
  height: 17px;
  border: 2px solid transparent;
  border-radius: 50%;
}

.color-dot.active {
  border-color: var(--panel-text);
}

.color-dot.color-dot-clear {
  border-color: var(--panel-border);
  background: conic-gradient(#d7dbe2 25%, #fff 0 50%, #d7dbe2 0 75%, #fff 0) 50% / 8px 8px;
}

.color-dot.color-dot-clear.active {
  border-color: var(--panel-text);
}

.upload-row {
  display: flex;
}

.upload-box {
  display: flex;
  width: 100%;
  min-height: 124px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 1px dashed var(--panel-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--panel-muted);
  text-align: center;
}

.upload-box:hover {
  border-color: var(--panel-faint);
  background: var(--panel-hover);
}

.upload-box strong {
  color: var(--panel-text);
  font-size: 13px;
}

.upload-box span {
  font-size: 11px;
}

.upload-thumb {
  display: block;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--panel-hover);
}

.upload-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.file-input {
  display: none;
}

.error {
  margin: 0;
  color: #ff8d8d;
  font-size: 12px;
}
</style>
