import { computed, ref, watch, type CSSProperties } from 'vue';
import { defineStore } from 'pinia';
import type { WallpaperRecord } from '../shared/db';
import {
  COLOR_PRESETS,
  DEFAULT_WALLPAPER,
  LEGACY_DEFAULT_GRADIENT,
  PAPER_WALLPAPER,
  STORAGE_KEYS,
  WALLPAPER_PRESETS,
} from '../shared/defaults';
import { blobToDataUrl, processImage } from '../shared/image';
import { useConfigStore } from './config';

const BING_ORIGIN = 'https://*.bing.com/*';
const BING_API = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

interface ChromePermissions {
  contains(details: { origins: string[] }, callback: (granted: boolean) => void): void;
  request(details: { origins: string[] }, callback: (granted: boolean) => void): void;
}

interface ChromeApi {
  permissions?: ChromePermissions;
  runtime?: { lastError?: { message?: string } };
}

interface BingImage {
  url?: string;
  urlbase?: string;
  copyright?: string;
}

interface BingResponse {
  images?: BingImage[];
}

function getChromeApi(): ChromeApi | undefined {
  return (globalThis as unknown as { chrome?: ChromeApi }).chrome;
}

function hasBingPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.permissions?.contains) return resolve(false);
    chromeApi.permissions.contains({ origins: [BING_ORIGIN] }, (granted) => {
      resolve(Boolean(granted) && !chromeApi.runtime?.lastError);
    });
  });
}

function requestBingPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.permissions?.request) return resolve(false);
    try {
      chromeApi.permissions.request({ origins: [BING_ORIGIN] }, (granted) => {
        resolve(Boolean(granted) && !chromeApi.runtime?.lastError);
      });
    } catch {
      resolve(false);
    }
  });
}

function todayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

async function wallpaperTable() {
  return (await import('../shared/db')).db.wallpapers;
}

interface BootstrapWallpaper {
  kind?: string;
  value?: string;
  blur?: number;
  dim?: number;
  thumb?: string;
}

