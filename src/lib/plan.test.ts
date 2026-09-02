import { describe, expect, test } from 'vitest';
import { collectEntries, type Plan } from './plan';
import type { PlannedSet } from './parseWod';

function plan(sets: Partial<PlannedSet>[]): Plan {
  return {
    date: '2026-08-16',
    createdAt: '2026-08-16T10:00:00.000Z',
    groups: [
      {
        label: 'Sets',
        items: [
          {
            name: 'Deadlift',
            sets: sets.map((set) => ({ reps: null, repsLabel: '', weightKg: null, ...set })),
          },
        ],
      },
    ],
  };
}

describe('collectEntries', () => {
  test('collects sets that have both a weight and a rep count', () => {
    const result = collectEntries(plan([{ weightKg: 100, reps: 5 }, { weightKg: 105, reps: 3 }]));

    expect(result).toEqual({
      ready: [
        { name: 'Deadlift', weightKg: 100, reps: 5 },
        { name: 'Deadlift', weightKg: 105, reps: 3 },
      ],
      incomplete: 0,
    });
  });

  test('ignores untouched sets entirely', () => {
    expect(collectEntries(plan([{}, {}]))).toEqual({ ready: [], incomplete: 0 });
  });

  test('counts a weight with no reps as incomplete rather than logging it', () => {
    expect(collectEntries(plan([{ weightKg: 100 }]))).toEqual({ ready: [], incomplete: 1 });
  });

  test('counts reps with no weight as incomplete', () => {
    expect(collectEntries(plan([{ reps: 8 }]))).toEqual({ ready: [], incomplete: 1 });
  });

  test('treats a bodyweight set as loggable', () => {
    expect(collectEntries(plan([{ weightKg: 0, reps: 12 }])).ready).toEqual([
      { name: 'Deadlift', weightKg: 0, reps: 12 },
    ]);
  });

  test('rejects a zero rep count', () => {
    expect(collectEntries(plan([{ weightKg: 100, reps: 0 }]))).toEqual({ ready: [], incomplete: 1 });
  });

  test('walks every group and item', () => {
    const multi: Plan = {
      date: '2026-08-16',
      createdAt: '2026-08-16T10:00:00.000Z',
      groups: [
        {
          label: 'Super-sets',
          items: [
            { name: 'Press', sets: [{ reps: 8, repsLabel: '8', weightKg: 40 }] },
            { name: 'Row', sets: [{ reps: 8, repsLabel: '8', weightKg: 50 }] },
          ],
        },
        {
          label: 'Sets',
          items: [{ name: 'Squat', sets: [{ reps: 5, repsLabel: '5', weightKg: 90 }] }],
        },
      ],
    };

    expect(collectEntries(multi).ready.map((entry) => entry.name)).toEqual(['Press', 'Row', 'Squat']);
  });
});
