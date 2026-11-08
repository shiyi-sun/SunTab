import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COLOR_PRESETS,
  createDefaultConfig,
  DEFAULT_WALLPAPER,
  LEGACY_DEFAULT_GRADIENT,
  PAPER_WALLPAPER,
  WALLPAPER_PRESETS,
} from '../shared/defaults';
import { migrateConfig, migrateDefaultWallpaper } from '../shared/storage';
import { isLightWallpaper } from '../shared/wallpaper';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

beforeEach(() => {
  storage.clear();
});

describe('default wallpaper migration', () => {
  it('uses night as the default for new configs', () => {
    const config = createDefaultConfig();
    expect(config.wallpaper.kind).toBe('gradient');
    expect(config.wallpaper.value).toBe(DEFAULT_WALLPAPER);
    expect(DEFAULT_WALLPAPER).toBe(
      WALLPAPER_PRESETS.find((preset) => preset.name === '夜航')?.value,
    );
  });

  it('migrates only the legacy default gradient', () => {
    const config = createDefaultConfig();
    config.wallpaper.kind = 'gradient';
    config.wallpaper.value = LEGACY_DEFAULT_GRADIENT;

    expect(migrateConfig(config)).toBe(true);
    expect(config.wallpaper.value).toBe(DEFAULT_WALLPAPER);
  });

  it('moves the old paper default to night exactly once', () => {
    const config = createDefaultConfig();
    config.wallpaper.value = PAPER_WALLPAPER;

    expect(migrateDefaultWallpaper(config)).toBe(true);
    expect(config.wallpaper.value).toBe(DEFAULT_WALLPAPER);

    const chosenAgain = createDefaultConfig();
    chosenAgain.wallpaper.value = PAPER_WALLPAPER;
    expect(migrateDefaultWallpaper(chosenAgain)).toBe(false);
    expect(chosenAgain.wallpaper.value).toBe(PAPER_WALLPAPER);
  });

  it('leaves custom gradients and other wallpaper kinds untouched', () => {
    const custom = createDefaultConfig();
    custom.wallpaper.kind = 'gradient';
    custom.wallpaper.value = 'linear-gradient(135deg, #000000, #ffffff)';
    expect(migrateConfig(custom)).toBe(false);
    expect(custom.wallpaper.value).toBe('linear-gradient(135deg, #000000, #ffffff)');

    const upload = createDefaultConfig();
    upload.wallpaper.kind = 'upload';
    upload.wallpaper.value = LEGACY_DEFAULT_GRADIENT;
    expect(migrateConfig(upload)).toBe(false);
  });

  it('keeps the first-paint default in sync with the config default', () => {
    const early = readFileSync(resolve('public/early.js'), 'utf8');
    expect(early).toContain(DEFAULT_WALLPAPER);
  });

  it('keeps the selected presets and detects light backgrounds', () => {
    const names = WALLPAPER_PRESETS.map((preset) => preset.name);
    expect(names).toEqual(['玄纸', '夜航', '雾蓝', '青瓷', '初雪']);
    expect(WALLPAPER_PRESETS[0]?.value).toBe(PAPER_WALLPAPER);
    expect(WALLPAPER_PRESETS[1]?.value).toBe(DEFAULT_WALLPAPER);

    const preset = (name: string) =>
      WALLPAPER_PRESETS.find((item) => item.name === name)!;
    expect(isLightWallpaper({ kind: 'gradient', value: preset('初雪').value })).toBe(
      true,
    );
    expect(preset('初雪').dim).toBe(0);
    expect(preset('夜航').dim).toBe(10);
    expect(isLightWallpaper({ kind: 'gradient', value: preset('夜航').value })).toBe(
      false,
    );
    expect(isLightWallpaper({ kind: 'color', value: '#eaf2f9' })).toBe(true);
    expect(isLightWallpaper({ kind: 'color', value: '#0b1026' })).toBe(false);

    expect(COLOR_PRESETS.map((item) => item.name)).toEqual([
      '雾紫',
      '深蓝',
      '蓝灰',
      '酒红',
      '墨绿',
      '纯黑',
    ]);
  });
});
