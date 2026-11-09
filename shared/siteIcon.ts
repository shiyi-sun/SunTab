import {
  maskHasTransparency,
  planRasterMark,
  type AlphaMask,
  type RasterBox,
} from './brandRaster';
import { prepareBrandSvg, sanitizeSvgText } from './brandSvg';
import { stripInlineHandlers } from './markup';
import { DARK_ICON_BG } from './color';
import { analyzeIconVisibility, ensureImageDecodes } from './image';

const SVG_MIME = 'image/svg+xml';
const HTML_LIMIT = 1.5 * 1024 * 1024;
const MANIFEST_LIMIT = 512 * 1024;
const SVG_LIMIT = 1024 * 1024;
const RASTER_LIMIT = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT = 6000;
const MAX_SVG_ATTEMPTS = 6;
const MAX_RASTER_ATTEMPTS = 6;
const MAX_BRAND_RASTER_ATTEMPTS = 3;
const MIN_RASTER_EDGE = 96;
const ICON_OUTPUT_SIZE = 128;
const MASK_MAX_SIDE = 256;

export interface SiteIconOptions {
  timeoutMs?: number;
  hints?: PageIconHints | null;
}

export interface SiteIcon {
  blob: Blob;
  background?: string;
}

export interface PageLinkHint {
  rel: string;
  type: string;
  sizes: string;
  href: string;
  media: string;
}

export interface PageBrandHint {
  src: string;
  className: string;
  id: string;
  alt: string;
  contextClass: string;
  contextId: string;
}

export interface PageIconHints {
  themeColor: string;
  links: PageLinkHint[];
  brandImages: PageBrandHint[];
}

interface ChromePermissionsApi {
  request(
    details: { origins: string[] },
    callback: (granted: boolean) => void,
  ): void;
  contains?(
    details: { origins: string[] },
    callback: (granted: boolean) => void,
  ): void;
}

const SITE_ORIGINS = ['https://*/*', 'http://*/*'];

function permissionsApi(): ChromePermissionsApi | undefined {
  return (
    globalThis as unknown as { chrome?: { permissions?: ChromePermissionsApi } }
  ).chrome?.permissions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveHttpUrl(value: string, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function parseColor(value: string): [number, number, number] | null {
  const text = value.trim().toLowerCase();
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    if (/^[0-9a-f]{3,8}$/.test(hex)) {
      if (hex.length === 3 || hex.length === 4) {
        return [0, 1, 2].map((index) =>
          parseInt(hex[index]! + hex[index]!, 16),
        ) as [number, number, number];
      }
      if (hex.length === 6 || hex.length === 8) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
      }
    }
    return null;
  }
  const match = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(text);
  if (!match) return null;
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
  return channels.some((channel) => channel > 255)
    ? null
    : (channels as [number, number, number]);
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function toHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function themeColorFromDocument(doc: Document): string | null {
  for (const meta of Array.from(
    doc.querySelectorAll('meta[name="theme-color"][content]'),
  )) {
    const rgb = parseColor(meta.getAttribute('content') ?? '');
    if (!rgb) continue;
    // Keep at least 3:1 contrast so white artwork stays readable.
    if (1.05 / (relativeLuminance(rgb) + 0.05) >= 3) return toHex(rgb);
  }
  return null;
}

export function extractThemeColor(html: string): string | null {
  const doc = parseDocument(html);
  return doc ? themeColorFromDocument(doc) : null;
}

export function requestSiteAccess(): Promise<boolean> {
  const api = permissionsApi();
  if (!api?.request) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      api.request({ origins: SITE_ORIGINS }, (granted) =>
        resolve(Boolean(granted)),
      );
    } catch {
      resolve(false);
    }
  });
}

export function hasSiteAccess(): Promise<boolean> {
  const api = permissionsApi();
  if (!api?.contains) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      api.contains!({ origins: SITE_ORIGINS }, (granted) =>
        resolve(Boolean(granted)),
      );
    } catch {
      resolve(false);
    }
  });
}

/**
 * Runs inside the active tab through chrome.scripting. It must stay
 * self-contained because Chrome serializes this function into the page.
 */
