import { describe, expect, it } from 'vitest';
import { pinyin } from 'pinyin-pro';
import {
  createLocalSearchIndex,
  searchLocalIcons,
  type PinyinConverter,
} from '../shared/localSearch';
import type { NavGroup } from '../shared/types';

const converter: PinyinConverter = (text) => ({
  full: pinyin(text, {
    toneType: 'none',
    nonZh: 'consecutive',
    type: 'array',
  }).join(''),
  initials: pinyin(text, {
    pattern: 'first',
    toneType: 'none',
    nonZh: 'consecutive',
    type: 'array',
  }).join(''),
});

function icon(id: string, name: string, url = `https://${id}.example`) {
  return {
    id,
    type: 'icon' as const,
    name,
    url,
    icon: { kind: 'favicon' as const, value: '' },
  };
}

const groups: NavGroup[] = [
  {
    id: 'g-main',
    name: '主页',
    icon: 'home',
    items: [
      icon('zhihu', '知乎', 'https://www.zhihu.com'),
      icon('github', 'GitHub', 'https://github.com'),
      icon('bilibili', '哔哩哔哩', 'https://www.bilibili.com'),
    ],
  },
  {
    id: 'g-tools',
    name: '工具',
    icon: 'folder',
    items: [
      {
        id: 'folder-1',
        type: 'folder',
        name: '网盘',
        children: [icon('pan', '百度网盘', 'https://pan.baidu.com')],
      },
    ],
  },
];

const index = createLocalSearchIndex(groups, converter);

describe('local icon search', () => {
  it('matches literal names including Chinese', () => {
    expect(searchLocalIcons(index, '知乎')[0]?.icon.id).toBe('zhihu');
    expect(searchLocalIcons(index, 'git')[0]?.icon.id).toBe('github');
    expect(searchLocalIcons(index, '哔哩')[0]?.icon.id).toBe('bilibili');
  });

  it('matches pinyin initials and full pinyin', () => {
    expect(searchLocalIcons(index, 'zh')[0]?.icon.id).toBe('zhihu');
    expect(searchLocalIcons(index, 'zhi')[0]?.icon.id).toBe('zhihu');
    expect(searchLocalIcons(index, 'zhihu')[0]?.icon.id).toBe('zhihu');
    expect(searchLocalIcons(index, 'blbl')[0]?.icon.id).toBe('bilibili');
    expect(searchLocalIcons(index, 'bilibili')[0]?.icon.id).toBe('bilibili');
  });

  it('searches folder children and keeps their location', () => {
    const hit = searchLocalIcons(index, 'wangpan')[0];
    expect(hit?.icon.id).toBe('pan');
    expect(hit?.groupName).toBe('工具');
    expect(hit?.folderName).toBe('网盘');
  });

  it('matches urls as a fallback', () => {
    expect(searchLocalIcons(index, 'github.com')[0]?.icon.id).toBe('github');
  });

  it('ranks name matches before pinyin and respects the limit', () => {
    const many = createLocalSearchIndex(
      [
        {
          ...groups[0]!,
          items: [
            icon('one', '知乎'),
            icon('two', '知了'),
            icon('three', '知识'),
          ],
        },
      ],
      converter,
    );
    expect(searchLocalIcons(many, '知', 2)).toHaveLength(2);
    expect(searchLocalIcons(many, 'zhihu', 6)[0]?.icon.id).toBe('one');
  });

  it('returns nothing for empty or unmatched queries', () => {
    expect(searchLocalIcons(index, '    ')).toEqual([]);
    expect(searchLocalIcons(index, 'not-found-anywhere')).toEqual([]);
  });

  it('still matches literal Chinese without the pinyin dictionary', () => {
    const plain = createLocalSearchIndex(groups);
    expect(searchLocalIcons(plain, '知乎')[0]?.icon.id).toBe('zhihu');
    expect(searchLocalIcons(plain, 'wangpan')).toEqual([]);
  });
});
