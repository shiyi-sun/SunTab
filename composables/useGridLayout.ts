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

  onMounted(() => {
    const element = viewport.value;
    if (!element) return;
    availableWidth.value = element.clientWidth;
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) availableWidth.value = entry.contentRect.width;
    });
    observer.observe(element);
  });

  onBeforeUnmount(() => {
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
