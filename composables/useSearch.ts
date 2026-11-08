import type { SearchEngine, SearchResult } from '../shared/types';

const ENGINE_ALIASES: Record<string, string> = {
  b: 'baidu',
  bd: 'baidu',
  g: 'google',
  bing: 'bing',
  ddg: 'duckduckgo',
};

export function isLikelyUrl(input: string): boolean {
  const value = input.trim();
  if (!value || /\s/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?(?:[/?#].*)?$/i.test(value)) {
    return true;
  }
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?(?:[/?#].*)?$/i.test(
    value,
  );
}

export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?/i.test(value)) {
    return `http://${value}`;
  }
  return `https://${value}`;
}

export function buildSearchUrl(engine: SearchEngine, query: string): string {
  const encoded = encodeURIComponent(query.trim());
  if (!engine.urlTemplate.includes('%s')) {
    return `${engine.urlTemplate}${encoded}`;
  }
  return engine.urlTemplate.replace(/%s/g, encoded);
}

export function resolveSearch(
  input: string,
  engines: SearchEngine[],
  engineId: string,
): SearchResult {
  const value = input.trim();
  if (!value) return { kind: 'none' };

  if (isLikelyUrl(value)) {
    return { kind: 'url', url: normalizeUrl(value) };
  }

  const prefixed = value.match(/^(\S+)\s+(.+)$/s);
  if (prefixed) {
    const prefix = prefixed[1]!.toLowerCase();
    const targetId = ENGINE_ALIASES[prefix] ?? prefix;
    const engine = engines.find((item) => item.id === targetId);
    const query = prefixed[2]!.trim();
    if (engine && query) return { kind: 'engine', engine, query };
  }

  const engine = engines.find((item) => item.id === engineId) ?? engines[0];
  if (!engine) return { kind: 'none' };
  return { kind: 'engine', engine, query: value };
}
