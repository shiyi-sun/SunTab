import type { IconItem, NavGroup } from './types';

export interface PinyinForms {
  full: string;
  initials: string;
}

export type PinyinConverter = (text: string) => PinyinForms;

export interface LocalSearchEntry {
  icon: IconItem;
  groupId: string;
  groupName: string;
  folderId?: string;
  folderName?: string;
}

export interface LocalSearchItem extends LocalSearchEntry {
  nameLower: string;
  urlLower: string;
  groupLower: string;
  pinyinFull: string;
  pinyinInitials: string;
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function collectSearchEntries(groups: NavGroup[]): LocalSearchEntry[] {
  const entries: LocalSearchEntry[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'icon') {
        entries.push({
          icon: item,
          groupId: group.id,
          groupName: group.name,
        });
      } else {
        for (const child of item.children) {
          entries.push({
            icon: child,
            groupId: group.id,
            groupName: group.name,
            folderId: item.id,
            folderName: item.name,
          });
        }
      }
    }
  }
  return entries;
}

export function createLocalSearchIndex(
  groups: NavGroup[],
  pinyinOf?: PinyinConverter,
): LocalSearchItem[] {
  return collectSearchEntries(groups).map((entry) => {
    const nameLower = normalizeText(entry.icon.name);
    let pinyinFull = compact(entry.icon.name);
    let pinyinInitials = pinyinFull;
    if (pinyinOf && CJK.test(entry.icon.name)) {
      try {
        const forms = pinyinOf(entry.icon.name);
        pinyinFull = compact(forms.full) || pinyinFull;
        pinyinInitials = compact(forms.initials) || pinyinInitials;
      } catch {
        // Keep name-only matching when pinyin conversion fails.
      }
    }
    return {
      ...entry,
      nameLower,
      urlLower: normalizeText(entry.icon.url.replace(/^https?:\/\//i, '')),
      groupLower: normalizeText(entry.groupName),
      pinyinFull,
      pinyinInitials,
    };
  });
}

function rankOf(item: LocalSearchItem, query: string): number {
  if (!query) return -1;
  if (item.nameLower.startsWith(query)) return 0;
  if (item.nameLower.includes(query)) return 1;
  if (item.pinyinInitials.startsWith(query)) return 2;
  if (item.pinyinInitials.includes(query)) return 3;
  if (item.pinyinFull.startsWith(query)) return 4;
  if (item.pinyinFull.includes(query)) return 5;
  if (item.urlLower.includes(query) || item.groupLower.includes(query)) return 6;
  return -1;
}

export function searchLocalIcons(
  index: LocalSearchItem[],
  query: string,
  limit = 6,
): LocalSearchItem[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const hits: Array<{ item: LocalSearchItem; rank: number }> = [];
  for (const item of index) {
    const rank = rankOf(item, normalized);
    if (rank >= 0) hits.push({ item, rank });
  }
  hits.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.item.icon.name.localeCompare(right.item.icon.name, 'zh-CN');
  });
  return hits.slice(0, limit).map((hit) => hit.item);
}

let converterPromise: Promise<PinyinConverter> | null = null;

export function loadPinyinConverter(): Promise<PinyinConverter> {
  converterPromise ??= import('pinyin-pro').then(({ pinyin }) => {
    return (text: string): PinyinForms => {
      const full = pinyin(text, {
        toneType: 'none',
        nonZh: 'consecutive',
        type: 'array',
      }).join('');
      const initials = pinyin(text, {
        pattern: 'first',
        toneType: 'none',
        nonZh: 'consecutive',
        type: 'array',
      }).join('');
      return { full, initials };
    };
  });
  return converterPromise;
}
