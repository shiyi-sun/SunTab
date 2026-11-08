<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { IconCheck, IconChevronDown, IconSearch, IconX } from '@tabler/icons-vue';
import IconThumb from '../grid/IconThumb.vue';
import { buildSearchUrl, resolveSearch } from '../../composables/useSearch';
import {
  createLocalSearchIndex,
  loadPinyinConverter,
  searchLocalIcons,
  type LocalSearchItem,
  type PinyinConverter,
} from '../../shared/localSearch';
import type { NavGroup, SearchEngine } from '../../shared/types';

const props = defineProps<{
  engines: SearchEngine[];
  engineId: string;
  openInNewTab: boolean;
  groups: NavGroup[];
}>();

const emit = defineEmits<{
  'update:engineId': [id: string];
}>();

const query = ref('');
const engineOpen = ref(false);
const suggestionsVisible = ref(false);
const activeIndex = ref(-1);
const inputRef = ref<HTMLInputElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);

const localIndex = shallowRef<LocalSearchItem[]>([]);
const pinyinConverter = shallowRef<PinyinConverter | null>(null);
let pinyinLoading = false;

function rebuildIndex() {
  localIndex.value = createLocalSearchIndex(
    props.groups,
    pinyinConverter.value ?? undefined,
  );
}

watch(() => props.groups, rebuildIndex, { deep: true, immediate: true });

async function ensurePinyin() {
  if (pinyinConverter.value || pinyinLoading) return;
  pinyinLoading = true;
  try {
    pinyinConverter.value = await loadPinyinConverter();
    rebuildIndex();
  } catch {
    // Name matching still works without the pinyin dictionary.
  } finally {
    pinyinLoading = false;
  }
}

const currentEngine = computed(() => {
  return props.engines.find((engine) => engine.id === props.engineId) ?? props.engines[0] ?? null;
});

const engineInitial = computed(() => {
  return currentEngine.value?.name.trim().slice(0, 1).toUpperCase() ?? '搜';
});

const engineColors: Record<string, string> = {
  baidu: '#2932e1',
  bing: '#0f7bbf',
  google: '#4285f4',
  duckduckgo: '#de5833',
};
const engineColor = computed(() => engineColors[currentEngine.value?.id ?? ''] ?? 'var(--accent)');

const localHits = computed(() => {
  const value = query.value.trim();
  if (!value || !suggestionsVisible.value) return [];
  return searchLocalIcons(localIndex.value, value, 6);
});

const suggestionsOpen = computed(
  () => suggestionsVisible.value && localHits.value.length > 0 && !engineOpen.value,
);

watch(query, () => {
  activeIndex.value = -1;
  if (query.value.trim()) {
    suggestionsVisible.value = true;
    void ensurePinyin();
  } else {
    suggestionsVisible.value = false;
  }
});

watch(
  () => localHits.value.length,
  (length) => {
    if (activeIndex.value >= length) activeIndex.value = length - 1;
  },
);

watch(engineOpen, (open) => {
  if (open) suggestionsVisible.value = false;
});

function selectEngine(engineId: string) {
  emit('update:engineId', engineId);
  engineOpen.value = false;
  inputRef.value?.focus();
}

function closeSuggestions() {
  suggestionsVisible.value = false;
  activeIndex.value = -1;
}

function openHit(hit: LocalSearchItem) {
  if (!/^https?:\/\//i.test(hit.icon.url)) return;
  closeSuggestions();
  query.value = '';
  window.open(hit.icon.url, '_blank', 'noopener,noreferrer');
}

function submit() {
  closeSuggestions();
  const result = resolveSearch(query.value, props.engines, props.engineId);
  if (result.kind === 'none') return;

  const url =
    result.kind === 'url'
      ? result.url
      : result.kind === 'engine'
        ? buildSearchUrl(result.engine, result.query)
        : '';

  if (!url) return;
  query.value = '';

  if (props.openInNewTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.assign(url);
  }
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  );
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  const focusShortcut =
    (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) ||
    ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');
  if (!focusShortcut || isTypingTarget(event.target)) return;
  event.preventDefault();
  inputRef.value?.focus();
  inputRef.value?.select();
}

function onPointerDown(event: PointerEvent) {
  if (!rootRef.value?.contains(event.target as Node)) {
    engineOpen.value = false;
    closeSuggestions();
  }
}

function onEscape() {
  if (engineOpen.value) {
    engineOpen.value = false;
  } else if (suggestionsVisible.value || activeIndex.value >= 0) {
    closeSuggestions();
  } else {
    inputRef.value?.blur();
  }
}

function onInputFocus() {
  engineOpen.value = false;
  if (query.value.trim()) suggestionsVisible.value = true;
  void ensurePinyin();
}

function onInputKeydown(event: KeyboardEvent) {
  const hits = localHits.value;
  if (event.key === 'ArrowDown' && hits.length) {
    event.preventDefault();
    suggestionsVisible.value = true;
    activeIndex.value = activeIndex.value < 0 ? 0 : (activeIndex.value + 1) % hits.length;
    return;
  }
  if (event.key === 'ArrowUp' && hits.length) {
    event.preventDefault();
    activeIndex.value =
      activeIndex.value <= 0 ? hits.length - 1 : activeIndex.value - 1;
    return;
  }
  if (event.key === 'Enter') {
    if (suggestionsOpen.value && activeIndex.value >= 0) {
      const hit = hits[activeIndex.value];
      if (hit) {
        event.preventDefault();
        openHit(hit);
      }
    }
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    onEscape();
  }
}

function hitMeta(hit: LocalSearchItem): string {
  return hit.folderName ? `${hit.groupName} / ${hit.folderName}` : hit.groupName;
}

onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('pointerdown', onPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown);
  document.removeEventListener('pointerdown', onPointerDown);
});
</script>

<template>
  <form ref="rootRef" class="search" role="search" @submit.prevent="submit">
    <div class="engine-wrap">
      <button
        type="button"
        class="engine-btn"
        :title="currentEngine?.name ?? '选择搜索引擎'"
        aria-label="选择搜索引擎"
        aria-haspopup="listbox"
        :aria-expanded="engineOpen"
        @click.stop="engineOpen = !engineOpen"
      >
        <span class="engine-badge" :style="{ background: engineColor }">{{ engineInitial }}</span>
        <IconChevronDown size="14" stroke="2" />
      </button>

      <div v-if="engineOpen" class="engine-menu" role="listbox" aria-label="搜索引擎">
        <button
          v-for="engine in engines"
          :key="engine.id"
          type="button"
          class="engine-item"
          :class="{ active: engine.id === currentEngine?.id }"
          role="option"
          :aria-selected="engine.id === currentEngine?.id"
          @click.stop="selectEngine(engine.id)"
        >
          <span>{{ engine.name }}</span>
          <IconCheck v-if="engine.id === currentEngine?.id" size="16" stroke="2" />
        </button>
      </div>
    </div>

    <input
      ref="inputRef"
      v-model="query"
      class="search-input"
      type="text"
      placeholder="搜索、输入网址或找图标"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      role="combobox"
      aria-label="搜索、输入网址或查找本地图标"
      aria-autocomplete="list"
      aria-controls="suntab-local-results"
      :aria-expanded="suggestionsOpen"
      :aria-activedescendant="
        suggestionsOpen && activeIndex >= 0 ? `suntab-local-${activeIndex}` : undefined
      "
      @focus="onInputFocus"
      @keydown="onInputKeydown"
    />

    <button
      v-if="query"
      type="button"
      class="clear-btn"
      aria-label="清空"
      title="清空"
      @click="query = ''"
    >
      <IconX size="16" stroke="2" />
    </button>

    <button type="submit" class="submit-btn" aria-label="搜索" title="搜索">
      <IconSearch size="20" stroke="2" />
    </button>

    <div
      v-if="suggestionsOpen"
      id="suntab-local-results"
      class="suggest-panel"
      role="listbox"
      aria-label="本地图标"
      @mousedown.prevent
    >
      <div class="suggest-head">
        <span>本地图标</span>
        <span>{{ localHits.length }} 个结果 · ↑↓ 选择</span>
      </div>
      <button
        v-for="(hit, index) in localHits"
        :id="`suntab-local-${index}`"
        :key="hit.icon.id"
        type="button"
        class="suggest-item"
        :class="{ active: index === activeIndex }"
        role="option"
        :aria-selected="index === activeIndex"
        @mouseenter="activeIndex = index"
        @click="openHit(hit)"
      >
        <span class="suggest-thumb">
          <IconThumb :name="hit.icon.name" :icon="hit.icon.icon" :url="hit.icon.url" />
        </span>
        <span class="suggest-copy">
          <strong>{{ hit.icon.name }}</strong>
          <span>{{ hitMeta(hit) }}</span>
        </span>
        <span class="suggest-url">{{ hit.icon.url.replace(/^https?:\/\//i, '') }}</span>
      </button>
    </div>
  </form>
</template>

<style scoped>
.search {
  position: relative;
  z-index: 30;
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 8px;
  border: 1px solid var(--search-border);
  border-radius: var(--radius-pill);
  background: var(--search-bg);
  box-shadow: var(--search-shadow);
  backdrop-filter: blur(14px);
  transition:
    background 180ms var(--ease),
    border-color 180ms var(--ease),
    box-shadow 180ms var(--ease);
}

.search:hover {
  background: var(--search-bg-hover);
}

.search:focus-within {
  border-color: var(--search-border-focus);
  background: var(--search-bg-focus);
}

.engine-wrap {
  position: relative;
  flex: none;
}

.engine-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--search-muted);
  transition: background 160ms var(--ease);
}

.engine-btn:hover {
  background: var(--search-hover);
}

.engine-badge {
  display: grid;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  place-items: center;
}

.engine-menu {
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  z-index: 40;
  width: 184px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-md);
  background: rgba(18, 22, 36, 0.98);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(16px);
}

.engine-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
  text-align: left;
}

.engine-item:hover,
.engine-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.search-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0 8px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--search-text);
  font-size: 15px;
}

.search-input::placeholder {
  color: var(--search-muted);
}

.clear-btn,
.submit-btn {
  display: grid;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--search-muted);
  place-items: center;
  transition:
    background 160ms var(--ease),
    color 160ms var(--ease);
}

.clear-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.submit-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

.clear-btn:hover,
.submit-btn:hover {
  background: var(--search-hover);
  color: var(--search-text);
}

.submit-btn:focus-visible,
.engine-btn:focus-visible,
.clear-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.suggest-panel {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  left: 0;
  z-index: 38;
  max-height: 360px;
  padding: 8px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-md);
  background: rgba(18, 22, 36, 0.98);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(18px);
}

.suggest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  color: rgba(255, 255, 255, 0.44);
  font-size: 10px;
  letter-spacing: 0.04em;
}

.suggest-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgba(255, 255, 255, 0.86);
  text-align: left;
}

.suggest-item:hover,
.suggest-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.suggest-thumb {
  display: block;
  width: 30px;
  height: 30px;
  flex: none;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.08);
}

.suggest-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.suggest-copy strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggest-copy span {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.42);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suggest-url {
  max-width: 42%;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.32);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .suggest-url {
    display: none;
  }
}
</style>