export function collectPageIconHints(): PageIconHints {
  const absolute = (value: string | null): string => {
    if (!value) return '';
    try {
      const url = new URL(value, document.baseURI);
      return url.protocol === 'http:' || url.protocol === 'https:'
        ? url.href
        : '';
    } catch {
      return '';
    }
  };

  const links: PageLinkHint[] = [];
  for (const link of Array.from(document.querySelectorAll('link[rel]'))) {
    const rel = (link.getAttribute('rel') ?? '').toLowerCase();
    if (!/icon|manifest/.test(rel)) continue;
    const href = absolute(link.getAttribute('href'));
    if (!href) continue;
    links.push({
      rel,
      type: (link.getAttribute('type') ?? '').toLowerCase(),
      sizes: link.getAttribute('sizes') ?? '',
      href,
      media: link.getAttribute('media') ?? '',
    });
  }

  const brandImages: PageBrandHint[] = [];
  for (const image of Array.from(document.querySelectorAll('img'))) {
    const raw =
      image.getAttribute('src') || image.getAttribute('data-src') || '';
    if (!/\.(?:svg|png|webp)(?:[?#]|$)/i.test(raw)) continue;
    const context = image.closest(
      'header, nav, a, [class*="logo" i], [class*="brand" i]',
    );
    if (!context) continue;
    const marker = [
      raw,
      image.getAttribute('class'),
      image.getAttribute('id'),
      image.getAttribute('alt'),
      context.getAttribute('class'),
      context.getAttribute('id'),
    ]
      .filter(Boolean)
      .join(' ');
    if (!/logo|brand|标志|商标/i.test(marker)) continue;
    const src = absolute(raw);
    if (!src) continue;
    brandImages.push({
      src,
      className: image.getAttribute('class') ?? '',
      id: image.getAttribute('id') ?? '',
      alt: image.getAttribute('alt') ?? '',
      contextClass: context.getAttribute('class') ?? '',
      contextId: context.getAttribute('id') ?? '',
    });
    if (brandImages.length >= 6) break;
  }

  return {
    themeColor:
      document
        .querySelector('meta[name="theme-color"][content]')
        ?.getAttribute('content') ?? '',
    links,
    brandImages,
  };
}

export function documentFromHints(
  hints: PageIconHints,
  pageUrl: string,
): Document {
  const doc = document.implementation.createHTMLDocument('');
  const base = doc.createElement('base');
  base.setAttribute('href', pageUrl);
  doc.head.appendChild(base);

  if (hints.themeColor) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', hints.themeColor);
    doc.head.appendChild(meta);
  }

  for (const hint of hints.links) {
    const link = doc.createElement('link');
    for (const [name, value] of Object.entries({
      rel: hint.rel,
      type: hint.type,
      sizes: hint.sizes,
      href: hint.href,
      media: hint.media,
    })) {
      if (value) link.setAttribute(name, value);
    }
    doc.head.appendChild(link);
  }

  const header = doc.createElement('header');
  doc.body.appendChild(header);
  for (const hint of hints.brandImages) {
    const anchor = doc.createElement('a');
    if (hint.contextClass) anchor.setAttribute('class', hint.contextClass);
    if (hint.contextId) anchor.setAttribute('id', hint.contextId);
    const image = doc.createElement('img');
    image.setAttribute('src', hint.src);
    if (hint.className) image.setAttribute('class', hint.className);
    if (hint.id) image.setAttribute('id', hint.id);
    if (hint.alt) image.setAttribute('alt', hint.alt);
    anchor.appendChild(image);
    header.appendChild(anchor);
  }
  return doc;
}

function parseDocument(html: string): Document | null {
  try {
    return new DOMParser().parseFromString(
      stripInlineHandlers(html),
      'text/html',
    );
  } catch {
    return null;
  }
}

function documentBase(doc: Document, pageUrl: string): string {
  const href = doc.querySelector('base[href]')?.getAttribute('href') ?? '';
  return resolveHttpUrl(href, pageUrl) ?? pageUrl;
}

interface SvgCandidateGroups {
  regular: string[];
  mask: string[];
}

function isDarkMedia(media: string | null): boolean {
  return Boolean(media && /prefers-color-scheme\s*:\s*dark/i.test(media));
}

function svgCandidatesFromDocument(
  doc: Document,
  pageUrl: string,
): SvgCandidateGroups {
  const base = documentBase(doc, pageUrl);
  const light: string[] = [];
  const dark: string[] = [];
  const mask: string[] = [];
  for (const link of Array.from(doc.querySelectorAll('link[href]'))) {
    const rel = (link.getAttribute('rel') ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const type = (link.getAttribute('type') ?? '').toLowerCase();
    const href = link.getAttribute('href') ?? '';
    const isMaskIcon = rel.includes('mask-icon');
    if (!isMaskIcon && !rel.includes('icon')) continue;
    const looksSvg =
      isMaskIcon || type.includes('svg') || /\.svg(?:[?#]|$)/i.test(href);
    if (!looksSvg) continue;
    const resolved = resolveHttpUrl(href, base);
    if (!resolved) continue;
    if (isMaskIcon) {
      mask.push(resolved);
    } else if (isDarkMedia(link.getAttribute('media'))) {
      dark.push(resolved);
    } else {
      light.push(resolved);
    }
  }
  const regular = [...new Set([...light, ...dark])];
  return {
    regular,
    mask: [...new Set(mask)].filter((url) => !regular.includes(url)),
  };
}

function manifestUrlFromDocument(doc: Document, pageUrl: string): string | null {
  const href =
    doc.querySelector('link[rel~="manifest"][href]')?.getAttribute('href') ?? '';
  return resolveHttpUrl(href, documentBase(doc, pageUrl));
}

function brandSvgCandidatesFromDocument(
  doc: Document,
  pageUrl: string,
): string[] {
  const base = documentBase(doc, pageUrl);
  const urls: string[] = [];
  for (const image of Array.from(doc.querySelectorAll('img[src], img[data-src]'))) {
    const raw = image.getAttribute('src') || image.getAttribute('data-src') || '';
    if (!/\.svg(?:[?#]|$)/i.test(raw)) continue;
    const context = image.closest(
      'header, nav, a, [class*="logo" i], [class*="brand" i]',
    );
    if (!context) continue;
    const marker = [
      raw,
      image.getAttribute('class'),
      image.getAttribute('id'),
      image.getAttribute('alt'),
      context.getAttribute('class'),
      context.getAttribute('id'),
    ]
      .filter(Boolean)
      .join(' ');
    const looksLikeBrand = /logo|brand|标志|商标/i.test(marker);
    if (!looksLikeBrand) continue;
    const resolved = resolveHttpUrl(raw, base);
    if (!resolved) continue;
    urls.push(resolved);
    if (urls.length >= 4) break;
  }
  return [...new Set(urls)];
}

export function extractSvgIconCandidates(html: string, pageUrl: string): string[] {
  const doc = parseDocument(html);
  if (!doc) return [];
  const groups = svgCandidatesFromDocument(doc, pageUrl);
  return [...groups.regular, ...groups.mask];
}

export function extractManifestUrl(html: string, pageUrl: string): string | null {
  const doc = parseDocument(html);
  return doc ? manifestUrlFromDocument(doc, pageUrl) : null;
}

export function parseManifestSvgIcons(json: string, manifestUrl: string): string[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!isRecord(data) || !Array.isArray(data.icons)) return [];
  const found: string[] = [];
  for (const icon of data.icons) {
    if (!isRecord(icon)) continue;
    const src = typeof icon.src === 'string' ? icon.src : '';
    const type = typeof icon.type === 'string' ? icon.type.toLowerCase() : '';
    if (!src) continue;
    if (!type.includes('svg') && !/\.svg(?:[?#]|$)/i.test(src)) continue;
    const resolved = resolveHttpUrl(src, manifestUrl);
    if (resolved) found.push(resolved);
  }
  return [...new Set(found)];
}

function parseSizes(value: string | null | undefined): number {
  if (!value) return 0;
  let best = 0;
  for (const match of value.matchAll(/(\d+)\s*[xX]\s*(\d+)/g)) {
    best = Math.max(best, Math.min(Number(match[1]), Number(match[2])));
  }
  return best;
}

function isRasterHref(href: string, type: string): boolean {
  if (!href) return false;
  if (type.includes('svg') || /\.svg(?:[?#]|$)/i.test(href)) return false;
  if (/\.ico(?:[?#]|$)/i.test(href)) return false;
  if (type.includes('png') || type.includes('webp')) return true;
  return !type && /\.(?:png|webp)(?:[?#]|$)/i.test(href);
}

function sortedSizedUrls(found: Map<string, number>): string[] {
  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);
}

function rasterCandidatesFromDocument(
  doc: Document,
  pageUrl: string,
): string[] {
  const base = documentBase(doc, pageUrl);
  const found = new Map<string, number>();
  for (const link of Array.from(doc.querySelectorAll('link[href]'))) {
    const rel = (link.getAttribute('rel') ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (rel.includes('mask-icon')) continue;
    const isApple =
      rel.includes('apple-touch-icon') ||
      rel.includes('apple-touch-icon-precomposed');
    if (!isApple && !rel.includes('icon')) continue;
    const type = (link.getAttribute('type') ?? '').toLowerCase();
    const href = link.getAttribute('href') ?? '';
    if (!isRasterHref(href, type)) continue;
    const resolved = resolveHttpUrl(href, base);
    if (!resolved) continue;
    const declared = parseSizes(link.getAttribute('sizes'));
    const size = declared || (isApple ? 180 : 0);
    const previous = found.get(resolved);
    if (previous === undefined || size > previous) found.set(resolved, size);
  }
  return sortedSizedUrls(found);
}

export function extractRasterIconCandidates(
  html: string,
  pageUrl: string,
): string[] {
  const doc = parseDocument(html);
  return doc ? rasterCandidatesFromDocument(doc, pageUrl) : [];
}

export function parseManifestRasterIcons(
  json: string,
  manifestUrl: string,
): string[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!isRecord(data) || !Array.isArray(data.icons)) return [];
  const found = new Map<string, number>();
  for (const icon of data.icons) {
    if (!isRecord(icon)) continue;
    const src = typeof icon.src === 'string' ? icon.src : '';
    const type = typeof icon.type === 'string' ? icon.type.toLowerCase() : '';
    if (!isRasterHref(src, type)) continue;
    const declared = parseSizes(
      typeof icon.sizes === 'string' ? icon.sizes : '',
    );
    if (declared && declared < MIN_RASTER_EDGE) continue;
    const resolved = resolveHttpUrl(src, manifestUrl);
    if (!resolved) continue;
    const previous = found.get(resolved);
    if (previous === undefined || declared > previous) {
      found.set(resolved, declared);
    }
  }
  return sortedSizedUrls(found);
}

function brandRasterCandidatesFromDocument(
  doc: Document,
  pageUrl: string,
): string[] {
  const base = documentBase(doc, pageUrl);
  const urls: string[] = [];
  for (const image of Array.from(doc.querySelectorAll('img[src], img[data-src]'))) {
    const raw =
      image.getAttribute('src') || image.getAttribute('data-src') || '';
    if (!/\.(?:png|webp)(?:[?#]|$)/i.test(raw)) continue;
    const context = image.closest(
      'header, nav, a, [class*="logo" i], [class*="brand" i]',
    );
    if (!context) continue;
    const marker = [
      raw,
      image.getAttribute('class'),
      image.getAttribute('id'),
      image.getAttribute('alt'),
      context.getAttribute('class'),
      context.getAttribute('id'),
    ]
      .filter(Boolean)
      .join(' ');
    if (!/logo|brand|标志|商标/i.test(marker)) continue;
    const resolved = resolveHttpUrl(raw, base);
    if (!resolved) continue;
    urls.push(resolved);
    if (urls.length >= 4) break;
  }
  return [...new Set(urls)];
}

export function extractBrandRasterCandidates(
  html: string,
  pageUrl: string,
): string[] {
  const doc = parseDocument(html);
  return doc ? brandRasterCandidatesFromDocument(doc, pageUrl) : [];
}

async function readLimited(
  response: Response,
  limit: number,
): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.byteLength > limit ? null : buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function fetchBytes(
  url: string,
  limit: number,
  deadline: number,
  credentials: RequestCredentials = 'omit',
): Promise<Uint8Array | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const response = await fetch(url, {
      credentials,
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await readLimited(response, limit);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

async function fetchSvg(url: string, deadline: number): Promise<Blob | null> {
  const bytes = await fetchBytes(url, SVG_LIMIT, deadline);
  if (!bytes) return null;
  const text = decode(bytes).replace(/^\uFEFF/, '');
  const sanitized = sanitizeSvgText(text);
  if (!sanitized) return null;
  const blob = new Blob([sanitized], { type: SVG_MIME });
  try {
    await ensureImageDecodes(blob);
  } catch {
    return null;
  }
  return blob;
}

type LoadedCandidate =
  | { kind: 'normal'; blob: Blob }
  | { kind: 'white'; blob: Blob };

async function loadCandidate(
  url: string,
  deadline: number,
  source: 'icon' | 'brand' = 'icon',
): Promise<LoadedCandidate | null> {
  let blob = await fetchSvg(url, deadline);
  if (!blob) return null;
  if (source === 'brand') {
    const prepared = prepareBrandSvg(await blob.text());
    if (!prepared) return null;
    blob = new Blob([prepared], { type: SVG_MIME });
    try {
      await ensureImageDecodes(blob);
    } catch {
      return null;
    }
  }
  const visibility = await analyzeIconVisibility(blob);
  if (visibility.blank || visibility.whiteSheet) return null;
  return { kind: visibility.whiteOnly ? 'white' : 'normal', blob };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function sniffRasterMime(bytes: Uint8Array): 'image/png' | 'image/webp' | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

async function fetchRasterBlob(
  url: string,
  deadline: number,
): Promise<Blob | null> {
  const bytes = await fetchBytes(url, RASTER_LIMIT, deadline);
  if (!bytes) return null;
  const mime = sniffRasterMime(bytes);
  if (!mime) return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mime });
}

function buildAlphaMask(bitmap: ImageBitmap): AlphaMask {
  const scale = Math.min(1, MASK_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { width, height, alpha: new Uint8Array(width * height) };
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = data[index * 4 + 3]!;
  }
  return { width, height, alpha };
}

function scaleRasterBox(
  box: RasterBox,
  mask: AlphaMask,
  bitmap: ImageBitmap,
): RasterBox {
  const scaleX = bitmap.width / mask.width;
  const scaleY = bitmap.height / mask.height;
  const pad = Math.max(box.width * scaleX, box.height * scaleY) * 0.02;
  const left = Math.max(0, Math.floor(box.x * scaleX - pad));
  const top = Math.max(0, Math.floor(box.y * scaleY - pad));
  const right = Math.min(
    bitmap.width,
    Math.ceil((box.x + box.width) * scaleX + pad),
  );
  const bottom = Math.min(
    bitmap.height,
    Math.ceil((box.y + box.height) * scaleY + pad),
  );
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

async function prepareRasterIcon(
  blob: Blob,
  mode: 'icon' | 'brand',
  whiteBackground: string,
): Promise<SiteIcon | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    if (bitmap.width < MIN_RASTER_EDGE || bitmap.height < MIN_RASTER_EDGE) {
      return null;
    }

    let crop: RasterBox = {
      x: 0,
      y: 0,
      width: bitmap.width,
      height: bitmap.height,
    };
    if (mode === 'brand') {
      let mask: AlphaMask;
      try {
        mask = buildAlphaMask(bitmap);
      } catch {
        return null;
      }
      const plan = planRasterMark(mask);
      if (plan.kind === 'reject') return null;
      if (
        plan.kind === 'whole' &&
        plan.box.width / plan.box.height > 1.6 &&
        !maskHasTransparency(mask)
      ) {
        return null;
      }
      crop = scaleRasterBox(plan.box, mask, bitmap);
    }

    const canvas = document.createElement('canvas');
    canvas.width = ICON_OUTPUT_SIZE;
    canvas.height = ICON_OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const scale = Math.min(
      ICON_OUTPUT_SIZE / crop.width,
      ICON_OUTPUT_SIZE / crop.height,
    );
    const drawWidth = Math.max(1, Math.round(crop.width * scale));
    const drawHeight = Math.max(1, Math.round(crop.height * scale));
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      Math.round((ICON_OUTPUT_SIZE - drawWidth) / 2),
      Math.round((ICON_OUTPUT_SIZE - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );

    const output =
      (await canvasToBlob(canvas, 'image/webp', 0.9)) ??
      (await canvasToBlob(canvas, 'image/png', 1));
    if (!output) return null;
    const visibility = await analyzeIconVisibility(output);
    if (visibility.blank || visibility.whiteSheet) return null;
    return {
      blob: output,
      ...(visibility.whiteOnly ? { background: whiteBackground } : {}),
    };
  } finally {
    bitmap.close();
  }
}

export async function fetchSiteIcon(
  pageUrl: string,
  options: SiteIconOptions = {},
): Promise<SiteIcon | null> {
  let target: URL;
  try {
    target = new URL(pageUrl);
  } catch {
    return null;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;

  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT);
  let doc: Document | null = null;
  if (options.hints) {
    try {
      doc = documentFromHints(options.hints, target.href);
    } catch {
      doc = null;
    }
  }
  if (!doc) {
    // Reuse the site's existing session so login-only pages still resolve.
    let htmlBytes = await fetchBytes(
      target.href,
      HTML_LIMIT,
      deadline,
      'include',
    );
    if (!htmlBytes && Date.now() < deadline) {
      htmlBytes = await fetchBytes(target.href, HTML_LIMIT, deadline);
    }
    if (!htmlBytes) return null;
    doc = parseDocument(decode(htmlBytes));
    if (!doc) return null;
  }

  const groups = svgCandidatesFromDocument(doc, target.href);
  const whiteBackground = themeColorFromDocument(doc) ?? DARK_ICON_BG;
  let remaining = MAX_SVG_ATTEMPTS;
  let whiteFallback: SiteIcon | null = null;

  const trySvgs = async (
    urls: string[],
    source: 'icon' | 'brand' = 'icon',
  ): Promise<SiteIcon | null> => {
    for (const url of urls) {
      if (remaining <= 0) return null;
      remaining -= 1;
      const candidate = await loadCandidate(url, deadline, source);
      if (!candidate) continue;
      if (candidate.kind === 'white') {
        whiteFallback ??= {
          blob: candidate.blob,
          background: whiteBackground,
        };
        continue;
      }
      return { blob: candidate.blob };
    }
    return null;
  };

  const tryRasters = async (
    urls: string[],
    mode: 'icon' | 'brand',
    limit: number,
  ): Promise<SiteIcon | null> => {
    let attempts = 0;
    for (const url of urls) {
      if (attempts >= limit || Date.now() >= deadline) return null;
      attempts += 1;
      const blob = await fetchRasterBlob(url, deadline);
      if (!blob) continue;
      const prepared = await prepareRasterIcon(blob, mode, whiteBackground);
      if (prepared) return prepared;
    }
    return null;
  };

  const primary = await trySvgs(groups.regular);
  if (primary) return primary;

  const manifestUrl = manifestUrlFromDocument(doc, target.href);
  let manifestRaster: string[] = [];
  if (manifestUrl) {
    const manifestBytes = await fetchBytes(manifestUrl, MANIFEST_LIMIT, deadline);
    if (manifestBytes) {
      const json = decode(manifestBytes);
      const fromManifest = await trySvgs(
        parseManifestSvgIcons(json, manifestUrl),
      );
      if (fromManifest) return fromManifest;
      manifestRaster = parseManifestRasterIcons(json, manifestUrl);
    }
  }

  const fromDeclaredRaster = await tryRasters(
    [...rasterCandidatesFromDocument(doc, target.href), ...manifestRaster],
    'icon',
    MAX_RASTER_ATTEMPTS,
  );
  if (fromDeclaredRaster) return fromDeclaredRaster;

  const fromBrandSvg = await trySvgs(
    brandSvgCandidatesFromDocument(doc, target.href),
    'brand',
  );
  if (fromBrandSvg) return fromBrandSvg;

  const fromBrandRaster = await tryRasters(
    brandRasterCandidatesFromDocument(doc, target.href),
    'brand',
    MAX_BRAND_RASTER_ATTEMPTS,
  );
  if (fromBrandRaster) return fromBrandRaster;

  const fromMask = await trySvgs(groups.mask);
  if (fromMask) return fromMask;
  return whiteFallback;
}