export const useWallpaperStore = defineStore('wallpaper', () => {
  const configStore = useConfigStore();

  const objectUrl = ref('');
  const bootstrap = ref<BootstrapWallpaper | null>(null);
  const bootstrapThumb = ref('');
  const copyright = ref('');
  const error = ref('');
  const busy = ref(false);
  const initialized = ref(false);

  const backgroundStyle = computed<CSSProperties>(() => {
    const wallpaper = configStore.config.wallpaper;
    if (!configStore.ready) {
      const snapshot = bootstrap.value;
      if (snapshot?.thumb) {
        return {
          backgroundImage: `url("${snapshot.thumb}")`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        };
      }
      if (snapshot?.kind === 'gradient' || snapshot?.kind === 'color') {
        return { background: snapshot.value || DEFAULT_WALLPAPER };
      }
      return { background: DEFAULT_WALLPAPER };
    }
    if (wallpaper.kind === 'gradient' || wallpaper.kind === 'color') {
      return { background: wallpaper.value };
    }
    const source = objectUrl.value || bootstrapThumb.value;
    if (source) {
      return {
        backgroundImage: `url("${source}")`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      };
    }
    return { background: DEFAULT_WALLPAPER };
  });

  const displayBlur = computed(() => {
    return configStore.ready
      ? configStore.config.wallpaper.blur
      : Math.max(0, Math.min(20, Number(bootstrap.value?.blur) || 0));
  });

  const displayDim = computed(() => {
    return configStore.ready
      ? configStore.config.wallpaper.dim
      : Math.max(0, Math.min(60, Number(bootstrap.value?.dim) || 10));
  });

  const currentLabel = computed(() => {
    const { kind, value } = configStore.config.wallpaper;
    if (kind === 'gradient') {
      return WALLPAPER_PRESETS.find((preset) => preset.value === value)?.name ?? '自定义渐变';
    }
    if (kind === 'color') {
      const preset = COLOR_PRESETS.find(
        (item) => item.value.toLowerCase() === value.toLowerCase(),
      );
      return preset ? `${preset.name} ${value}` : value;
    }
    if (kind === 'upload') return '本地图片';
    return '必应每日';
  });

  function revokeObjectUrl() {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value);
      objectUrl.value = '';
    }
  }

  function setObjectUrl(blob: Blob) {
    revokeObjectUrl();
    objectUrl.value = URL.createObjectURL(blob);
  }

  function persistBootstrap() {
    try {
      const wallpaper = configStore.config.wallpaper;
      localStorage.setItem(
        STORAGE_KEYS.bootstrap,
        JSON.stringify({
          wallpaper: {
            kind: wallpaper.kind,
            value: wallpaper.value,
            blur: wallpaper.blur,
            dim: wallpaper.dim,
            thumb: bootstrapThumb.value || undefined,
          },
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // The app can still run without a first-paint snapshot.
    }
  }

  function loadBootstrap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.bootstrap);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as { wallpaper?: BootstrapWallpaper };
      if (!snapshot.wallpaper) return;
      if (snapshot.wallpaper.kind === 'gradient') {
        const legacy = snapshot.wallpaper.value === LEGACY_DEFAULT_GRADIENT;
        const oldDefault =
          snapshot.wallpaper.value === PAPER_WALLPAPER &&
          localStorage.getItem(STORAGE_KEYS.nightDefaultMigrated) !== '1';
        if (legacy || oldDefault) snapshot.wallpaper.value = DEFAULT_WALLPAPER;
      }
      bootstrap.value = snapshot.wallpaper;
      if (snapshot.wallpaper.thumb) bootstrapThumb.value = snapshot.wallpaper.thumb;
    } catch {
      // Ignore malformed snapshots and fall back to the app wallpaper.
    }
  }

  loadBootstrap();

  async function loadCurrent() {
    const wallpaper = configStore.config.wallpaper;
    if (wallpaper.kind === 'gradient' || wallpaper.kind === 'color') {
      revokeObjectUrl();
      bootstrapThumb.value = '';
      copyright.value = '';
      persistBootstrap();
      return;
    }

    const id = wallpaper.kind === 'bing' ? 'bing-daily' : wallpaper.value;
    if (!id) {
      revokeObjectUrl();
      persistBootstrap();
      return;
    }

    const record = await (await wallpaperTable()).get(id);
    if (!record) {
      revokeObjectUrl();
      bootstrapThumb.value = '';
      copyright.value = '';
      persistBootstrap();
      return;
    }

    setObjectUrl(record.full);
    bootstrapThumb.value = await blobToDataUrl(record.thumb);
    copyright.value = record.copyright ?? '';
    persistBootstrap();
  }

  async function fetchAndApplyBing(silent = false) {
    if (!silent) error.value = '';
    try {
      const cached = await (await wallpaperTable()).get('bing-daily');
      if (cached?.date === todayKey()) {
        configStore.config.wallpaper = {
          ...configStore.config.wallpaper,
          kind: 'bing',
          value: 'daily',
        };
        await loadCurrent();
        return;
      }

      const response = await fetch(BING_API, { cache: 'no-store' });
      if (!response.ok) throw new Error('必应壁纸请求失败');
      const data = (await response.json()) as BingResponse;
      const image = data.images?.[0];
      if (!image) throw new Error('没有获取到必应壁纸');

      const imagePath = image.url || (image.urlbase ? `${image.urlbase}_1920x1080.jpg` : '');
      if (!imagePath) throw new Error('必应壁纸地址为空');
      const imageUrl = new URL(imagePath, 'https://www.bing.com').toString();
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error('必应壁纸下载失败');

      const processed = await processImage(await imageResponse.blob(), 2560);
      const record: WallpaperRecord = {
        id: 'bing-daily',
        kind: 'bing',
        name: image.copyright || '必应每日',
        createdAt: Date.now(),
        date: todayKey(),
        width: processed.width,
        height: processed.height,
        full: processed.full,
        thumb: processed.thumb,
        copyright: image.copyright || '',
      };
      await (await wallpaperTable()).put(record);

      configStore.config.wallpaper = {
        ...configStore.config.wallpaper,
        kind: 'bing',
        value: 'daily',
      };
      await loadCurrent();
      error.value = '';
    } catch (reason) {
      if (!silent) throw reason;
    }
  }

  async function init() {
    if (initialized.value) return;
    await loadCurrent();
    initialized.value = true;

    if (configStore.config.wallpaper.kind === 'bing') {
      const record = await (await wallpaperTable()).get('bing-daily');
      if (!record || record.date !== todayKey()) {
        void hasBingPermission().then((granted) => {
          if (granted) void fetchAndApplyBing(true);
        });
      }
    }
  }

  function setGradient(value: string) {
    error.value = '';
    configStore.config.wallpaper = {
      ...configStore.config.wallpaper,
      kind: 'gradient',
      value,
    };
    void loadCurrent();
  }

  function setColor(value: string) {
    error.value = '';
    configStore.config.wallpaper = {
      ...configStore.config.wallpaper,
      kind: 'color',
      value,
    };
    void loadCurrent();
  }

  function setBlur(value: number) {
    configStore.config.wallpaper.blur = Math.min(20, Math.max(0, value));
  }

  function setDim(value: number) {
    configStore.config.wallpaper.dim = Math.min(60, Math.max(0, value));
  }

  async function uploadFile(file: File): Promise<boolean> {
    error.value = '';
    if (!file.type.startsWith('image/')) {
      error.value = '请选择图片文件';
      return false;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      error.value = '图片不能超过 8MB';
      return false;
    }

    busy.value = true;
    try {
      const processed = await processImage(file);
      const id = crypto.randomUUID();
      await (await wallpaperTable()).put({
        id,
        kind: 'upload',
        name: file.name,
        createdAt: Date.now(),
        width: processed.width,
        height: processed.height,
        full: processed.full,
        thumb: processed.thumb,
      });
      configStore.config.wallpaper = {
        ...configStore.config.wallpaper,
        kind: 'upload',
        value: id,
      };
      await loadCurrent();
      return true;
    } catch (reason) {
      error.value = messageOf(reason);
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function enableBing(): Promise<boolean> {
    error.value = '';
    busy.value = true;
    try {
      const granted = await requestBingPermission();
      if (!granted) throw new Error('需要授权访问 bing.com 才能获取每日壁纸');
      await fetchAndApplyBing(false);
      return true;
    } catch (reason) {
      error.value = messageOf(reason);
      return false;
    } finally {
      busy.value = false;
    }
  }

  watch(
    () => [configStore.config.wallpaper.kind, configStore.config.wallpaper.value],
    () => {
      if (initialized.value) void loadCurrent();
    },
  );

  watch(
    () => [configStore.config.wallpaper.blur, configStore.config.wallpaper.dim],
    () => {
      if (initialized.value) persistBootstrap();
    },
  );

  return {
    backgroundStyle,
    displayBlur,
    displayDim,
    currentLabel,
    copyright,
    error,
    busy,
    init,
    setGradient,
    setColor,
    setBlur,
    setDim,
    uploadFile,
    enableBing,
  };
});
