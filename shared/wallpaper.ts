import { LIGHT_GRADIENT_VALUES } from './defaults';
import type { WallpaperKind } from './types';

function colorLuminance(value: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1]!;
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;
  const channels = [0, 2, 4].map((offset) =>
    parseInt(expanded.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

export function isLightWallpaper(wallpaper: {
  kind: WallpaperKind;
  value: string;
}): boolean {
  if (wallpaper.kind === 'gradient') {
    return LIGHT_GRADIENT_VALUES.has(wallpaper.value);
  }
  if (wallpaper.kind === 'color') {
    const luminance = colorLuminance(wallpaper.value);
    return luminance !== null && luminance > 0.5;
  }
  return false;
}
