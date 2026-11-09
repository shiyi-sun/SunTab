import { describe, expect, it } from 'vitest';
import {
  maskHasTransparency,
  planRasterMark,
  type AlphaMask,
} from '../shared/brandRaster';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function makeMask(width: number, height: number, rects: Rect[]): AlphaMask {
  const alpha = new Uint8Array(width * height);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        alpha[y * width + x] = 255;
      }
    }
  }
  return { width, height, alpha };
}

const MARK = { x: 10, y: 28, width: 72, height: 64 };
const TEXT = { x: 100, y: 20, width: 130, height: 100 };

describe('brand raster mark planning', () => {
  it('keeps a square or tight logo whole after trimming transparent edges', () => {
    const mask = makeMask(120, 120, [
      { x: 20, y: 20, width: 80, height: 80 },
    ]);
    expect(planRasterMark(mask)).toEqual({
      kind: 'whole',
      box: { x: 20, y: 20, width: 80, height: 80 },
    });
  });

  it('crops a left mark out of a wide lockup', () => {
    const mask = makeMask(240, 120, [MARK, TEXT]);
    expect(planRasterMark(mask)).toEqual({ kind: 'mark', box: MARK });
  });

  it('crops a right mark when the wordmark sits on the left', () => {
    const mask = makeMask(240, 120, [
      { x: 10, y: 20, width: 130, height: 100 },
      { x: 158, y: 28, width: 72, height: 64 },
    ]);
    expect(planRasterMark(mask)).toEqual({
      kind: 'mark',
      box: { x: 158, y: 28, width: 72, height: 64 },
    });
  });

  it('falls back to the whole image instead of cropping a letter', () => {
    const mask = makeMask(240, 120, [
      { x: 10, y: 10, width: 70, height: 100 },
      { x: 100, y: 10, width: 60, height: 100 },
      { x: 180, y: 10, width: 50, height: 100 },
    ]);
    expect(planRasterMark(mask)).toEqual({
      kind: 'whole',
      box: { x: 10, y: 10, width: 220, height: 100 },
    });
  });

  it('rejects very wide banners and blank images', () => {
    expect(
      planRasterMark(
        makeMask(400, 100, [{ x: 10, y: 30, width: 380, height: 40 }]),
      ),
    ).toEqual({ kind: 'reject' });
    expect(planRasterMark(makeMask(50, 50, []))).toEqual({ kind: 'reject' });
  });

  it('detects whether the source has an alpha channel in use', () => {
    expect(
      maskHasTransparency(makeMask(20, 20, [{ x: 0, y: 0, width: 20, height: 20 }])),
    ).toBe(false);
    const transparent = makeMask(20, 20, [
      { x: 0, y: 0, width: 20, height: 20 },
    ]);
    transparent.alpha[0] = 0;
    expect(maskHasTransparency(transparent)).toBe(true);
  });
});
