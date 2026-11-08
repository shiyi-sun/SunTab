<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IconWorld } from '@tabler/icons-vue';
import {
  DEFAULT_ICON_BG,
  getIconColor,
  getIconInitial,
  TRANSPARENT_ICON_BG,
} from '../../shared/color';
import { getIconBlobUrl } from '../../shared/iconBlobs';
import type { IconSpec } from '../../shared/types';

const props = withDefaults(
  defineProps<{
    name: string;
    icon: IconSpec;
    url?: string;
  }>(),
  { url: '' },
);

const emit = defineEmits<{
  cover: [value: boolean];
}>();

const failed = ref(false);
const blobUrl = ref('');
const loadingUpload = ref(false);
let requestToken = 0;

const EDGE_SAMPLE_SIZE = 48;
const COVER_EDGE_RATIO = 0.15;
const coverCache = new Map<string, boolean>();

const cover = ref(false);

function detectCover(image: HTMLImageElement, key: string): boolean {
  if (!key) return false;
  const cached = coverCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = EDGE_SAMPLE_SIZE;
    canvas.height = EDGE_SAMPLE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.clearRect(0, 0, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE);
    context.drawImage(image, 0, 0, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE);
    const pixels = context.getImageData(
      0,
      0,
      EDGE_SAMPLE_SIZE,
      EDGE_SAMPLE_SIZE,
    ).data;
    let opaque = 0;
    let total = 0;
    const check = (x: number, y: number) => {
      total += 1;
      if (pixels[(y * EDGE_SAMPLE_SIZE + x) * 4 + 3]! > 127) opaque += 1;
    };
    for (let index = 0; index < EDGE_SAMPLE_SIZE; index += 1) {
      check(index, 0);
      check(index, EDGE_SAMPLE_SIZE - 1);
      check(0, index);
      check(EDGE_SAMPLE_SIZE - 1, index);
    }
    const result = opaque / total >= COVER_EDGE_RATIO;
    coverCache.set(key, result);
    return result;
  } catch {
    // Cross-origin images can taint the canvas; keep the padded look.
    return false;
  }
}

const FAVICON_SIZE = 256;

const faviconUrl = computed(() => {
  if (props.icon.kind !== 'favicon' || !props.url) return '';
  try {
    const runtime = (
      globalThis as unknown as {
        chrome?: { runtime?: { getURL?: (path: string) => string } };
      }
    ).chrome?.runtime;
    const base = runtime?.getURL?.('/_favicon/');
    if (!base) return '';
    return `${base}?pageUrl=${encodeURIComponent(props.url)}&size=${FAVICON_SIZE}`;
  } catch {
    return '';
  }
});

const src = computed(() => {
  if (props.icon.kind === 'upload') return blobUrl.value;
  if (props.icon.kind === 'url') return props.icon.value;
  if (props.icon.kind === 'favicon') return faviconUrl.value;
  return '';
});

function onImageLoad(event: Event) {
  cover.value = detectCover(event.target as HTMLImageElement, src.value);
  emit('cover', cover.value);
}

const showImage = computed(() => Boolean(src.value) && !failed.value);
const text = computed(() => {
  const custom = props.icon.kind === 'text' ? props.icon.value.trim() : '';
  return Array.from(custom).slice(0, 2).join('') || getIconInitial(props.name);
});
const textStyle = computed(() => ({
  background: props.icon.bg || getIconColor(props.name),
}));
const imageStyle = computed(() => {
  if (props.icon.kind === 'text') return undefined;
  if (cover.value) return { backgroundColor: 'transparent' };
  const background =
    props.icon.bg === TRANSPARENT_ICON_BG
      ? 'transparent'
      : props.icon.bg || DEFAULT_ICON_BG;
  return { backgroundColor: background };
});

watch(
  () => [props.icon.kind, props.icon.value, props.url],
  async () => {
    failed.value = false;
    blobUrl.value = '';
    loadingUpload.value = false;
    cover.value = false;
    emit('cover', false);
    if (props.icon.kind !== 'upload' || !props.icon.value) return;
    const token = ++requestToken;
    loadingUpload.value = true;
    const loaded = await getIconBlobUrl(props.icon.value);
    if (token === requestToken) {
      blobUrl.value = loaded ?? '';
      loadingUpload.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <span class="thumb" :style="imageStyle" :class="{ 'is-cover': cover }">
    <img
      v-if="showImage"
      class="thumb-img"
      :src="src"
      :alt="name"
      draggable="false"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      @load="onImageLoad"
      @error="failed = true"
    />
    <span v-else-if="icon.kind === 'text'" class="thumb-text" :style="textStyle">
      {{ text }}
    </span>
    <span v-else-if="!loadingUpload" class="thumb-globe" aria-hidden="true">
      <IconWorld size="20" stroke="1.6" />
    </span>
  </span>
</template>

<style scoped>
.thumb {
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  place-items: center;
  container-type: size;
}

.thumb-img {
  display: block;
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.thumb.is-cover .thumb-img {
  width: 100%;
  height: 100%;
}

.thumb-text {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: clamp(8px, 38cqw, 22px);
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1;
  text-align: center;
}

.thumb-globe {
  display: grid;
  width: 70cqw;
  height: 70cqw;
  max-width: 20px;
  max-height: 20px;
  color: currentColor;
  opacity: 0.62;
  place-items: center;
}

.thumb-globe :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
