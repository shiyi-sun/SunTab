export interface AlphaMask {
  width: number;
  height: number;
  alpha: Uint8Array;
}

export interface RasterBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RasterMarkPlan =
  | { kind: 'whole'; box: RasterBox }
  | { kind: 'mark'; box: RasterBox }
  | { kind: 'reject' };

const ALPHA_THRESHOLD = 24;
const WHOLE_MAX_ASPECT = 1.6;
const SOURCE_MAX_ASPECT = 2.5;
const MARK_MIN_ASPECT = 0.6;
const MARK_MAX_ASPECT = 1.6;
const MARK_MIN_HEIGHT_RATIO = 0.45;
const MARK_MAX_HEIGHT_VS_REST = 0.85;
const MARK_MIN_WIDTH_RATIO = 0.18;
const MARK_MAX_WIDTH_RATIO = 0.78;
const REST_MIN_WIDTH_RATIO = 1.2;
const VALLEY_MAX_RATIO = 0.35;

function alphaAt(mask: AlphaMask, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return 0;
  return mask.alpha[y * mask.width + x] ?? 0;
}

function trimBounds(mask: AlphaMask): RasterBox | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (alphaAt(mask, x, y) <= ALPHA_THRESHOLD) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function boundsInColumns(
  mask: AlphaMask,
  region: RasterBox,
  start: number,
  end: number,
): RasterBox | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let offset = start; offset <= end; offset += 1) {
    const x = region.x + offset;
    for (let y = region.y; y < region.y + region.height; y += 1) {
      if (alphaAt(mask, x, y) <= ALPHA_THRESHOLD) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

function columnWeights(mask: AlphaMask, region: RasterBox): Float64Array {
  const weights = new Float64Array(region.width);
  for (let offset = 0; offset < region.width; offset += 1) {
    let weight = 0;
    for (let y = region.y; y < region.y + region.height; y += 1) {
      weight += alphaAt(mask, region.x + offset, y) / 255;
    }
    weights[offset] = weight;
  }
  return weights;
}

function deepestValley(weights: Float64Array): number | null {
  if (weights.length < 8) return null;
  const start = Math.max(1, Math.floor(weights.length * 0.15));
  const end = Math.min(weights.length - 2, Math.ceil(weights.length * 0.85) - 1);
  let index = -1;
  let value = Infinity;
  for (let offset = start; offset <= end; offset += 1) {
    if (weights[offset]! < value) {
      value = weights[offset]!;
      index = offset;
    }
  }
  if (index < 0) return null;

  let left = 0;
  for (let offset = 0; offset < index; offset += 1) {
    left = Math.max(left, weights[offset]!);
  }
  let right = 0;
  for (let offset = index + 1; offset < weights.length; offset += 1) {
    right = Math.max(right, weights[offset]!);
  }
  if (left <= 0 || right <= 0) return null;
  return value <= Math.min(left, right) * VALLEY_MAX_RATIO ? index : null;
}

function scoreMark(
  mark: RasterBox,
  rest: RasterBox,
  whole: RasterBox,
): number | null {
  const aspect = mark.width / mark.height;
  if (aspect < MARK_MIN_ASPECT || aspect > MARK_MAX_ASPECT) return null;
  if (mark.height < whole.height * MARK_MIN_HEIGHT_RATIO) return null;
  if (mark.height > rest.height * MARK_MAX_HEIGHT_VS_REST) return null;
  if (mark.width < whole.width * MARK_MIN_WIDTH_RATIO) return null;
  if (mark.width > whole.width * MARK_MAX_WIDTH_RATIO) return null;
  if (rest.width < mark.width * REST_MIN_WIDTH_RATIO) return null;

  const squareScore = 1 - Math.min(1, Math.abs(1 - aspect) / 0.6);
  const heightScore = Math.min(1, mark.height / whole.height);
  const widthScore = Math.min(1, mark.width / whole.width / 0.5);
  return squareScore + heightScore + widthScore * 0.4;
}

/**
 * Splits a wide raster lockup by its quietest column. A separate mark is
 * preferred only when it is shorter than the text block; that guard keeps a
 * single glyph inside a wordmark from being mistaken for a logo mark.
 */
export function planRasterMark(mask: AlphaMask): RasterMarkPlan {
  const whole = trimBounds(mask);
  if (!whole) return { kind: 'reject' };
  const aspect = whole.width / whole.height;
  if (aspect <= WHOLE_MAX_ASPECT) return { kind: 'whole', box: whole };
  if (aspect > SOURCE_MAX_ASPECT) return { kind: 'reject' };

  const split = deepestValley(columnWeights(mask, whole));
  if (split !== null) {
    const left = boundsInColumns(mask, whole, 0, split - 1);
    const right = boundsInColumns(mask, whole, split + 1, whole.width - 1);
    if (left && right) {
      let best: { box: RasterBox; score: number } | null = null;
      const leftScore = scoreMark(left, right, whole);
      if (leftScore !== null) best = { box: left, score: leftScore };
      const rightScore = scoreMark(right, left, whole);
      if (rightScore !== null && (!best || rightScore > best.score)) {
        best = { box: right, score: rightScore };
      }
      if (best) return { kind: 'mark', box: best.box };
    }
  }

  return { kind: 'whole', box: whole };
}

export function maskHasTransparency(mask: AlphaMask): boolean {
  for (let index = 0; index < mask.alpha.length; index += 1) {
    if (mask.alpha[index]! < 250) return true;
  }
  return false;
}
