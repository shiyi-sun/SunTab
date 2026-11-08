import {
  LUNAR_TERM_DAYS,
  LUNAR_TERM_END_YEAR,
  LUNAR_TERM_START_YEAR,
  LUNAR_YEAR_INFO,
} from './lunarTable';

export interface LunarInfo {
  lunar: string;
  solarTerm: string;
}

const TERM_NAMES = [
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
];

const TERM_MONTHS = [
  3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 1, 1, 2, 2, 3,
];

const MONTH_NAMES = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const LUNAR_START_YEAR = LUNAR_TERM_START_YEAR;
const LUNAR_BASE_UTC = Date.UTC(1900, 0, 31);
const DAY_MS = 86_400_000;

const TERM_INDEXES_BY_MONTH = new Map<number, number[]>();
TERM_MONTHS.forEach((month, index) => {
  const list = TERM_INDEXES_BY_MONTH.get(month) ?? [];
  list.push(index);
  TERM_INDEXES_BY_MONTH.set(month, list);
});

function decodeTermTable(): Uint8Array {
  const binary = atob(LUNAR_TERM_DAYS);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const TERM_DAYS = decodeTermTable();

function leapMonth(info: number): number {
  return info >> 13;
}

function monthDays(info: number, month: number): number {
  return info & (1 << (13 - month)) ? 30 : 29;
}

function leapMonthDays(info: number): number {
  if (!leapMonth(info)) return 0;
  return info & 1 ? 30 : 29;
}

function yearDays(info: number): number {
  let days = leapMonthDays(info);
  for (let month = 1; month <= 12; month += 1) {
    days += monthDays(info, month);
  }
  return days;
}

function chineseDay(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 10) return `初${DAY_DIGITS[day]}`;
  if (day < 20) return `十${DAY_DIGITS[day - 10]}`;
  return `廿${DAY_DIGITS[day - 20]}`;
}

function solarTermOf(date: Date): string {
  const year = date.getFullYear();
  if (year < LUNAR_TERM_START_YEAR || year > LUNAR_TERM_END_YEAR) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const offset = (year - LUNAR_TERM_START_YEAR) * TERM_NAMES.length;
  for (const index of TERM_INDEXES_BY_MONTH.get(month) ?? []) {
    if (TERM_DAYS[offset + index] === day) return TERM_NAMES[index]!;
  }
  return '';
}

function lunarDateOf(date: Date): string {
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  let offset = Math.round((current - LUNAR_BASE_UTC) / DAY_MS);
  if (offset < 0) return '';

  let year = LUNAR_START_YEAR;
  while (year <= LUNAR_TERM_END_YEAR) {
    const info = LUNAR_YEAR_INFO[year - LUNAR_START_YEAR]!;
    const days = yearDays(info);
    if (offset < days) break;
    offset -= days;
    year += 1;
  }
  if (year > LUNAR_TERM_END_YEAR) return '';

  const info = LUNAR_YEAR_INFO[year - LUNAR_START_YEAR]!;
  const leap = leapMonth(info);
  for (let month = 1; month <= 12; month += 1) {
    const days = monthDays(info, month);
    if (offset < days) {
      return `${MONTH_NAMES[month]}月${chineseDay(offset + 1)}`;
    }
    offset -= days;
    if (leap === month) {
      const leapDays = leapMonthDays(info);
      if (offset < leapDays) {
        return `闰${MONTH_NAMES[month]}月${chineseDay(offset + 1)}`;
      }
      offset -= leapDays;
    }
  }
  return '';
}

export function getLunarInfo(date: Date): LunarInfo {
  return {
    lunar: lunarDateOf(date),
    solarTerm: solarTermOf(date),
  };
}
