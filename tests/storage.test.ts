import { describe, expect, it } from 'vitest';
import { mergeConfig } from '../shared/storage';
import { createDefaultConfig } from '../shared/defaults';

describe('config persistence', () => {
  it('falls back to defaults for invalid data', () => {
    const config = mergeConfig(null);
    expect(config).toEqual(createDefaultConfig());
  });

  it('merges partial config and clamps numeric values', () => {
    const config = mergeConfig({
      theme: { mode: 'dark' },
      wallpaper: { kind: 'upload', value: 'wallpaper-id', blur: 99, dim: -5 },
      icon: { size: 200, gap: 2 },
      search: { engineId: 'missing-engine' },
    });

    expect(config.theme.mode).toBe('dark');
    expect(config.wallpaper.kind).toBe('upload');
    expect(config.wallpaper.value).toBe('wallpaper-id');
    expect(config.wallpaper.blur).toBe(20);
    expect(config.wallpaper.dim).toBe(0);
    expect(config.icon.size).toBe(120);
    expect(config.icon.gap).toBe(8);
    expect(config.search.engineId).toBe('baidu');
  });

  it('defaults to opening search results in a new tab', () => {
    expect(createDefaultConfig().search.openInNewTab).toBe(true);
    expect(mergeConfig({ search: { openInNewTab: false } }).search.openInNewTab).toBe(
      false,
    );
  });

  it('drops search engines with non-http URLs', () => {
    const config = mergeConfig({
      search: {
        engines: [
          { id: 'bad', name: 'Bad', urlTemplate: 'javascript:alert(1)' },
          { id: 'ok', name: 'OK', urlTemplate: 'https://example.com/search?q=%s' },
        ],
        engineId: 'bad',
      },
    });

    expect(config.search.engines.map((engine) => engine.id)).toEqual(['ok']);
    expect(config.search.engineId).toBe('baidu');
  });
});
