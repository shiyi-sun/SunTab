import type { AppConfig, NavGroup, SearchEngine } from './types';

export const APP_NAME = 'SunTab';
export const APP_VERSION = '0.2.12';
export const SCHEMA_VERSION = 1 as const;

export const STORAGE_KEYS = {
  config: 'suntab:config',
  nav: 'suntab:nav',
  bootstrap: 'suntab:bootstrap',
  nightDefaultMigrated: 'suntab:migrated-default-night',
} as const;

export const DEFAULT_ENGINES: SearchEngine[] = [
  { id: 'baidu', name: '百度', urlTemplate: 'https://www.baidu.com/s?wd=%s' },
  { id: 'bing', name: '必应', urlTemplate: 'https://www.bing.com/search?q=%s' },
  { id: 'google', name: 'Google', urlTemplate: 'https://www.google.com/search?q=%s' },
  { id: 'duckduckgo', name: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s' },
];

export const LEGACY_DEFAULT_GRADIENT =
  'linear-gradient(135deg, #0b1026 0%, #1b2a6b 35%, #6d3b8f 68%, #e07a5f 100%)';

const PAPER_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.12'/%3E%3C/svg%3E") center / 140px 140px repeat`;

export const PAPER_WALLPAPER = [
  PAPER_GRAIN,
  'radial-gradient(80% 60% at 50% 18%, rgba(242, 238, 230, 0.15), transparent 65%)',
  'radial-gradient(120% 100% at 50% 120%, rgba(140, 108, 80, 0.14), transparent 60%)',
  'radial-gradient(120% 120% at 50% 50%, #181715 0%, #111110 55%, #070706 100%)',
].join(', ');

const NIGHT_GRADIENT = [
  'radial-gradient(120% 110% at 76% -10%, rgba(58, 160, 184, 0.3), transparent 60%)',
  'radial-gradient(90% 90% at 8% 108%, rgba(214, 120, 72, 0.16), transparent 62%)',
  'radial-gradient(140% 130% at 50% 42%, #111d30 0%, #0a1321 52%, #05080f 100%)',
].join(', ');

export const DEFAULT_WALLPAPER = NIGHT_GRADIENT;

const COOL_MIST_GRADIENT = [
  'radial-gradient(110% 100% at 18% -8%, rgba(126, 164, 193, 0.24), transparent 62%)',
  'radial-gradient(90% 90% at 92% 96%, rgba(52, 104, 116, 0.18), transparent 60%)',
  'radial-gradient(140% 130% at 50% 45%, #0c141d 0%, #0a1119 55%, #05080d 100%)',
].join(', ');

const CELADON_GRADIENT = [
  'radial-gradient(110% 100% at 16% -6%, rgba(126, 190, 172, 0.24), transparent 62%)',
  'radial-gradient(80% 80% at 96% 100%, rgba(196, 154, 96, 0.1), transparent 60%)',
  'radial-gradient(140% 130% at 50% 44%, #0d1c1a 0%, #081311 55%, #040908 100%)',
].join(', ');

const LEGACY_MIST_GRADIENT = [
  'radial-gradient(100% 90% at 20% 0%, #ffffff 0%, transparent 60%)',
  'radial-gradient(80% 80% at 92% 100%, #dce6ee 0%, transparent 62%)',
  'linear-gradient(160deg, #edf2f6 0%, #e5ebf1 55%, #dbe3ea 100%)',
].join(', ');

const LEGACY_MOONLIGHT_GRADIENT = [
  'radial-gradient(70% 55% at 76% 6%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.28) 28%, transparent 62%)',
  'radial-gradient(95% 85% at 8% 100%, rgba(174, 198, 218, 0.4) 0%, transparent 64%)',
  'linear-gradient(160deg, #f4f8fb 0%, #e9f0f6 52%, #dce6ee 100%)',
].join(', ');

const FIRST_SNOW_GRADIENT = [
  'radial-gradient(120% 90% at 50% -10%, #ffffff 0%, #ffffff 42%, rgba(255, 255, 255, 0) 78%)',
  'radial-gradient(85% 70% at 100% 100%, rgba(196, 216, 233, 0.22) 0%, rgba(196, 216, 233, 0) 64%)',
  'linear-gradient(170deg, #ffffff 0%, #fbfdff 50%, #f3f7fb 100%)',
].join(', ');

export interface WallpaperPreset {
  name: string;
  value: string;
  tone: 'light' | 'dark';
  dim?: number;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { name: '玄纸', value: PAPER_WALLPAPER, tone: 'dark', dim: 10 },
  { name: '夜航', value: NIGHT_GRADIENT, tone: 'dark', dim: 10 },
  { name: '雾蓝', value: COOL_MIST_GRADIENT, tone: 'dark', dim: 10 },
  { name: '青瓷', value: CELADON_GRADIENT, tone: 'dark', dim: 10 },
  { name: '初雪', value: FIRST_SNOW_GRADIENT, tone: 'light', dim: 0 },
];

export const LIGHT_GRADIENT_VALUES = new Set([
  ...WALLPAPER_PRESETS.filter((preset) => preset.tone === 'light').map(
    (preset) => preset.value,
  ),
  // 旧版可选预设，保留判定以免仍在使用的配置变成深色前景。
  LEGACY_MIST_GRADIENT,
  LEGACY_MOONLIGHT_GRADIENT,
]);

export interface ColorPreset {
  name: string;
  value: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: '雾紫', value: '#f3eff8' },
  { name: '深蓝', value: '#0b1026' },
  { name: '蓝灰', value: '#1e3a5f' },
  { name: '酒红', value: '#4a2545' },
  { name: '墨绿', value: '#123c34' },
  { name: '纯黑', value: '#111111' },
];

export const DEFAULT_NAV: NavGroup[] = [
  {
    id: 'group-home',
    name: '主页',
    icon: 'home',
    items: [],
  },
  {
    id: 'group-ai',
    name: 'AI',
    icon: 'ai',
    items: [],
  },
];

export const DEFAULT_CONFIG: AppConfig = {
  schemaVersion: SCHEMA_VERSION,
  theme: {
    mode: 'auto',
    accent: '#4c8dff',
  },
  wallpaper: {
    kind: 'gradient',
    value: DEFAULT_WALLPAPER,
    blur: 0,
    dim: 10,
  },
  clock: {
    show: true,
    hour12: false,
    seconds: false,
    lunar: true,
    size: 72,
    color: '#ffffff',
  },
  search: {
    show: true,
    engines: DEFAULT_ENGINES,
    engineId: 'baidu',
    openInNewTab: true,
  },
  icon: {
    size: 50,
    gap: 28,
    radius: 18,
    showLabel: true,
    labelSize: 12,
    labelColor: '#ffffff',
    maxWidth: 800,
  },
  sidebar: {
    side: 'left',
    width: 56,
    autoHide: false,
    opacity: 0.5,
  },
  layout: {
    mode: 'widgets',
    showQuote: true,
  },
};

export function createDefaultConfig(): AppConfig {
  return structuredClone(DEFAULT_CONFIG);
}

export function createDefaultNav(): NavGroup[] {
  return structuredClone(DEFAULT_NAV);
}
