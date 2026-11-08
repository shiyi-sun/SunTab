export interface SvgBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SvgMarkHint = 'mark' | 'text' | 'neutral';

export interface SvgMarkNode extends SvgBox {
  isText: boolean;
  hint?: SvgMarkHint;
}

export type SvgMarkPlan =
  | { kind: 'mark'; box: SvgBox }
  | { kind: 'whole' }
  | { kind: 'reject' };

type Axis = 'x' | 'y';

function unionBox(nodes: SvgMarkNode[]): SvgBox {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const node of nodes) {
    left = Math.min(left, node.x);
    top = Math.min(top, node.y);
    right = Math.max(right, node.x + node.width);
    bottom = Math.max(bottom, node.y + node.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function gapThreshold(axis: Axis, all: SvgBox): number {
  return axis === 'x'
    ? Math.max(all.height * 0.12, all.width * 0.02)
    : Math.max(all.width * 0.12, all.height * 0.02);
}

interface Cluster {
  nodes: SvgMarkNode[];
  start: number;
  end: number;
}

function clusterAxis(
  nodes: SvgMarkNode[],
  axis: Axis,
  threshold: number,
): Cluster[] {
  const sorted = [...nodes].sort((a, b) =>
    axis === 'x' ? a.x - b.x : a.y - b.y,
  );
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;
  for (const node of sorted) {
    const start = axis === 'x' ? node.x : node.y;
    const end = axis === 'x' ? node.x + node.width : node.y + node.height;
    if (!current || start - current.end > threshold) {
      current = { nodes: [node], start, end };
      clusters.push(current);
    } else {
      current.nodes.push(node);
      current.end = Math.max(current.end, end);
    }
  }
  return clusters;
}

function scoreCandidate(
  markNodes: SvgMarkNode[],
  restNodes: SvgMarkNode[],
  all: SvgBox,
  axis: Axis,
  requireGap: boolean,
): number | null {
  if (!markNodes.length || !restNodes.length) return null;
  const mark = unionBox(markNodes);
  const rest = unionBox(restNodes);
  const aspect = mark.width / mark.height;
  if (aspect < 0.6 || aspect > 1.6) return null;

  const crossRatio =
    axis === 'x' ? mark.height / all.height : mark.width / all.width;
  if (crossRatio < 0.5) return null;
  const alongRatio =
    axis === 'x' ? mark.width / all.width : mark.height / all.height;
  if (alongRatio < 0.18) return null;

  const markStart = axis === 'x' ? mark.x : mark.y;
  const markEnd = axis === 'x' ? mark.x + mark.width : mark.y + mark.height;
  const restStart = axis === 'x' ? rest.x : rest.y;
  const restEnd = axis === 'x' ? rest.x + rest.width : rest.y + rest.height;
  const gap = Math.max(restStart - markEnd, markStart - restEnd);
  const threshold = gapThreshold(axis, all);
  if (requireGap && gap < threshold) return null;

  const textVotes = restNodes.filter(
    (node) => node.isText || node.hint === 'text',
  ).length;
  const restSingleMark =
    restNodes.length === 1 &&
    !textVotes &&
    rest.width / rest.height >= 0.6 &&
    rest.width / rest.height <= 1.6 &&
    rest.height >= mark.height * 0.6;
  if (restSingleMark) return null;

  const restLooksLikeText =
    textVotes > 0 ||
    restNodes.length >= 3 ||
    (axis === 'x'
      ? rest.width >= mark.width * 1.2
      : rest.width >= mark.width * 0.8);
  if (!restLooksLikeText) return null;
  if (restNodes.some((node) => node.hint === 'mark') && !textVotes) {
    return null;
  }

  const squareScore = 1 - Math.min(1, Math.abs(1 - aspect) / 0.6);
  const gapScore = Math.min(1, Math.max(0, gap) / Math.max(all.width, all.height));
  const textScore = textVotes > 0 ? 1 : restNodes.length >= 3 ? 0.8 : 0.5;
  const hintScore = markNodes.some((node) => node.hint === 'mark') ? 0.25 : 0;
  return squareScore + textScore + gapScore + hintScore;
}

export function planSvgMark(nodes: SvgMarkNode[]): SvgMarkPlan {
  const ink = nodes.filter(
    (node) => node.width >= 0.5 && node.height >= 0.5,
  );
  if (!ink.length) return { kind: 'reject' };

  const all = unionBox(ink);
  if (all.width <= 0 || all.height <= 0) return { kind: 'reject' };

  const candidates: Array<{ box: SvgBox; score: number }> = [];
  const axes: Axis[] = ['x', 'y'];
  for (const axis of axes) {
    const clusters = clusterAxis(ink, axis, gapThreshold(axis, all));
    if (clusters.length < 2) continue;
    const ends = [clusters[0]!, clusters[clusters.length - 1]!];
    for (const cluster of ends) {
      const rest = ink.filter((node) => !cluster.nodes.includes(node));
      const score = scoreCandidate(cluster.nodes, rest, all, axis, true);
      if (score !== null) {
        candidates.push({ box: unionBox(cluster.nodes), score });
      }
    }
  }

  const hintedMark = ink.filter((node) => node.hint === 'mark');
  if (hintedMark.length) {
    const rest = ink.filter((node) => !hintedMark.includes(node));
    if (rest.length) {
      const box = unionBox(hintedMark);
      const aspect = box.width / box.height;
      const textVotes = rest.filter(
        (node) => node.isText || node.hint === 'text',
      ).length;
      if (
        aspect >= 0.6 &&
        aspect <= 1.6 &&
        !rest.every((node) => node.hint === 'mark') &&
        (textVotes > 0 || rest.length >= 3)
      ) {
        candidates.push({
          box,
          score: 1 + (textVotes > 0 ? 1 : 0.8) + 0.3,
        });
      }
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0]!;
    if (best.score >= 1.5) return { kind: 'mark', box: best.box };
  }

  return all.width / all.height <= 1.6
    ? { kind: 'whole' }
    : { kind: 'reject' };
}

const DRAWABLE_SELECTOR =
  'path, rect, circle, ellipse, line, polyline, polygon, text, image, use';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function sanitizeSvg(svg: SVGSVGElement): void {
  for (const node of Array.from(
    svg.querySelectorAll('script, foreignObject, iframe, object, embed'),
  )) {
    node.remove();
  }
  for (const element of Array.from(svg.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      if (
        /^(href|xlink:href)$/i.test(attribute.name) &&
        /^\s*javascript:/i.test(attribute.value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function hintFor(node: Element): SvgMarkHint {
  if (node.tagName.toLowerCase() === 'text') return 'text';
  let current = node.parentElement;
  while (current && current.tagName.toLowerCase() !== 'svg') {
    const marker = [
      current.getAttribute('id'),
      current.getAttribute('class'),
      current.getAttribute('aria-label'),
      current.getAttribute('data-name'),
    ]
      .filter(Boolean)
      .join(' ');
    if (/wordmark|logotype|tagline|brand-?name|logo-?text/i.test(marker)) {
      return 'text';
    }
    if (
      /logo-?(mark|icon|symbol)|brand-?(mark|icon|symbol)|emblem/i.test(marker)
    ) {
      return 'mark';
    }
    current = current.parentElement;
  }
  return 'neutral';
}

function svgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const matrix = svg.getScreenCTM();
  if (matrix) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }
  const rect = svg.getBoundingClientRect();
  const viewBox = (svg.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [vx, vy, vw, vh] = viewBox;
  if (
    rect.width > 0 &&
    rect.height > 0 &&
    Number.isFinite(vx) &&
    Number.isFinite(vy) &&
    Number.isFinite(vw) &&
    Number.isFinite(vh)
  ) {
    return {
      x: vx! + ((clientX - rect.left) / rect.width) * vw!,
      y: vy! + ((clientY - rect.top) / rect.height) * vh!,
    };
  }
  return { x: clientX, y: clientY };
}

/**
 * Returns a standalone SVG for the brand mark. A mark separated from an
 * independent text block is cropped in any of the four directions; a square
 * or tight integrated logo is returned whole; a wide text-only wordmark is
 * rejected.
 */
export function prepareBrandSvg(svgText: string): string | null {
  if (!/<svg[\s>]/i.test(svgText)) return null;
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) return null;
  const svg = parsed.documentElement as unknown as SVGSVGElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') return null;
  sanitizeSvg(svg);

  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1000px;height:1000px;overflow:hidden;opacity:0;pointer-events:none;';
  document.body.appendChild(host);
  const clone = document.importNode(svg, true) as SVGSVGElement;
  host.appendChild(clone);

  try {
    clone.setAttribute('width', '1000');
    clone.removeAttribute('height');
    clone.style.width = '1000px';
    clone.style.height = 'auto';

    const entries = Array.from(clone.querySelectorAll(DRAWABLE_SELECTOR))
      .filter((node) => !node.closest('defs'))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width < 0.5 || rect.height < 0.5) return null;
        const topLeft = svgPoint(clone, rect.left, rect.top);
        const bottomRight = svgPoint(clone, rect.right, rect.bottom);
        const x = Math.min(topLeft.x, bottomRight.x);
        const y = Math.min(topLeft.y, bottomRight.y);
        return {
          node,
          x,
          y,
          width: Math.abs(bottomRight.x - topLeft.x),
          height: Math.abs(bottomRight.y - topLeft.y),
          isText: node.tagName.toLowerCase() === 'text',
          hint: hintFor(node),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (!entries.length || entries.length > 240) return null;
    const plan = planSvgMark(entries.map(({ node: _node, ...box }) => box));

    if (plan.kind === 'reject') return null;
    if (plan.kind === 'whole') {
      return new XMLSerializer().serializeToString(svg);
    }

    const { box } = plan;
    const intersects = (entry: (typeof entries)[number]) =>
      entry.x < box.x + box.width &&
      entry.x + entry.width > box.x &&
      entry.y < box.y + box.height &&
      entry.y + entry.height > box.y;
    for (const entry of entries) {
      if (!intersects(entry) && entry.hint !== 'mark') entry.node.remove();
    }

    const pad = Math.max(box.width, box.height) * 0.02;
    clone.setAttribute(
      'viewBox',
      `${round(box.x - pad)} ${round(box.y - pad)} ${round(
        box.width + pad * 2,
      )} ${round(box.height + pad * 2)}`,
    );
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.style.width = '';
    clone.style.height = '';
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    return new XMLSerializer().serializeToString(clone);
  } finally {
    host.remove();
  }
}
