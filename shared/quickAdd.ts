import { clampName, findIconByUrl, normalizeHttpUrl } from './nav';
import type { IconItem, NavGroup } from './types';

const INTERNAL_PAGE = /^(chrome|edge|about|devtools|chrome-extension|moz-extension|extension):/i;

export interface QuickAddTab {
  url?: string;
  title?: string;
}

export function isQuickAddableUrl(value: string | null | undefined): boolean {
  if (!value || INTERNAL_PAGE.test(value)) return false;
  return Boolean(normalizeHttpUrl(value));
}

export function quickAddName(title: string | null | undefined, url: string): string {
  const fromTitle = clampName(title ?? '');
  if (fromTitle) return fromTitle;
  const normalized = normalizeHttpUrl(url);
  if (!normalized) return '';
  try {
    return new URL(normalized).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function findGroupIconByUrl(group: NavGroup, url: string): IconItem | null {
  const icons = group.items.flatMap((item) =>
    item.type === 'icon' ? [item] : item.children,
  );
  return findIconByUrl(icons, url);
}

export function createQuickAddIcon(
  url: string,
  title: string | null | undefined,
  name?: string,
): IconItem | null {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) return null;
  return {
    id: crypto.randomUUID(),
    type: 'icon',
    name: clampName(name ?? '') || quickAddName(title, normalized) || '未命名图标',
    url: normalized,
    icon: { kind: 'favicon', value: '' },
  };
}
