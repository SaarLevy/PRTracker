import { describe, expect, test } from 'vitest';
import type { Entry } from '../types';
import { computeRecords, overallBest, prEntryIds } from './records';

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

describe('computeRecords', () => {
  test('returns empty array for no entries', () => {
    expect(computeRecords([])).toEqual([]);
  });

  test('returns best weight per rep count, sorted by reps ascending', () => {
    const entries = [
      entry({ id: 'a', weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ id: 'b', weightKg: 110, reps: 3, date: '2026-07-02' }),
      entry({ id: 'c', weightKg: 105, reps: 5, date: '2026-07-03' }),
      entry({ id: 'd', weightKg: 108, reps: 3, date: '2026-07-04' }),
    ];
    expect(computeRecords(entries)).toEqual([
      { reps: 3, weightKg: 110, entryId: 'b', date: '2026-07-02' },
      { reps: 5, weightKg: 105, entryId: 'c', date: '2026-07-03' },
    ]);
  });

  test('credits the earliest entry when weights tie at a rep count', () => {
    const entries = [
      entry({ id: 'later', weightKg: 100, reps: 5, date: '2026-07-10' }),
      entry({ id: 'first', weightKg: 100, reps: 5, date: '2026-07-02' }),
    ];
    expect(computeRecords(entries)).toEqual([
      { reps: 5, weightKg: 100, entryId: 'first', date: '2026-07-02' },
    ]);
  });
});

describe('overallBest', () => {
  test('returns undefined for no entries', () => {
    expect(overallBest([])).toBeUndefined();
  });

  test('returns the heaviest entry', () => {
    const best = entry({ id: 'best', weightKg: 120, reps: 1 });
    const entries = [entry({ weightKg: 100, reps: 5 }), best, entry({ weightKg: 110, reps: 3 })];
    expect(overallBest(entries)).toEqual(best);
  });

  test('breaks weight ties by more reps', () => {
    const moreReps = entry({ id: 'moreReps', weightKg: 100, reps: 8 });
    const entries = [entry({ weightKg: 100, reps: 5 }), moreReps];
    expect(overallBest(entries)?.id).toBe('moreReps');
  });
});

describe('prEntryIds', () => {
  test('first entry at a new rep count is a PR', () => {
    const entries = [
      entry({ id: 'a', weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ id: 'b', weightKg: 90, reps: 8, date: '2026-07-02' }),
    ];
    expect(prEntryIds(entries)).toEqual(new Set(['a', 'b']));
  });

  test('heavier entry at same rep count is a PR, equal or lighter is not', () => {
    const entries = [
      entry({ id: 'a', weightKg: 100, reps: 5, date: '2026-07-01' }),
      entry({ id: 'b', weightKg: 105, reps: 5, date: '2026-07-02' }),
      entry({ id: 'c', weightKg: 105, reps: 5, date: '2026-07-03' }),
      entry({ id: 'd', weightKg: 95, reps: 5, date: '2026-07-04' }),
    ];
    expect(prEntryIds(entries)).toEqual(new Set(['a', 'b']));
  });

  test('orders same-day entries by createdAt when deciding what was a PR', () => {
    const entries = [
      entry({ id: 'second', weightKg: 105, reps: 5, date: '2026-07-01', createdAt: '2026-07-01T11:00:00.000Z' }),
      entry({ id: 'firstOfDay', weightKg: 100, reps: 5, date: '2026-07-01', createdAt: '2026-07-01T10:00:00.000Z' }),
    ];
    expect(prEntryIds(entries)).toEqual(new Set(['firstOfDay', 'second']));
  });
});
