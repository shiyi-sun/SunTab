import { describe, expect, it } from 'vitest';
import { sanitizeNavGroups } from '../shared/storage';
import {
  clampIconText,
  clampName,
  countNavItems,
  findIconByUrl,
  MAX_ICON_TEXT_CHARS,
  normalizeHttpUrl,
  normalizeIconUrl,
  splitIconText,
} from '../shared/nav';
import type { IconItem, NavGroup } from '../shared/types';

function icon(partial: Partial<IconItem> = {}): IconItem {
  return {
    id: 'icon-1',
    type: 'icon',
    name: '示例',
    url: 'https://example.com',
    icon: { kind: 'favicon', value: '' },
    ...partial,
  };
}

describe('nav utilities', () => {
  it('normalizes web urls and rejects dangerous protocols', () => {
    expect(normalizeHttpUrl('github.com')).toBe('https://github.com/');
    expect(normalizeHttpUrl('http://localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeHttpUrl('data:text/html,hello')).toBeNull();
    expect(normalizeHttpUrl('https://exa mple.com')).toBeNull();
    expect(normalizeHttpUrl('')).toBeNull();
  });

  it('accepts local paths and image data urls for icon sources', () => {
    expect(normalizeIconUrl('/icons/sites/github.svg')).toBe('/icons/sites/github.svg');
    expect(normalizeIconUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(normalizeIconUrl('cdn.example.com/icon.png')).toBe(
      'https://cdn.example.com/icon.png',
    );
    expect(normalizeIconUrl('javascript:alert(1)')).toBeNull();
  });

  it('clamps names by characters rather than code units', () => {
    expect(clampName('  你好世界  ')).toBe('你好世界');
    expect(Array.from(clampName('a'.repeat(60))).length).toBe(48);
  });

  it('clamps and balances text icon labels in up to two lines', () => {
    expect(clampIconText('  哔哩哔哩  ')).toBe('哔哩哔哩');
    expect(Array.from(clampIconText('一二三四五六七')).length).toBe(
      MAX_ICON_TEXT_CHARS,
    );
    expect(splitIconText('')).toEqual([]);
    expect(splitIconText('知')).toEqual(['知']);
    expect(splitIconText('知乎')).toEqual(['知乎']);
    expect(splitIconText('Git')).toEqual(['Git']);
    expect(splitIconText('哔哩哔')).toEqual(['哔哩哔']);
    expect(splitIconText('哔哩哔哩')).toEqual(['哔哩', '哔哩']);
    expect(splitIconText('网易云音乐')).toEqual(['网易云', '音乐']);
    expect(splitIconText('一二三四五六')).toEqual(['一二三', '四五六']);
  });

  it('finds duplicate urls case-insensitively', () => {
    const items = [icon({ id: 'one', url: 'https://GitHub.com' })];
    expect(findIconByUrl(items, 'https://github.com')?.id).toBe('one');
    expect(findIconByUrl(items, 'https://github.com', 'one')).toBeNull();
  });

  it('counts groups, icons and folder children', () => {
    const groups: NavGroup[] = [
      {
        id: 'g1',
        name: '主页',
        icon: 'home',
        items: [
          icon({ id: 'a' }),
          {
            id: 'f1',
            type: 'folder',
            name: '文件夹',
            children: [icon({ id: 'b' }), icon({ id: 'c' })],
          },
        ],
      },
    ];
    expect(countNavItems(groups)).toEqual({ groups: 1, icons: 1, folders: 1, children: 2 });
  });
});

describe('nav sanitize', () => {
  it('drops unsafe urls, fixes icon fallbacks and de-duplicates ids', () => {
    const groups = sanitizeNavGroups([
      {
        id: 'g1',
        name: '  主页  ',
        icon: 'home',
        items: [
          {
            id: 'a',
            type: 'icon',
            name: '  安全  ',
            url: 'https://safe.example',
            icon: { kind: 'url', value: 'javascript:alert(1)' },
          },
          {
            id: 'bad',
            type: 'icon',
            name: '坏链接',
            url: 'javascript:alert(1)',
            icon: { kind: 'favicon', value: '' },
          },
          {
            id: 'f1',
            type: 'folder',
            name: '文件夹',
            children: [
              {
                id: 'a',
                type: 'icon',
                name: '子图标',
                url: 'https://child.example',
                icon: { kind: 'upload', value: '' },
              },
            ],
          },
        ],
      },
    ]);

    expect(groups).toHaveLength(1);
    const group = groups[0]!;
    expect(group.name).toBe('主页');
    expect(group.items).toHaveLength(2);

    const first = group.items[0]!;
    expect(first.type).toBe('icon');
    if (first.type === 'icon') {
      expect(first.name).toBe('安全');
      expect(first.icon.kind).toBe('favicon');
      expect('size' in first).toBe(false);
    }

    const folder = group.items[1]!;
    expect(folder.type).toBe('folder');
    if (folder.type === 'folder') {
      expect(folder.children).toHaveLength(1);
      expect(folder.children[0]!.id).toBe('a-2');
      expect(folder.children[0]!.icon.kind).toBe('text');
    }
  });

  it('returns an empty list for non-array input', () => {
    expect(sanitizeNavGroups({})).toEqual([]);
    expect(sanitizeNavGroups(null)).toEqual([]);
  });
});
