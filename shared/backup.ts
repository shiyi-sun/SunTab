import { sanitizeNavGroups, mergeConfig } from './storage';
import { flattenIcons } from './nav';
import { blobToDataUrl } from './image';
import type { AppConfig, BackupIconFile, NavGroup, SunTabBackup } from './types';

const BACKUP_DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i;
const MAX_ICON_DATA_URL_LENGTH = 8 * 1024 * 1024;
const SAFE_BACKUP_ICON_ID = /^[A-Za-z0-9_-]{1,128}$/;

export interface BackupStats {
  groups: number;
  icons: number;
  folders: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function countNavItems(groups: NavGroup[]): BackupStats {
  let icons = 0;
  let folders = 0;
  for (const group of groups) {
    for (const item of group.items) {
      if (item.type === 'icon') {
        icons += 1;
      } else {
        folders += 1;
        icons += item.children.length;
      }
    }
  }
  return { groups: groups.length, icons, folders };
}

export function createBackup(
  config: AppConfig,
  nav: NavGroup[],
  iconFiles: BackupIconFile[] = [],
): SunTabBackup {
  const icons = sanitizeBackupIcons(iconFiles);
  return {
    app: 'SunTab',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    config,
    nav,
    icons: icons.length ? icons : undefined,
    iconsIncluded: icons.length > 0,
    wallpapersIncluded: false,
  };
}

export function collectUploadIconIds(groups: NavGroup[]): string[] {
  const ids = new Set<string>();
  for (const { item } of flattenIcons(groups)) {
    if (item.icon.kind === 'upload' && item.icon.value) ids.add(item.icon.value);
  }
  return [...ids];
}

export function filterBackupIconsForNav(
  files: BackupIconFile[],
  groups: NavGroup[],
): BackupIconFile[] {
  const ids = new Set(collectUploadIconIds(groups));
  return files.filter((file) => ids.has(file.id));
}

export function collectOrphanIconIds(
  records: Array<{ id: string }>,
  groups: NavGroup[],
): string[] {
  const ids = new Set(collectUploadIconIds(groups));
  return records.filter((record) => !ids.has(record.id)).map((record) => record.id);
}

export async function collectBackupIcons(groups: NavGroup[]): Promise<BackupIconFile[]> {
  const ids = new Set(collectUploadIconIds(groups));
  if (!ids.size) return [];
  const { listIconBlobs } = await import('./iconBlobs');
  const records = await listIconBlobs();
  const files: BackupIconFile[] = [];
  for (const record of records) {
    if (!ids.has(record.id)) continue;
    files.push({
      id: record.id,
      type: record.blob.type || 'image/webp',
      dataUrl: await blobToDataUrl(record.blob),
      createdAt: record.createdAt,
    });
  }
  return files;
}

export function sanitizeBackupIcons(value: unknown): BackupIconFile[] {
  if (!Array.isArray(value)) return [];
  const result: BackupIconFile[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl : '';
    if (!SAFE_BACKUP_ICON_ID.test(id) || seen.has(id)) continue;
    if (!dataUrl || dataUrl.length > MAX_ICON_DATA_URL_LENGTH) continue;
    const match = BACKUP_DATA_URL.exec(dataUrl);
    if (!match) continue;
    seen.add(id);
    result.push({
      id,
      type: match[1]!.toLowerCase(),
      dataUrl,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : undefined,
    });
  }
  return result;
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = BACKUP_DATA_URL.exec(dataUrl);
  if (!match) return null;
  try {
    const binary = atob(match[2]!);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: match[1]!.toLowerCase() });
  } catch {
    return null;
  }
}

export async function restoreBackupIcons(files: BackupIconFile[]): Promise<number> {
  const safeFiles = sanitizeBackupIcons(files);
  if (!safeFiles.length) return 0;
  const { putIconBlob } = await import('./iconBlobs');
  let restored = 0;
  for (const file of safeFiles) {
    const blob = dataUrlToBlob(file.dataUrl);
    if (!blob) continue;
    try {
      await putIconBlob(file.id, blob);
      restored += 1;
    } catch {
      // Keep the rest of the backup usable if one icon fails.
    }
  }
  return restored;
}

export function parseBackup(input: unknown):
  | { ok: true; data: SunTabBackup; stats: BackupStats }
  | { ok: false; error: string } {
  let value = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: false, error: '文件不是有效的 JSON' };
    }
  }
  if (!isRecord(value)) return { ok: false, error: '备份文件格式不正确' };
  if (value.app !== 'SunTab') return { ok: false, error: '这不是 SunTab 的备份文件' };
  if (value.schemaVersion !== 1) return { ok: false, error: '备份版本不受支持' };
  if (!isRecord(value.config) || !Array.isArray(value.nav)) {
    return { ok: false, error: '备份缺少配置或导航数据' };
  }

  const config = mergeConfig(value.config);
  const nav = sanitizeNavGroups(value.nav);
  const icons = sanitizeBackupIcons(value.icons);
  if (!nav.length) return { ok: false, error: '备份里没有可导入的分组' };

  return {
    ok: true,
    data: {
      app: 'SunTab',
      schemaVersion: 1,
      exportedAt:
        typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
      config,
      nav,
      icons: icons.length ? icons : undefined,
      iconsIncluded: icons.length > 0,
      wallpapersIncluded: false,
    },
    stats: countNavItems(nav),
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
