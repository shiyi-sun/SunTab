import type { IconItem, NavGroup, NavItem } from './types';

export function clampName(value: string, max = 48): string {
  return Array.from(value.trim()).slice(0, max).join('');
}

export function normalizeHttpUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeIconUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (value.startsWith('/')) return value;
  if (/^data:image\//i.test(value)) return value;
  return normalizeHttpUrl(value);
}

export function isSafeIconUrl(value: string): boolean {
  return value.startsWith('/') || /^data:image\//i.test(value) || /^https?:\/\//i.test(value);
}

export function isSafeTextColor(value: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(value);
}

export function findIconByUrl(
  items: NavItem[],
  url: string,
  excludeId?: string,
): IconItem | null {
  const normalized = (normalizeHttpUrl(url) ?? url).toLowerCase();
  for (const item of items) {
    if (item.type !== 'icon' || item.id === excludeId) continue;
    const itemUrl = (normalizeHttpUrl(item.url) ?? item.url).toLowerCase();
    if (itemUrl === normalized) return item;
  }
  return null;
}

export function flattenIcons(groups: NavGroup[]): Array<{ group: NavGroup; item: IconItem }> {
  const result: Array<{ group: NavGroup; item: IconItem }> = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'icon') {
        result.push({ group, item });
      } else {
        for (const child of item.children) {
          result.push({ group, item: child });
        }
      }
    }
  }
  return result;
}

export function countNavItems(groups: NavGroup[]): {
  groups: number;
  icons: number;
  folders: number;
  children: number;
} {
  let icons = 0;
  let folders = 0;
  let children = 0;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'icon') {
        icons += 1;
      } else {
        folders += 1;
        children += item.children.length;
      }
    }
  }
  return { groups: groups.length, icons, folders, children };
}
