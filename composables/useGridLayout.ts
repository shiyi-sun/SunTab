import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export interface GridOptions {
  size: number;
  gap: number;
  maxWidth: number;
  minColumns?: number;
  maxColumns?: number;
  cellCount?: number;
}

export function useGridLayout(
  viewport: Ref<HTMLElement | null>,
  getOptions: () => GridOptions,
) {
  const availableWidth = ref(0);
  let observer: ResizeObserver | undefined;
  let frame = 0;

  onMounted(() => {
    const element = viewport.value;
    if (!element) return;
    availableWidth.value = element.clientWidth;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      if (Math.abs(width - availableWidth.value) < 0.5) return;
      // Applying the new width inside the observer can emit another resize in
      // the same loop, which Chrome reports as an undelivered notification.
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        availableWidth.value = width;
      });
    });
    observer.observe(element);
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
  });

  const columns = computed(() => {
    const options = getOptions();
    const minColumns = options.minColumns ?? 2;
    const maxColumns = options.maxColumns ?? 20;
    const usable = Math.min(
      availableWidth.value || options.maxWidth,
      options.maxWidth,
    );
    const fitted = Math.floor((usable + options.gap) / (options.size + options.gap));
    // A short group shrinks to its own cells so the block centers under the search.
    const cellLimit =
      typeof options.cellCount === 'number' && options.cellCount > 0
        ? options.cellCount
        : Infinity;
    const next = Math.max(
      Math.min(minColumns, cellLimit),
      Math.min(fitted, cellLimit),
    );
    return Math.max(1, Math.min(maxColumns, next));
  });

  const gridWidth = computed(() => {
    const options = getOptions();
    return columns.value * options.size + (columns.value - 1) * options.gap;
  });

  return {
    availableWidth,
    columns,
    gridWidth,
  };
}
