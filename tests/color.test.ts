import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ICON_BG,
  getIconColor,
  getIconInitial,
  hashString,
  ICON_BACKGROUND_PALETTE,
  TEXT_ICON_PALETTE,
  TRANSPARENT_ICON_BG,
} from '../shared/color';

describe('icon colors', () => {
  it('hashes strings deterministically', () => {
    expect(hashString('GitHub')).toBe(hashString('GitHub'));
    expect(hashString('GitHub')).not.toBe(hashString('知乎'));
    expect(hashString('')).toBe(5381);
  });

  it('maps names to a palette color', () => {
    expect(TEXT_ICON_PALETTE).toContain(getIconColor('GitHub'));
    expect(TEXT_ICON_PALETTE).toContain(getIconColor('知乎'));
    expect(getIconColor('GitHub')).toBe(getIconColor('GitHub'));
  });

  it('builds initials for latin and CJK names', () => {
    expect(getIconInitial('github')).toBe('G');
    expect(getIconInitial('  8bit')).toBe('8');
    expect(getIconInitial('知乎')).toBe('知乎');
    expect(getIconInitial('哔哩哔哩')).toBe('哔哩');
    expect(getIconInitial('   ')).toBe('?');
  });

  it('uses white as the default image backdrop and offers it in the palette', () => {
    expect(DEFAULT_ICON_BG).toBe('#ffffff');
    expect(ICON_BACKGROUND_PALETTE[0]).toBe('#ffffff');
    expect(ICON_BACKGROUND_PALETTE).toContain(DEFAULT_ICON_BG);
    expect(TRANSPARENT_ICON_BG).toBe('#00000000');
  });
});
