const TEXT_ICON_COLORS = [
  '#4c8dff',
  '#7c5cff',
  '#e05d8d',
  '#e07a5f',
  '#e0a23f',
  '#3fae7a',
  '#2fa6a0',
  '#3d7bd9',
  '#8a63d2',
  '#c25d5d',
  '#5b8a72',
  '#4f6d8f',
];

export const TEXT_ICON_PALETTE = TEXT_ICON_COLORS;

export const ICON_BACKGROUND_PALETTE = [
  '#ffffff',
  '#1681ff',
  '#0071c0',
  '#f9620e',
  '#9326e9',
  '#276ce6',
  '#ee3b3b',
  '#f01313',
  '#13ae67',
  '#2ecc71',
  '#33c5c5',
  '#9b59b6',
  '#f1c40f',
  '#e67e22',
  '#e74c3c',
  '#fbbe23',
  '#fc4548',
  '#4b3c36',
  '#7dac68',
  '#023373',
  '#c8ac70',
  '#372128',
  '#c82c34',
  '#054092',
  '#a3ddb9',
];

export const DEFAULT_ICON_BG = '#ffffff';
export const DARK_ICON_BG = '#1f1f1f';
export const TRANSPARENT_ICON_BG = '#00000000';

export function hashString(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return hash >>> 0;
}

export function getIconColor(name: string): string {
  return TEXT_ICON_COLORS[hashString(name) % TEXT_ICON_COLORS.length]!;
}

export function getIconInitial(name: string): string {
  const value = name.trim();
  if (!value) return '?';
  if (/^[a-zA-Z0-9]/.test(value)) return value[0]!.toUpperCase();
  return Array.from(value).slice(0, 2).join('');
}
