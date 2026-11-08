<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DEFAULT_ICON_BG,
  getIconColor,
  TRANSPARENT_ICON_BG,
} from '../../shared/color';
import type { IconItem } from '../../shared/types';
import IconThumb from './IconThumb.vue';

const props = defineProps<{
  item: IconItem;
}>();

const emit = defineEmits<{
  menu: [event: MouseEvent];
}>();

const covered = ref(false);

const cardBackground = computed(() => {
  const icon = props.item.icon;
  if (icon.kind === 'text') return icon.bg || getIconColor(props.item.name);
  if (covered.value) return 'transparent';
  if (icon.bg === TRANSPARENT_ICON_BG) return 'var(--icon-glass)';
  return icon.bg || DEFAULT_ICON_BG;
});

function open() {
  if (!/^https?:\/\//i.test(props.item.url)) return;
  window.open(props.item.url, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <button
    type="button"
    class="icon-tile"
    :title="item.name"
    :aria-label="item.name"
    @click="open"
    @contextmenu.prevent.stop="emit('menu', $event)"
  >
    <span class="icon-image" :style="{ background: cardBackground }">
      <IconThumb
        :name="item.name"
        :icon="item.icon"
        :url="item.url"
        @cover="covered = $event"
      />
    </span>
    <span class="icon-label">{{ item.name }}</span>
  </button>
</template>

<style scoped>
.icon-tile {
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--icon-label-color, #fff);
  user-select: none;
}

.icon-tile:focus-visible {
  border-radius: var(--icon-radius);
  outline: 2px solid var(--shell-focus);
  outline-offset: 4px;
}

.icon-image {
  display: block;
  width: var(--icon-size);
  height: var(--icon-size);
  flex: none;
  overflow: hidden;
  border-radius: var(--icon-radius);
  background: var(--icon-glass);
  box-shadow:
    var(--icon-edge, 0 0 0 0 transparent),
    var(--icon-shadow);
  transition: box-shadow 180ms var(--ease);
}

.icon-tile:hover .icon-image {
  box-shadow:
    var(--icon-edge-hover, 0 0 0 0 transparent),
    var(--icon-shadow-hover);
}

.icon-label {
  display: var(--icon-label-display, block);
  max-width: calc(var(--icon-size) + 20px);
  margin-top: 8px;
  overflow: hidden;
  font-size: var(--icon-label-size, 12px);
  line-height: 1.2;
  text-overflow: ellipsis;
  text-shadow: var(--icon-label-shadow);
  white-space: nowrap;
}
</style>
