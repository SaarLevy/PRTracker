import { describe, expect, test } from 'vitest';
import { addRound, collectEntries, isSetFilled, type Plan, removeSet } from './plan';
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

/** One group of alternating exercises, a column each, named 'A', 'B', … */
function superset(columns: Partial<PlannedSet>[][]): Plan {
  return {
    date: '2026-08-16',
    createdAt: '2026-08-16T10:00:00.000Z',
    groups: [
      {
        label: 'Super-sets',
        items: columns.map((sets, index) => ({
          name: String.fromCharCode(65 + index),
          sets: sets.map((set) => ({ reps: null, repsLabel: '', weightKg: null, ...set })),
        })),
      },
    ],
  };
}

const lengths = (result: Plan) => result.groups[0].items.map((item) => item.sets.length);

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

describe('addRound', () => {
  test('appends one set to a lone exercise', () => {
    const result = addRound(plan([{ weightKg: 100, reps: 5 }, { weightKg: 105, reps: 5 }]), 0);

    expect(lengths(result)).toEqual([3]);
  });

  test('copies the rep prescription of the set before it but never its weight', () => {
    const result = addRound(plan([{ reps: 5, repsLabel: '5', weightKg: 100 }]), 0);

    expect(result.groups[0].items[0].sets[1]).toEqual({ reps: 5, repsLabel: '5', weightKg: null });
  });

  test('appends one set to every column of a superset', () => {
    const result = addRound(superset([[{}, {}], [{}, {}]]), 0);

    expect(lengths(result)).toEqual([3, 3]);
  });

  test('grows each ragged column by one rather than padding up to the longest', () => {
    const result = addRound(superset([[{}, {}, {}], [{}, {}]]), 0);

    expect(lengths(result)).toEqual([4, 3]);
  });

  test('gives each column its own rep label rather than the first column', () => {
    const result = addRound(superset([[{ reps: 8, repsLabel: '8' }], [{ reps: 10, repsLabel: '10' }]]), 0);

    expect(result.groups[0].items.map((item) => item.sets[1].repsLabel)).toEqual(['8', '10']);
  });

  test('appends a blank set to an item with no sets left', () => {
    const result = addRound(plan([]), 0);

    expect(result.groups[0].items[0].sets).toEqual([{ reps: null, repsLabel: '', weightKg: null }]);
  });

  test('does not mutate its input', () => {
    const before = plan([{ weightKg: 100, reps: 5 }]);
    addRound(before, 0);

    expect(lengths(before)).toEqual([1]);
  });

  test('leaves the plan alone for an out-of-range group', () => {
    const before = plan([{}]);

    expect(addRound(before, 3)).toBe(before);
  });
});

describe('removeSet', () => {
  test('drops the addressed set and closes the gap', () => {
    const result = removeSet(plan([{ weightKg: 100 }, { weightKg: 105 }, { weightKg: 110 }]), 0, 0, 1);

    expect(result.groups[0].items[0].sets.map((set) => set.weightKg)).toEqual([100, 110]);
  });

  test('drops the last set', () => {
    const result = removeSet(plan([{ weightKg: 100 }, { weightKg: 105 }]), 0, 0, 1);

    expect(result.groups[0].items[0].sets.map((set) => set.weightKg)).toEqual([100]);
  });

  test('drops only the addressed column, leaving the superset ragged', () => {
    const result = removeSet(superset([[{}, {}, {}], [{}, {}, {}]]), 0, 1, 2);

    expect(lengths(result)).toEqual([3, 2]);
  });

  test('leaves an item with no sets when its only set goes', () => {
    const result = removeSet(plan([{ weightKg: 100 }]), 0, 0, 0);

    expect(result.groups[0].items[0].sets).toEqual([]);
  });

  test('does not mutate its input', () => {
    const before = plan([{ weightKg: 100 }, { weightKg: 105 }]);
    removeSet(before, 0, 0, 0);

    expect(lengths(before)).toEqual([2]);
  });

  test('leaves the plan alone for an out-of-range group, item or set', () => {
    const before = plan([{}]);

    expect(removeSet(before, 3, 0, 0)).toBe(before);
    expect(removeSet(before, 0, 3, 0)).toBe(before);
    expect(removeSet(before, 0, 0, 3)).toBe(before);
    expect(removeSet(before, 0, 0, -1)).toBe(before);
  });
});

describe('isSetFilled', () => {
  test('is true once a weight is entered', () => {
    expect(isSetFilled({ reps: null, repsLabel: '', weightKg: 100 })).toBe(true);
  });

  test('is true for a bodyweight set', () => {
    expect(isSetFilled({ reps: null, repsLabel: '', weightKg: 0 })).toBe(true);
  });

  test('is false for a rep count the WOD prefilled', () => {
    expect(isSetFilled({ reps: 8, repsLabel: '8', weightKg: null })).toBe(false);
  });

  test('is false for an untouched set', () => {
    expect(isSetFilled({ reps: null, repsLabel: '', weightKg: null })).toBe(false);
  });
});
