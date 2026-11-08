import { describe, expect, it } from 'vitest';
import { createDefaultNav } from '../shared/defaults';
import { sanitizeNavGroups } from '../shared/storage';

describe('default navigation', () => {
  it('ships empty home and AI groups', () => {
    const groups = createDefaultNav();
    expect(groups.map((group) => group.name)).toEqual(['主页', 'AI']);
    expect(groups.map((group) => group.icon)).toEqual(['home', 'ai']);
    expect(groups[0]!.items).toEqual([]);
    expect(groups[1]!.items).toEqual([]);
  });

  it('keeps group ids unique and survives sanitization', () => {
    const groups = createDefaultNav();
    const ids = groups.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sanitizeNavGroups(groups)).toEqual(groups);
  });
});
