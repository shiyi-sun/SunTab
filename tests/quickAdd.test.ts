import { describe, expect, it } from 'vitest';
import {
  createQuickAddIcon,
  findGroupIconByUrl,
  isQuickAddableUrl,
  quickAddName,
} from '../shared/quickAdd';
import type { NavGroup } from '../shared/types';

const group: NavGroup = {
  id: 'g1',
  name: '主页',
  icon: 'home',
  items: [
    {
      id: 'folder-1',
      type: 'folder',
      name: '工具',
      children: [
        {
          id: 'child-1',
          type: 'icon',
          name: 'GitHub',
          url: 'https://github.com/',
          icon: { kind: 'favicon', value: '' },
        },
      ],
    },
  ],
};

describe('quick add', () => {
  it('accepts only http(s) pages', () => {
    expect(isQuickAddableUrl('https://github.com')).toBe(true);
    expect(isQuickAddableUrl('github.com')).toBe(true);
    expect(isQuickAddableUrl('http://localhost:3000')).toBe(true);
    expect(isQuickAddableUrl('chrome://settings')).toBe(false);
    expect(isQuickAddableUrl('chrome-extension://abc/popup.html')).toBe(false);
    expect(isQuickAddableUrl('about:blank')).toBe(false);
    expect(isQuickAddableUrl('javascript:alert(1)')).toBe(false);
    expect(isQuickAddableUrl(undefined)).toBe(false);
  });

  it('uses the page title or falls back to the hostname', () => {
    expect(quickAddName('  GitHub · Build software  ', 'https://github.com')).toBe(
      'GitHub · Build software',
    );
    expect(quickAddName('', 'https://www.example.com/path')).toBe('example.com');
    expect(quickAddName(null, 'https://example.com')).toBe('example.com');
    expect(quickAddName('', 'not a url')).toBe('');
    expect(Array.from(quickAddName('a'.repeat(60), 'https://example.com'))).toHaveLength(
      48,
    );
  });

  it('creates a favicon icon with a normalized url', () => {
    const item = createQuickAddIcon('github.com', 'GitHub', '代码托管');
    expect(item).not.toBeNull();
    expect(item).toMatchObject({
      type: 'icon',
      name: '代码托管',
      url: 'https://github.com/',
      icon: { kind: 'favicon', value: '' },
    });
    expect(item?.id).toBeTruthy();
    expect(createQuickAddIcon('javascript:alert(1)', 'Bad')).toBeNull();
  });

  it('finds duplicates inside folders', () => {
    expect(findGroupIconByUrl(group, 'https://github.com')?.id).toBe('child-1');
    expect(findGroupIconByUrl(group, 'https://example.com')).toBeNull();
  });
});
