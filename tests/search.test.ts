import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  isLikelyUrl,
  normalizeUrl,
  resolveSearch,
} from '../composables/useSearch';
import { DEFAULT_ENGINES } from '../shared/defaults';

describe('search parser', () => {
  it('detects URLs and normalizes them', () => {
    expect(isLikelyUrl('https://github.com')).toBe(true);
    expect(isLikelyUrl('github.com')).toBe(true);
    expect(isLikelyUrl('localhost:3000')).toBe(true);
    expect(isLikelyUrl('天气')).toBe(false);
    expect(isLikelyUrl('hello world')).toBe(false);
    expect(normalizeUrl('github.com')).toBe('https://github.com');
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000');
  });

  it('uses the current engine for a plain query', () => {
    const result = resolveSearch('天气', DEFAULT_ENGINES, 'baidu');
    expect(result.kind).toBe('engine');
    if (result.kind === 'engine') {
      expect(result.engine.id).toBe('baidu');
      expect(result.query).toBe('天气');
    }
  });

  it('supports engine prefixes', () => {
    const result = resolveSearch('g 天气', DEFAULT_ENGINES, 'baidu');
    expect(result.kind).toBe('engine');
    if (result.kind === 'engine') {
      expect(result.engine.id).toBe('google');
      expect(result.query).toBe('天气');
    }
  });

  it('returns a direct URL without a scheme', () => {
    const result = resolveSearch('github.com', DEFAULT_ENGINES, 'baidu');
    expect(result).toEqual({ kind: 'url', url: 'https://github.com' });
  });

  it('encodes search terms into the engine template', () => {
    const engine = DEFAULT_ENGINES.find((item) => item.id === 'baidu')!;
    expect(buildSearchUrl(engine, '你好 & world')).toContain(
      'wd=%E4%BD%A0%E5%A5%BD%20%26%20world',
    );
  });
});
