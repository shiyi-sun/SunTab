import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultConfig } from '../shared/defaults';
import { migrateIconLayoutDefaults } from '../shared/storage';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

beforeEach(() => {
  storage.clear();
});

describe('icon layout defaults', () => {
  it('uses 50px tiles and a narrower grid by default', () => {
    const config = createDefaultConfig();
    expect(config.icon.size).toBe(50);
    expect(config.icon.maxWidth).toBe(800);
  });

  it('moves the old defaults exactly once', () => {
    const config = createDefaultConfig();
    config.icon.size = 60;
    config.icon.maxWidth = 1400;

    expect(migrateIconLayoutDefaults(config)).toBe(true);
    expect(config.icon.size).toBe(50);
    expect(config.icon.maxWidth).toBe(800);

    const chosenAgain = createDefaultConfig();
    chosenAgain.icon.size = 60;
    chosenAgain.icon.maxWidth = 1400;
    expect(migrateIconLayoutDefaults(chosenAgain)).toBe(false);
    expect(chosenAgain.icon.size).toBe(60);
    expect(chosenAgain.icon.maxWidth).toBe(1400);
  });

  it('leaves custom icon sizes and grid widths untouched', () => {
    const config = createDefaultConfig();
    config.icon.size = 72;
    config.icon.maxWidth = 1200;

    expect(migrateIconLayoutDefaults(config)).toBe(false);
    expect(config.icon.size).toBe(72);
    expect(config.icon.maxWidth).toBe(1200);
  });
});
