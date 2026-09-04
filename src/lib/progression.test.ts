import { describe, expect, test } from 'vitest';
import type { Entry } from '../types';
import {
  distinctWeights,
  estimatedOneRepMax,
  filterByRange,
  repsAtWeight,
  sessionVolume,
  topWeightPerSession,
} from './progression';

let seq = 0;
function entry(partial: Partial<Entry> & { weightKg: number; reps: number }): Entry {
  seq += 1;
  return {
    id: partial.id ?? `e${seq}`,
    exerciseId: 'ex1',
    date: partial.date ?? '2026-07-01',
    createdAt: partial.createdAt ?? `2026-07-01T10:00:${String(seq).padStart(2, '0')}.000Z`,
    ...partial,
  };
}

describe('estimatedOneRepMax', () => {
  test('returns empty array for no entries', () => {
    expect(estimatedOneRepMax([])).toEqual([]);
  });

  test('applies the Epley formula to a single entry', () => {
    const entries = [entry({ weightKg: 100, reps: 5, date: '2026-07-01' })];
    expect(estimatedOneRepMax(entries)).toEqual([{ date: '2026-07-01', value: 100 * (1 + 5 / 30) }]);
  });

  test('collapses same-day entries to the day\'s max estimate', () => {
    const entries = [
      entry({ weightKg: 100, reps: 5, date: '2026-07-01' }), // 116.67
      entry({ weightKg: 90, reps: 10, date: '2026-07-01' }), // 120
    ];
    const [point] = estimatedOneRepMax(entries);
    expect(point.date).toBe('2026-07-01');
    expect(point.value).toBeCloseTo(120);
  });

  test('orders points chronologically across days', () => {
    const entries = [
      entry({ weightKg: 100, reps: 1, date: '2026-07-03' }),
      entry({ weightKg: 100, reps: 1, date: '2026-07-01' }),
      entry({ weightKg: 100, reps: 1, date: '2026-07-02' }),
    ];
    expect(estimatedOneRepMax(entries).map((p) => p.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
});

describe('topWeightPerSession', () => {
  test('returns empty array for no entries', () => {
    expect(topWeightPerSession([])).toEqual([]);
  });

  test('takes the max weight logged on a day', () => {
    const entries = [
      entry({ weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ weightKg: 110, reps: 3, date: '2026-07-01' }),
    ];
    expect(topWeightPerSession(entries)).toEqual([{ date: '2026-07-01', value: 110 }]);
  });

  test('one point per day across multiple days', () => {
    const entries = [
      entry({ weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ weightKg: 105, reps: 5, date: '2026-07-02' }),
    ];
    expect(topWeightPerSession(entries)).toEqual([
      { date: '2026-07-01', value: 100 },
      { date: '2026-07-02', value: 105 },
    ]);
  });
});

describe('sessionVolume', () => {
  test('returns empty array for no entries', () => {
    expect(sessionVolume([])).toEqual([]);
  });

  test('sums weight times reps across a day\'s entries', () => {
    const entries = [
      entry({ weightKg: 100, reps: 5, date: '2026-07-01' }), // 500
      entry({ weightKg: 100, reps: 3, date: '2026-07-01' }), // 300
    ];
    expect(sessionVolume(entries)).toEqual([{ date: '2026-07-01', value: 800 }]);
  });
});

describe('repsAtWeight', () => {
  test('excludes entries at other weights', () => {
    const entries = [
      entry({ weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ weightKg: 90, reps: 8, date: '2026-07-02' }),
    ];
    expect(repsAtWeight(entries, 100)).toEqual([{ date: '2026-07-01', value: 5 }]);
  });

  test('takes the max reps on a day at that weight', () => {
    const entries = [
      entry({ weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ weightKg: 100, reps: 8, date: '2026-07-01' }),
    ];
    expect(repsAtWeight(entries, 100)).toEqual([{ date: '2026-07-01', value: 8 }]);
  });

  test('returns empty array when the weight was never logged', () => {
    const entries = [entry({ weightKg: 100, reps: 5, date: '2026-07-01' })];
    expect(repsAtWeight(entries, 999)).toEqual([]);
  });
});

describe('distinctWeights', () => {
  test('returns empty array for no entries', () => {
    expect(distinctWeights([])).toEqual([]);
  });

  test('dedups and sorts descending', () => {
    const entries = [
      entry({ weightKg: 90, reps: 5 }),
      entry({ weightKg: 110, reps: 3 }),
      entry({ weightKg: 90, reps: 8 }),
      entry({ weightKg: 100, reps: 1 }),
    ];
    expect(distinctWeights(entries)).toEqual([110, 100, 90]);
  });
});

describe('filterByRange', () => {
  const points = [
    { date: '2026-01-01', value: 1 }, // 246 days before today
    { date: '2026-07-01', value: 2 }, // 65 days before today
    { date: '2026-08-06', value: 3 }, // exactly 29 days before today
    { date: '2026-09-04', value: 4 }, // today
  ];
  const today = new Date(2026, 8, 4); // 2026-09-04

  test('"all" returns every point unfiltered', () => {
    expect(filterByRange(points, 'all', today)).toEqual(points);
  });

  test('"30d" keeps points within the last 30 days including today', () => {
    expect(filterByRange(points, '30d', today)).toEqual([points[2], points[3]]);
  });

  test('a point just outside the 30d window is excluded', () => {
    const justOutside = { date: '2026-08-05', value: 5 }; // 30 days before today
    expect(filterByRange([justOutside, points[3]], '30d', today)).toEqual([points[3]]);
  });

  test('"90d" and "1y" widen the window accordingly', () => {
    expect(filterByRange(points, '90d', today)).toEqual([points[1], points[2], points[3]]);
    expect(filterByRange(points, '1y', today)).toEqual(points);
  });
});
