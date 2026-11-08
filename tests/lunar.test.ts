import { describe, expect, it } from 'vitest';
import { Solar } from 'lunar-typescript';
import { getLunarInfo } from '../composables/useLunar';

function expectedLunar(year: number, month: number, day: number) {
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  return {
    lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    solarTerm: lunar.getJieQi() || '',
  };
}

describe('lunar info', () => {
  it('returns the lunar date and solar term for 2026-11-07', () => {
    const info = getLunarInfo(new Date(2026, 10, 7, 9, 0, 0));
    expect(info.lunar).toBe('九月廿九');
    expect(info.solarTerm).toBe('立冬');
  });

  it('matches lunar-typescript across 2020-2030', () => {
    for (let year = 2020; year <= 2030; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const lastDay = new Date(year, month, 0).getDate();
        for (let day = 1; day <= lastDay; day += 1) {
          const actual = getLunarInfo(new Date(year, month - 1, day, 12, 0, 0));
          expect(actual, `${year}-${month}-${day}`).toEqual(
            expectedLunar(year, month, day),
          );
        }
      }
    }
  });

  it('covers the table boundaries', () => {
    expect(getLunarInfo(new Date(1900, 0, 31, 12))).toEqual(
      expectedLunar(1900, 1, 31),
    );
    expect(getLunarInfo(new Date(2100, 11, 31, 12))).toEqual(
      expectedLunar(2100, 12, 31),
    );
  });
});
