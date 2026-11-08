import Dexie, { type Table } from 'dexie';

export interface WallpaperRecord {
  id: string;
  kind: 'upload' | 'bing';
  name: string;
  createdAt: number;
  date?: string;
  width: number;
  height: number;
  full: Blob;
  thumb: Blob;
  copyright?: string;
}

export interface IconRecord {
  id: string;
  createdAt: number;
  blob: Blob;
}

class SunTabDatabase extends Dexie {
  wallpapers!: Table<WallpaperRecord, string>;
  icons!: Table<IconRecord, string>;

  constructor() {
    super('suntab');
    this.version(1).stores({
      wallpapers: 'id, kind, date, createdAt',
    });
    this.version(2).stores({
      wallpapers: 'id, kind, date, createdAt',
      icons: 'id, createdAt',
    });
  }
}

export const db = new SunTabDatabase();
