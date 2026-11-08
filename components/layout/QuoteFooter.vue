<script setup lang="ts">
import { computed, ref } from 'vue';
import { QUOTES, getDailyQuoteIndex } from '../../shared/quotes';

const index = ref(getDailyQuoteIndex());
const quote = computed(() => QUOTES[index.value % QUOTES.length]!);

function next() {
  index.value = (index.value + 1) % QUOTES.length;
}
</script>

<template>
  <button
    v-if="quote"
    type="button"
    class="quote"
    title="点击换一句"
    aria-label="换一句引用"
    @click="next"
  >
    <span class="text">「{{ quote.text }}」</span>
    <span class="author">— {{ quote.author }}</span>
  </button>
</template>

<style scoped>
.quote {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  max-width: min(900px, calc(100% - 32px));
  padding: 8px 16px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--shell-text-soft);
  cursor: pointer;
  font-size: 14px;
  line-height: 1.6;
  text-shadow: var(--shell-text-shadow);
  transition: background 180ms var(--ease);
}

.quote:hover {
  background: var(--shell-hover);
}

.quote:focus-visible {
  outline: 2px solid var(--shell-focus);
  outline-offset: 2px;
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author {
  flex: none;
  color: var(--shell-text-faint);
  font-size: 12px;
}

@media (max-width: 720px) {
  .quote {
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .text {
    white-space: normal;
  }
}
</style>
