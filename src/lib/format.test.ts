import { describe, expect, test } from 'vitest';
import { formatDay, formatWeightKg, timeAgo, toISODay } from './format';

describe('formatWeightKg', () => {
  test('trims trailing zeros', () => {
    expect(formatWeightKg(100)).toBe('100');
    expect(formatWeightKg(102.5)).toBe('102.5');
    expect(formatWeightKg(61.25)).toBe('61.25');
  });
});

describe('toISODay', () => {
  test('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toISODay(new Date(2026, 6, 4))).toBe('2026-07-04');
    expect(toISODay(new Date(2026, 0, 31))).toBe('2026-01-31');
  });
});

describe('timeAgo', () => {
  const now = new Date(2026, 6, 24);

  test('same day is today', () => {
    expect(timeAgo('2026-07-24', now)).toBe('today');
  });

  test('days within a week', () => {
    expect(timeAgo('2026-07-21', now)).toBe('3d ago');
  });

  test('weeks within a couple months', () => {
    expect(timeAgo('2026-07-03', now)).toBe('3w ago');
  });

  test('months within a year', () => {
    expect(timeAgo('2026-04-24', now)).toBe('3mo ago');
  });

  test('years beyond that', () => {
    expect(timeAgo('2024-07-24', now)).toBe('2y ago');
  });
});

describe('formatDay', () => {
  const now = new Date(2026, 6, 24);

  test('omits the year for the current year', () => {
    expect(formatDay('2026-07-03', now)).toBe('Jul 3');
  });

  test('includes the year otherwise', () => {
    expect(formatDay('2025-12-30', now)).toBe('Dec 30, 2025');
  });
});
