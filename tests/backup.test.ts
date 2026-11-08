import { describe, expect, it } from 'vitest';
import {
  collectUploadIconIds,
  countNavItems,
  createBackup,
  dataUrlToBlob,
  parseBackup,
  sanitizeBackupIcons,
} from '../shared/backup';
import { createDefaultConfig, createDefaultNav } from '../shared/defaults';
import type { NavGroup } from '../shared/types';

const TINY_ICON = 'data:image/webp;base64,aGVsbG8=';

describe('backup', () => {
  it('creates a SunTab backup with stats', () => {
    const backup = createBackup(createDefaultConfig(), createDefaultNav());
    expect(backup.app).toBe('SunTab');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.wallpapersIncluded).toBe(false);
    expect(countNavItems(backup.nav)).toEqual({
      groups: 2,
      icons: 0,
      folders: 0,
    });
  });

  it('parses valid JSON strings and sanitizes navigation', () => {
    const nav: NavGroup[] = [
      {
        id: 'g1',
        name: '主页',
        icon: 'home',
        items: [
          {
            id: 'a',
            type: 'icon',
            name: '安全',
            url: 'https://safe.example',
            icon: { kind: 'favicon', value: '' },
          },
          {
            id: 'bad',
            type: 'icon',
            name: '坏链接',
            url: 'javascript:alert(1)',
            icon: { kind: 'favicon', value: '' },
          },
        ],
      },
    ];
    const result = parseBackup(
      JSON.stringify(createBackup(createDefaultConfig(), nav)),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stats).toEqual({ groups: 1, icons: 1, folders: 0 });
      expect(result.data.nav[0]!.items).toHaveLength(1);
    }
  });

  it('rejects malformed or foreign backups', () => {
    expect(parseBackup('not json')).toEqual({
      ok: false,
      error: '文件不是有效的 JSON',
    });
    expect(parseBackup(null)).toEqual({
      ok: false,
      error: '备份文件格式不正确',
    });
    expect(parseBackup({ app: 'Other', schemaVersion: 1 })).toEqual({
      ok: false,
      error: '这不是 SunTab 的备份文件',
    });
    expect(parseBackup({ app: 'SunTab', schemaVersion: 2 })).toEqual({
      ok: false,
      error: '备份版本不受支持',
    });
    expect(
      parseBackup({ app: 'SunTab', schemaVersion: 1, config: {}, nav: [] }),
    ).toEqual({
      ok: false,
      error: '备份里没有可导入的分组',
    });
  });

  it('rejects backups whose groups are all invalid', () => {
    const result = parseBackup({
      app: 'SunTab',
      schemaVersion: 1,
      config: {},
      nav: [{ id: 'g', name: '空', items: [] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stats.groups).toBe(1);
      expect(result.stats.icons).toBe(0);
    }
  });

  it('carries uploaded icon files through export and import', () => {
    const backup = createBackup(createDefaultConfig(), createDefaultNav(), [
      { id: 'icon-one', type: 'image/webp', dataUrl: TINY_ICON, createdAt: 123 },
    ]);
    expect(backup.icons).toHaveLength(1);
    expect(backup.iconsIncluded).toBe(true);

    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.iconsIncluded).toBe(true);
      expect(result.data.icons?.[0]).toMatchObject({
        id: 'icon-one',
        type: 'image/webp',
        dataUrl: TINY_ICON,
      });
    }
  });

  it('keeps backups without icon files importable', () => {
    const backup = createBackup(createDefaultConfig(), createDefaultNav());
    expect(backup.icons).toBeUndefined();
    expect(backup.iconsIncluded).toBe(false);

    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.icons).toBeUndefined();
      expect(result.data.iconsIncluded).toBe(false);
    }
  });

  it('drops unsafe, duplicated or non-image icon files', () => {
    const icons = sanitizeBackupIcons([
      { id: 'ok', dataUrl: TINY_ICON },
      { id: 'ok', dataUrl: TINY_ICON },
      { id: '../bad', dataUrl: TINY_ICON },
      { id: 'bad-mime', dataUrl: 'data:text/html;base64,aGVsbG8=' },
      { id: 'bad-url', dataUrl: 'https://example.com/icon.webp' },
      { id: 'not-base64', dataUrl: 'data:image/webp,abc' },
      { id: 'too-long', dataUrl: `data:image/webp;base64,${'A'.repeat(9 * 1024 * 1024)}` },
    ]);
    expect(icons.map((icon) => icon.id)).toEqual(['ok']);
  });

  it('keeps svg uploads in backups', async () => {
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"/>',
    ).toString('base64')}`;
    const icons = sanitizeBackupIcons([{ id: 'svg-icon', dataUrl }]);
    expect(icons).toHaveLength(1);
    expect(icons[0]?.type).toBe('image/svg+xml');
    const blob = dataUrlToBlob(dataUrl);
    expect(blob?.type).toBe('image/svg+xml');
    expect(await blob?.text()).toContain('<svg');
  });

  it('collects only referenced upload icon ids', () => {
    const nav: NavGroup[] = [
      {
        id: 'g1',
        name: '主页',
        icon: 'home',
        items: [
          {
            id: 'a',
            type: 'icon',
            name: 'A',
            url: 'https://a.example',
            icon: { kind: 'upload', value: 'icon-a' },
          },
          {
            id: 'b',
            type: 'icon',
            name: 'B',
            url: 'https://b.example',
            icon: { kind: 'favicon', value: '' },
          },
          {
            id: 'folder',
            type: 'folder',
            name: '文件夹',
            children: [
              {
                id: 'c',
                type: 'icon',
                name: 'C',
                url: 'https://c.example',
                icon: { kind: 'upload', value: 'icon-c' },
              },
              {
                id: 'd',
                type: 'icon',
                name: 'D',
                url: 'https://d.example',
                icon: { kind: 'upload', value: 'icon-a' },
              },
            ],
          },
        ],
      },
    ];
    expect(collectUploadIconIds(nav).sort()).toEqual(['icon-a', 'icon-c']);
  });

  it('decodes base64 data urls back to image blobs', async () => {
    const blob = dataUrlToBlob(TINY_ICON);
    expect(blob?.type).toBe('image/webp');
    expect(await blob?.text()).toBe('hello');
    expect(dataUrlToBlob('data:text/html;base64,aGVsbG8=')).toBeNull();
    expect(dataUrlToBlob('not-a-data-url')).toBeNull();
  });
});
