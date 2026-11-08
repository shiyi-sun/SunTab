import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { createDefaultConfig, STORAGE_KEYS } from '../shared/defaults';
import {
  loadConfig,
  mergeConfig,
  onStorageChanged,
  saveConfig,
} from '../shared/storage';
import type { AppConfig } from '../shared/types';

let listening = false;

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig>(createDefaultConfig());
  const ready = ref(false);

  const isMinimal = computed(() => config.value.layout.mode === 'minimal');

  async function init() {
    if (ready.value) return;
    config.value = await loadConfig();
    ready.value = true;

    if (!listening) {
      listening = true;
      onStorageChanged((changes, areaName) => {
        if (areaName !== 'local' || !changes[STORAGE_KEYS.config]) return;
        let value = changes[STORAGE_KEYS.config]?.newValue;
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch {
            return;
          }
        }
        const next = mergeConfig(value);
        if (JSON.stringify(next) === JSON.stringify(config.value)) return;
        config.value = next;
      });
    }
  }

  function toggleMinimal() {
    config.value.layout.mode = isMinimal.value ? 'widgets' : 'minimal';
  }

  function setEngine(engineId: string) {
    if (config.value.search.engines.some((engine) => engine.id === engineId)) {
      config.value.search.engineId = engineId;
    }
  }

  function replaceConfig(next: AppConfig) {
    config.value = mergeConfig(next);
  }

  watch(
    config,
    () => {
      if (ready.value) saveConfig(config.value);
    },
    { deep: true },
  );

  return {
    config,
    ready,
    isMinimal,
    init,
    toggleMinimal,
    setEngine,
    replaceConfig,
  };
});
