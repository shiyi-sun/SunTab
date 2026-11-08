export type IconKind = 'favicon' | 'upload' | 'text' | 'url';

export interface IconSpec {
  kind: IconKind;
  value: string;
  bg?: string;
}

export interface IconItem {
  id: string;
  type: 'icon';
  name: string;
  url: string;
  icon: IconSpec;
}

export interface FolderItem {
  id: string;
  type: 'folder';
  name: string;
  children: IconItem[];
}

export type NavItem = IconItem | FolderItem;

export type IconDraft = Pick<IconItem, 'name' | 'url' | 'icon'>;

export interface NavGroup {
  id: string;
  name: string;
  icon: string;
  items: NavItem[];
}

export interface SearchEngine {
  id: string;
  name: string;
  urlTemplate: string;
  icon?: string;
}

export type ThemeMode = 'auto' | 'light' | 'dark';

export type WallpaperKind = 'gradient' | 'color' | 'upload' | 'bing';

export interface AppConfig {
  schemaVersion: 1;
  theme: {
    mode: ThemeMode;
    accent: string;
  };
  wallpaper: {
    kind: WallpaperKind;
    value: string;
    blur: number;
    dim: number;
  };
  clock: {
    show: boolean;
    hour12: boolean;
    seconds: boolean;
    lunar: boolean;
    size: number;
    color: string;
    font?: string;
  };
  search: {
    show: boolean;
    engines: SearchEngine[];
    engineId: string;
    openInNewTab: boolean;
  };
  icon: {
    size: number;
    gap: number;
    radius: number;
    showLabel: boolean;
    labelSize: number;
    labelColor: string;
    maxWidth: number;
  };
  sidebar: {
    side: 'left' | 'right';
    width: number;
    autoHide: boolean;
    opacity: number;
  };
  layout: {
    mode: 'widgets' | 'minimal';
    showQuote: boolean;
  };
}

export interface BackupIconFile {
  id: string;
  type: string;
  dataUrl: string;
  createdAt?: number;
}

export interface SunTabBackup {
  app: 'SunTab';
  schemaVersion: 1;
  exportedAt: string;
  config: AppConfig;
  nav: NavGroup[];
  icons?: BackupIconFile[];
  iconsIncluded?: boolean;
  wallpapersIncluded?: boolean;
}

export type SearchResult =
  | { kind: 'url'; url: string }
  | { kind: 'engine'; engine: SearchEngine; query: string }
  | { kind: 'local'; item: NavItem }
  | { kind: 'none' };
