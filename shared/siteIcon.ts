import { DARK_ICON_BG } from './color';
import { analyzeIconVisibility, ensureImageDecodes } from './image';

const SVG_MIME = 'image/svg+xml';
const HTML_LIMIT = 1.5 * 1024 * 1024;
const MANIFEST_LIMIT = 512 * 1024;
const SVG_LIMIT = 1024 * 1024;
const DEFAULT_TIMEOUT = 6000;
const MAX_SVG_ATTEMPTS = 6;

export interface SiteSvgOptions {
  timeoutMs?: number;
}

export interface SiteSvgIcon {
  blob: Blob;
  background?: string;
}

interface ChromePermissionsApi {
  request(
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

function parseDocument(html: string): Document | null {
  try {
    return new DOMParser().parseFromString(html, 'text/html');
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
): Promise<Uint8Array | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const response = await fetch(url, {
      credentials: 'omit',
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
  const head = decode(bytes.subarray(0, 8192))
    .replace(/^\uFEFF/, '')
    .trimStart();
  if (!/<svg[\s>]/i.test(head)) return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: SVG_MIME });
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
): Promise<LoadedCandidate | null> {
  const blob = await fetchSvg(url, deadline);
  if (!blob) return null;
  const visibility = await analyzeIconVisibility(blob);
  if (visibility.blank || visibility.whiteSheet) return null;
  return { kind: visibility.whiteOnly ? 'white' : 'normal', blob };
}

export async function fetchSiteSvgIcon(
  pageUrl: string,
  options: SiteSvgOptions = {},
): Promise<SiteSvgIcon | null> {
  let target: URL;
  try {
    target = new URL(pageUrl);
  } catch {
    return null;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;

  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT);
  const htmlBytes = await fetchBytes(target.href, HTML_LIMIT, deadline);
  if (!htmlBytes) return null;
  const doc = parseDocument(decode(htmlBytes));
  if (!doc) return null;

  const groups = svgCandidatesFromDocument(doc, target.href);
  const whiteBackground = themeColorFromDocument(doc) ?? DARK_ICON_BG;
  let remaining = MAX_SVG_ATTEMPTS;
  let whiteFallback: SiteSvgIcon | null = null;

  const tryUrls = async (urls: string[]): Promise<SiteSvgIcon | null> => {
    for (const url of urls) {
      if (remaining <= 0) return null;
      remaining -= 1;
      const candidate = await loadCandidate(url, deadline);
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

  const primary = await tryUrls(groups.regular);
  if (primary) return primary;

  const manifestUrl = manifestUrlFromDocument(doc, target.href);
  if (manifestUrl) {
    const manifestBytes = await fetchBytes(manifestUrl, MANIFEST_LIMIT, deadline);
    if (manifestBytes) {
      const fromManifest = await tryUrls(
        parseManifestSvgIcons(decode(manifestBytes), manifestUrl),
      );
      if (fromManifest) return fromManifest;
    }
  }

  const fromMask = await tryUrls(groups.mask);
  if (fromMask) return fromMask;
  return whiteFallback;
}
