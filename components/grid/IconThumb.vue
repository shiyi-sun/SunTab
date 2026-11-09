<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  DEFAULT_ICON_BG,
  getIconColor,
  getIconInitial,
  TRANSPARENT_ICON_BG,
} from '../../shared/color';
import { getIconBlobUrl } from '../../shared/iconBlobs';
import { splitIconText } from '../../shared/nav';
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
const COVER_EDGE_RATIO = 0.5;
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
    // Full-bleed means opaque on every side. Checking the aggregate lets a
    // portrait or landscape image pass just by touching two edges, which
    // removes the 80% padding and clips its ends against the rounded card.
    const opaque = [0, 0, 0, 0];
    const check = (side: number, x: number, y: number) => {
      if (pixels[(y * EDGE_SAMPLE_SIZE + x) * 4 + 3]! > 127) opaque[side]! += 1;
    };
    for (let index = 0; index < EDGE_SAMPLE_SIZE; index += 1) {
      check(0, index, 0);
      check(1, EDGE_SAMPLE_SIZE - 1, index);
      check(2, index, EDGE_SAMPLE_SIZE - 1);
      check(3, 0, index);
    }
    const result = opaque.every(
      (count) => count / EDGE_SAMPLE_SIZE >= COVER_EDGE_RATIO,
    );
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
const textLines = computed(() => {
  const custom = props.icon.kind === 'text' ? props.icon.value : '';
  const lines = splitIconText(custom);
  return lines.length ? lines : splitIconText(getIconInitial(props.name));
});
const textStyle = computed(() => {
  const longest = Math.max(
    ...textLines.value.map((line) => Array.from(line).length),
  );
  const fontSize =
    textLines.value.length > 1
      ? longest > 2
        ? '26cqw'
        : '34cqw'
      : longest > 2
        ? '28cqw'
        : longest > 1
          ? '40cqw'
          : '52cqw';
  const bg = props.icon.bg;
  return {
    background:
      bg && bg !== DEFAULT_ICON_BG && bg !== TRANSPARENT_ICON_BG
        ? bg
        : getIconColor(props.name),
    fontSize,
  };
});
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
    <span v-else-if="!loadingUpload" class="thumb-text" :style="textStyle">
      <span
        v-for="(line, index) in textLines"
        :key="index"
        class="thumb-text-line"
      >{{ line }}</span>
    </span>
  </span>
</template>

<style scoped>
.thumb {
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-rows: 100%;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.1;
  text-align: center;
}

.thumb-text-line {
  display: block;
  white-space: nowrap;
}
</style>
