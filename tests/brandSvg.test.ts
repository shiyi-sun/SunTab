import { describe, expect, it } from 'vitest';
import {
  planSvgMark,
  type SvgMarkHint,
  type SvgMarkNode,
} from '../shared/brandSvg';

function node(
  x: number,
  y: number,
  width: number,
  height: number,
  isText = false,
  hint: SvgMarkHint = 'neutral',
): SvgMarkNode {
  return { x, y, width, height, isText, hint };
}

describe('brand SVG mark planning', () => {
  it('crops a left mark with right-side text', () => {
    const plan = planSvgMark([
      node(0, 0, 40, 40),
      node(52, 8, 68, 24, true),
    ]);
    expect(plan).toEqual({ kind: 'mark', box: { x: 0, y: 0, width: 40, height: 40 } });
  });

  it('crops a right mark with left-side text', () => {
    const plan = planSvgMark([
      node(0, 8, 68, 24, true),
      node(80, 0, 40, 40),
    ]);
    expect(plan).toEqual({
      kind: 'mark',
      box: { x: 80, y: 0, width: 40, height: 40 },
    });
  });

  it('crops a top mark with text below it', () => {
    const plan = planSvgMark([
      node(12, 0, 40, 40),
      node(14, 50, 36, 18, true),
    ]);
    expect(plan).toEqual({
      kind: 'mark',
      box: { x: 12, y: 0, width: 40, height: 40 },
    });
  });

  it('crops a bottom mark with text above it', () => {
    const plan = planSvgMark([
      node(14, 0, 36, 18, true),
      node(12, 50, 40, 40),
    ]);
    expect(plan).toEqual({
      kind: 'mark',
      box: { x: 12, y: 50, width: 40, height: 40 },
    });
  });

  it('cropping still works for outlined text with a clear gap', () => {
    const plan = planSvgMark([
      node(0, 0, 395, 393),
      node(447, 48, 961, 299),
      node(447, 50, 957, 295),
    ]);
    expect(plan.kind).toBe('mark');
    if (plan.kind === 'mark') {
      expect(plan.box).toEqual({ x: 0, y: 0, width: 395, height: 393 });
    }
  });

  it('keeps a square logo whole', () => {
    expect(planSvgMark([node(0, 0, 64, 64)]).kind).toBe('whole');
  });

  it('keeps a tight integrated mark + text whole', () => {
    const plan = planSvgMark([
      node(12, 0, 40, 40),
      node(14, 42, 36, 18, true),
    ]);
    expect(plan.kind).toBe('whole');
  });

  it('rejects a wide text-only wordmark', () => {
    const plan = planSvgMark([
      node(0, 5, 80, 30, true),
      node(84, 5, 40, 30, true),
      node(128, 5, 72, 30, true),
    ]);
    expect(plan.kind).toBe('reject');
  });

  it('rejects a wide lockup without a clear gap', () => {
    const plan = planSvgMark([
      node(0, 0, 40, 40),
      node(38, 8, 150, 24, true),
    ]);
    expect(plan.kind).toBe('reject');
  });

  it('does not treat two square shapes as a mark + text lockup', () => {
    const plan = planSvgMark([
      node(0, 0, 40, 40),
      node(60, 0, 40, 40),
    ]);
    expect(plan.kind).toBe('reject');
  });

  it('uses group hints to prefer a mark group with separated text', () => {
    const plan = planSvgMark([
      node(0, 0, 40, 40, false, 'mark'),
      node(52, 8, 68, 24, false, 'text'),
    ]);
    expect(plan).toEqual({
      kind: 'mark',
      box: { x: 0, y: 0, width: 40, height: 40 },
    });
  });
});
