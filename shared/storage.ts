import {
  createDefaultConfig,
  createDefaultNav,
  DEFAULT_WALLPAPER,
  LEGACY_DEFAULT_GRADIENT,
  PAPER_WALLPAPER,
  STORAGE_KEYS,
} from './defaults';
import type {
  AppConfig,
  FolderItem,
  IconItem,
  IconKind,
  IconSpec,
  NavGroup,
  NavItem,
  SearchEngine,
  WallpaperKind,
} from './types';
import { clampName, isSafeIconUrl, isSafeTextColor } from './nav';

interface StorageArea {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function getStorageArea(): StorageArea | null {
  const chromeApi = (
    globalThis as unknown as {
      chrome?: { storage?: { local?: StorageArea } };
    }
  ).chrome;
  return chromeApi?.storage?.local ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function sanitizeSearchEngines(value: unknown): SearchEngine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const engines: SearchEngine[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const urlTemplate =
      typeof item.urlTemplate === 'string' ? item.urlTemplate.trim() : '';
    if (!name || !/^https?:\/\//i.test(urlTemplate)) continue;
    const id =
      typeof item.id === 'string' && item.id && !seen.has(item.id)
        ? item.id
        : `engine-${engines.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    engines.push({
      id,
      name,
      urlTemplate,
      icon: typeof item.icon === 'string' ? item.icon : undefined,
    });
  }
  return engines;
}

export function mergeConfig(saved: unknown): AppConfig {
  const defaults = createDefaultConfig();
  if (!isRecord(saved)) return defaults;

  const theme = isRecord(saved.theme) ? saved.theme : {};
  const wallpaper = isRecord(saved.wallpaper) ? saved.wallpaper : {};
  const clock = isRecord(saved.clock) ? saved.clock : {};
  const search = isRecord(saved.search) ? saved.search : {};
  const icon = isRecord(saved.icon) ? saved.icon : {};
  const sidebar = isRecord(saved.sidebar) ? saved.sidebar : {};
  const layout = isRecord(saved.layout) ? saved.layout : {};

  const validKinds: WallpaperKind[] = ['gradient', 'color', 'upload', 'bing'];
  const wallpaperKind = validKinds.includes(wallpaper.kind as WallpaperKind)
    ? (wallpaper.kind as WallpaperKind)
    : defaults.wallpaper.kind;

  const engines = sanitizeSearchEngines(search.engines);
  const usableEngines = engines.length ? engines : defaults.search.engines;

  return {
    schemaVersion: 1,
    theme: {
      mode:
        theme.mode === 'light' || theme.mode === 'dark' || theme.mode === 'auto'
          ? theme.mode
          : defaults.theme.mode,
      accent: typeof theme.accent === 'string' ? theme.accent : defaults.theme.accent,
    },
    wallpaper: {
      kind: wallpaperKind,
      value:
        typeof wallpaper.value === 'string' && wallpaper.value
          ? wallpaper.value
          : defaults.wallpaper.value,
      blur: clamp(Number(wallpaper.blur ?? defaults.wallpaper.blur), 0, 20),
      dim: clamp(Number(wallpaper.dim ?? defaults.wallpaper.dim), 0, 60),
    },
    clock: {
      show: typeof clock.show === 'boolean' ? clock.show : defaults.clock.show,
      hour12: typeof clock.hour12 === 'boolean' ? clock.hour12 : defaults.clock.hour12,
      seconds: typeof clock.seconds === 'boolean' ? clock.seconds : defaults.clock.seconds,
      lunar: typeof clock.lunar === 'boolean' ? clock.lunar : defaults.clock.lunar,
      size: clamp(Number(clock.size ?? defaults.clock.size), 40, 140),
      color: typeof clock.color === 'string' ? clock.color : defaults.clock.color,
      font: typeof clock.font === 'string' ? clock.font : defaults.clock.font,
    },
    search: {
      show: typeof search.show === 'boolean' ? search.show : defaults.search.show,
      engines: usableEngines,
      engineId:
        typeof search.engineId === 'string' &&
        usableEngines.some((engine) => engine.id === search.engineId)
          ? search.engineId
          : defaults.search.engineId,
      openInNewTab:
        typeof search.openInNewTab === 'boolean'
          ? search.openInNewTab
          : defaults.search.openInNewTab,
    },
    icon: {
      size: clamp(Number(icon.size ?? defaults.icon.size), 36, 120),
      gap: clamp(Number(icon.gap ?? defaults.icon.gap), 8, 64),
      radius: clamp(Number(icon.radius ?? defaults.icon.radius), 0, 40),
      showLabel: typeof icon.showLabel === 'boolean' ? icon.showLabel : defaults.icon.showLabel,
      labelSize: clamp(Number(icon.labelSize ?? defaults.icon.labelSize), 9, 18),
      labelColor:
        typeof icon.labelColor === 'string' ? icon.labelColor : defaults.icon.labelColor,
      maxWidth: clamp(Number(icon.maxWidth ?? defaults.icon.maxWidth), 600, 2000),
    },
    sidebar: {
      side: sidebar.side === 'right' ? 'right' : 'left',
      width: clamp(Number(sidebar.width ?? defaults.sidebar.width), 40, 100),
      autoHide:
        typeof sidebar.autoHide === 'boolean' ? sidebar.autoHide : defaults.sidebar.autoHide,
      opacity: clamp(Number(sidebar.opacity ?? defaults.sidebar.opacity), 0.1, 1),
    },
    layout: {
      mode: layout.mode === 'minimal' ? 'minimal' : 'widgets',
      showQuote:
        typeof layout.showQuote === 'boolean' ? layout.showQuote : defaults.layout.showQuote,
    },
  };
}

export function migrateConfig(config: AppConfig): boolean {
  if (
    config.wallpaper.kind === 'gradient' &&
    config.wallpaper.value === LEGACY_DEFAULT_GRADIENT
  ) {
    config.wallpaper.value = DEFAULT_WALLPAPER;
    return true;
  }
  return false;
}

export function migrateDefaultWallpaper(config: AppConfig): boolean {
  let firstRun = false;
  try {
    if (localStorage.getItem(STORAGE_KEYS.nightDefaultMigrated) !== '1') {
      localStorage.setItem(STORAGE_KEYS.nightDefaultMigrated, '1');
      firstRun = true;
    }
  } catch {
    return false;
  }
  if (!firstRun) return false;
  if (config.wallpaper.kind !== 'gradient') return false;
  if (config.wallpaper.value !== PAPER_WALLPAPER) return false;
  config.wallpaper.value = DEFAULT_WALLPAPER;
  return true;
}

const SEARCH_OPEN_MIGRATION_KEY = 'suntab:migrated-search-open-new-tab';

function migrateSearchOpenDefault(config: AppConfig): boolean {
  try {
    if (localStorage.getItem(SEARCH_OPEN_MIGRATION_KEY) === '1') return false;
    localStorage.setItem(SEARCH_OPEN_MIGRATION_KEY, '1');
  } catch {
    return false;
  }
  if (config.search.openInNewTab) return false;
  config.search.openInNewTab = true;
  return true;
}

const ICON_LAYOUT_MIGRATION_KEY = 'suntab:migrated-icon-layout-025';

export function migrateIconLayoutDefaults(config: AppConfig): boolean {
  try {
    if (localStorage.getItem(ICON_LAYOUT_MIGRATION_KEY) === '1') return false;
    localStorage.setItem(ICON_LAYOUT_MIGRATION_KEY, '1');
  } catch {
    return false;
  }
  let changed = false;
  if (config.icon.size === 60) {
    config.icon.size = 50;
    changed = true;
  }
  if (config.icon.maxWidth === 1400) {
    config.icon.maxWidth = 800;
    changed = true;
  }
  return changed;
}

export async function loadConfig(): Promise<AppConfig> {
  const area = getStorageArea();
  if (!area) return createDefaultConfig();
  try {
    const stored = await area.get(STORAGE_KEYS.config);
    let value: unknown = stored[STORAGE_KEYS.config];
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    }
    const config = mergeConfig(value);
    const wallpaperMigrated = migrateConfig(config);
    const nightMigrated = migrateDefaultWallpaper(config);
    const searchMigrated = migrateSearchOpenDefault(config);
    const iconLayoutMigrated = migrateIconLayoutDefaults(config);
    if (wallpaperMigrated || nightMigrated || searchMigrated || iconLayoutMigrated) {
      try {
        await area.set({ [STORAGE_KEYS.config]: config });
      } catch {
        // Keep the migrated config in memory even if persistence fails.
      }
    }
    return config;
  } catch {
    return createDefaultConfig();
  }
}

let saveTimer: number | undefined;
let pendingConfig: AppConfig | null = null;

export async function flushConfig(): Promise<void> {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (!pendingConfig) return;
  const config = pendingConfig;
  pendingConfig = null;
  const area = getStorageArea();
  if (!area) return;
  try {
    await area.set({ [STORAGE_KEYS.config]: config });
  } catch {
    // Keep the in-memory config; the next change will retry.
  }
}

export function saveConfig(config: AppConfig): void {
  pendingConfig = JSON.parse(JSON.stringify(config)) as AppConfig;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void flushConfig();
  }, 300);
}

function sanitizeIconSpec(value: unknown): IconSpec {
  if (!isRecord(value)) return { kind: 'favicon', value: '' };
  let kind: IconKind =
    value.kind === 'upload' || value.kind === 'text' || value.kind === 'url'
      ? value.kind
      : 'favicon';
  const rawValue = typeof value.value === 'string' ? value.value.trim() : '';
  let iconValue = rawValue;
  if (kind === 'upload' && !rawValue) {
    kind = 'text';
    iconValue = '';
  }
  if (kind === 'url' && !isSafeIconUrl(rawValue)) {
    kind = 'favicon';
    iconValue = '';
  }
  const bg =
    typeof value.bg === 'string' && isSafeTextColor(value.bg) ? value.bg : undefined;
  return { kind, value: iconValue, bg };
}

function sanitizeSiteUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : '';
  } catch {
    return '';
  }
}

function uniqueId(value: unknown, seen: Set<string>, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const base = raw || fallback;
  let id = base;
  let suffix = 2;
  while (seen.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  seen.add(id);
  return id;
}

function sanitizeIconItem(value: unknown, seen: Set<string>): IconItem | null {
  if (!isRecord(value) || value.type !== 'icon') return null;
  if (typeof value.name !== 'string' || typeof value.url !== 'string') return null;
  const url = sanitizeSiteUrl(value.url);
  if (!url) return null;
  return {
    id: uniqueId(value.id, seen, crypto.randomUUID()),
    type: 'icon',
    name: clampName(value.name) || '未命名图标',
    url,
    icon: sanitizeIconSpec(value.icon),
  };
}

function sanitizeFolderItem(value: unknown, seen: Set<string>): FolderItem | null {
  if (!isRecord(value) || value.type !== 'folder') return null;
  const children = Array.isArray(value.children)
    ? value.children
        .map((child) => sanitizeIconItem(child, seen))
        .filter((item): item is IconItem => Boolean(item))
    : [];
  return {
    id: uniqueId(value.id, seen, crypto.randomUUID()),
    type: 'folder',
    name: clampName(typeof value.name === 'string' ? value.name : '') || '文件夹',
    children,
  };
}

function sanitizeNavItem(value: unknown, seen: Set<string>): NavItem | null {
  return sanitizeIconItem(value, seen) ?? sanitizeFolderItem(value, seen);
}

export function sanitizeNavGroups(value: unknown): NavGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(isRecord)
    .map((group) => {
      const items = Array.isArray(group.items)
        ? group.items
            .map((item) => sanitizeNavItem(item, seen))
            .filter((item): item is NavItem => Boolean(item))
        : [];
      return {
        id: uniqueId(group.id, seen, crypto.randomUUID()),
        name: clampName(typeof group.name === 'string' ? group.name : '') || '未命名分组',
        icon: typeof group.icon === 'string' ? group.icon : 'folder',
        items,
      };
    });
}

export async function loadNav(): Promise<NavGroup[]> {
  const area = getStorageArea();
  if (!area) return createDefaultNav();
  try {
    const stored = await area.get(STORAGE_KEYS.nav);
    let value: unknown = stored[STORAGE_KEYS.nav];
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = null;
      }
    }
    const groups = sanitizeNavGroups(value);
    return groups.length ? groups : createDefaultNav();
  } catch {
    return createDefaultNav();
  }
}

let navSaveTimer: number | undefined;
let pendingNav: NavGroup[] | null = null;

export async function flushNav(): Promise<void> {
  if (navSaveTimer) {
    window.clearTimeout(navSaveTimer);
    navSaveTimer = undefined;
  }
  if (!pendingNav) return;
  const groups = pendingNav;
  pendingNav = null;
  const area = getStorageArea();
  if (!area) return;
  try {
    await area.set({ [STORAGE_KEYS.nav]: groups });
  } catch {
    // Keep the in-memory nav; the next change will retry.
  }
}

export function saveNav(groups: NavGroup[]): void {
  pendingNav = JSON.parse(JSON.stringify(groups)) as NavGroup[];
  if (navSaveTimer) window.clearTimeout(navSaveTimer);
  navSaveTimer = window.setTimeout(() => {
    void flushNav();
  }, 300);
}

export async function writeNav(groups: NavGroup[]): Promise<void> {
  if (navSaveTimer) {
    window.clearTimeout(navSaveTimer);
    navSaveTimer = undefined;
  }
  pendingNav = null;
  const area = getStorageArea();
  if (!area) return;
  await area.set({
    [STORAGE_KEYS.nav]: JSON.parse(JSON.stringify(groups)) as NavGroup[],
  });
}

export interface StorageChange {
  newValue?: unknown;
}

export function onStorageChanged(
  callback: (changes: Record<string, StorageChange>, areaName: string) => void,
): void {
  const api = (
    globalThis as unknown as {
      chrome?: {
        storage?: {
          onChanged?: {
            addListener(cb: (changes: Record<string, StorageChange>, areaName: string) => void): void;
          };
        };
      };
    }
  ).chrome?.storage?.onChanged;
  api?.addListener(callback);
}
