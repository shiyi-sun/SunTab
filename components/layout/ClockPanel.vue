<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getLunarInfo } from '../../composables/useLunar';
import type { AppConfig } from '../../shared/types';

const props = defineProps<{
  clock: AppConfig['clock'];
  light?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const now = ref(new Date());
let timer: number | undefined;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});

const pad = (value: number) => String(value).padStart(2, '0');
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const timeText = computed(() => {
  const hour = now.value.getHours();
  const minute = pad(now.value.getMinutes());
  const second = pad(now.value.getSeconds());
  const hourText = props.clock.hour12 ? String(hour % 12 || 12) : pad(hour);
  return `${hourText}:${minute}${props.clock.seconds ? `:${second}` : ''}`;
});

const period = computed(() => (now.value.getHours() < 12 ? '上午' : '下午'));

const dateText = computed(() => {
  const date = now.value;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
});

const dayKey = computed(() => now.value.toDateString());
const lunarText = computed(() => {
  if (!props.clock.lunar) return '';
  const info = getLunarInfo(new Date(dayKey.value));
  return [info.lunar, info.solarTerm].filter(Boolean).join(' · ');
});

const clockStyle = computed(() => ({
  '--clock-size': `${props.clock.size}px`,
  '--clock-color': props.light ? 'var(--shell-text)' : props.clock.color,
}));

function toggle() {
  emit('toggle');
}
</script>

<template>
  <div
    v-if="clock.show"
    class="clock"
    :style="clockStyle"
    role="button"
    tabindex="0"
    title="点击切换极简模式"
    aria-label="切换极简模式"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <div class="time-row">
      <span v-if="clock.hour12" class="period">{{ period }}</span>
      <span class="time">{{ timeText }}</span>
    </div>
    <div class="meta">
      <span>{{ dateText }}</span>
      <template v-if="lunarText">
        <span class="divider">·</span>
        <span>{{ lunarText }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--clock-color, #fff);
  cursor: pointer;
  user-select: none;
}

.clock:focus-visible {
  border-radius: var(--radius-md);
  outline: 2px solid var(--shell-focus);
  outline-offset: 8px;
}

.time-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.period {
  font-size: calc(var(--clock-size, 72px) * 0.2);
  font-weight: 500;
  opacity: 0.66;
}

.time {
  font-family: var(--font-ui);
  font-size: var(--clock-size, 72px);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: -0.035em;
  line-height: 1.02;
  text-shadow: var(--clock-shadow, 0 6px 26px rgba(0, 0, 0, 0.3));
}

.meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--shell-text-soft);
  font-size: 14px;
  text-shadow: var(--shell-text-shadow);
}

.divider {
  opacity: 0.45;
}
</style>
