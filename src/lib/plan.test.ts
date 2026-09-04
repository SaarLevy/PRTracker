import { describe, expect, test } from 'vitest';
import { addRound, carryOverWork, collectEntries, isSetFilled, type Plan, planFromText, removeSet } from './plan';
import type { PlannedSet } from './parseWod';

function plan(sets: Partial<PlannedSet>[]): Plan {
  return {
    date: '2026-08-16',
    createdAt: '2026-08-16T10:00:00.000Z',
    text: '',
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
    text: '',
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
      text: '',
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

/** A plan of named exercises with their sets, laid out group by group. */
function planOf(groups: Record<string, Partial<PlannedSet>[]>[], date = '2026-08-16'): Plan {
  return {
    date,
    createdAt: `${date}T10:00:00.000Z`,
    text: '',
    groups: groups.map((items, index) => ({
      label: `Group ${index + 1}`,
      items: Object.entries(items).map(([name, sets]) => ({
        // A trailing "#n" lets one group hold two columns of the same exercise, the way a
        // drop set parses, while keeping the object keys distinct.
        name: name.replace(/#\d+$/, ''),
        sets: sets.map((set) => ({ reps: null, repsLabel: '', weightKg: null, ...set })),
      })),
    })),
  };
}

/** Every set of every item, as `weight/reps` per exercise. */
const filled = (result: Plan) =>
  result.groups.flatMap((group) =>
    group.items.map((item) => [item.name, item.sets.map((set) => `${set.weightKg}/${set.reps}`).join(' ')]),
  );

describe('carryOverWork', () => {
  test('carries weights across by position on an unchanged exercise', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }, { weightKg: 110 }, { weightKg: 115 }] }]);
    const next = planOf([{ Deadlift: [{}, {}, {}] }]);

    const { plan: result, lost } = carryOverWork(next, previous);

    expect(filled(result)).toEqual([['Deadlift', '100/null 110/null 115/null']]);
    expect(lost).toBe(0);
  });

  test('starts a renamed exercise empty and counts its filled sets as lost', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }], Bench: [{ weightKg: 60 }, { weightKg: 62 }] }]);
    const next = planOf([{ Deadlift: [{}], 'Incline Bench': [{}, {}] }]);

    const { plan: result, lost } = carryOverWork(next, previous);

    expect(filled(result)).toEqual([
      ['Deadlift', '100/null'],
      ['Incline Bench', 'null/null null/null'],
    ]);
    expect(lost).toBe(2);
  });

  test('does not count unfilled sets of a removed exercise as lost', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }], Bench: [{ reps: 8, repsLabel: '8' }, {}] }]);
    const next = planOf([{ Deadlift: [{}] }]);

    expect(carryOverWork(next, previous).lost).toBe(0);
  });

  test('carries a typed rep count while the prescription is unchanged', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100, reps: 7, repsLabel: 'Max' }] }]);
    const next = planOf([{ Deadlift: [{ reps: null, repsLabel: 'Max' }] }]);

    expect(filled(carryOverWork(next, previous).plan)).toEqual([['Deadlift', '100/7']]);
  });

  test('lets the edited text win when it changed the prescription', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100, reps: 8, repsLabel: '8' }] }]);
    const next = planOf([{ Deadlift: [{ reps: 5, repsLabel: '5' }] }]);

    expect(filled(carryOverWork(next, previous).plan)).toEqual([['Deadlift', '100/5']]);
  });

  test('appends a filled set the edited text no longer prescribes', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }, { weightKg: 110 }, { weightKg: 120 }] }]);
    const next = planOf([{ Deadlift: [{}, {}] }]);

    const { plan: result, lost } = carryOverWork(next, previous);

    expect(filled(result)).toEqual([['Deadlift', '100/null 110/null 120/null']]);
    expect(lost).toBe(0);
  });

  test('drops an unfilled set the edited text no longer prescribes', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }, {}, {}] }]);
    const next = planOf([{ Deadlift: [{}, {}] }]);

    const { plan: result, lost } = carryOverWork(next, previous);

    expect(filled(result)).toEqual([['Deadlift', '100/null null/null']]);
    expect(lost).toBe(0);
  });

  test('matches the nth exercise of a repeated name to the nth', () => {
    const previous = planOf([{ 'Squat#1': [{ weightKg: 100 }], 'Squat#2': [{ weightKg: 80 }] }]);
    const next = planOf([{ 'Squat#1': [{}], 'Squat#2': [{}] }]);

    expect(filled(carryOverWork(next, previous).plan)).toEqual([
      ['Squat', '100/null'],
      ['Squat', '80/null'],
    ]);
  });

  test('finds an exercise that moved to another group', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }] }, { Bench: [{ weightKg: 60 }] }]);
    const next = planOf([{ Bench: [{}] }, { Deadlift: [{}] }]);

    const { plan: result, lost } = carryOverWork(next, previous);

    expect(filled(result)).toEqual([
      ['Bench', '60/null'],
      ['Deadlift', '100/null'],
    ]);
    expect(lost).toBe(0);
  });

  test('ignores case and surrounding whitespace when matching', () => {
    const previous = planOf([{ '  Back Squat ': [{ weightKg: 100 }] }]);
    const next = planOf([{ 'back squat': [{}] }]);

    expect(filled(carryOverWork(next, previous).plan)).toEqual([['back squat', '100/null']]);
  });

  test('keeps the previous date but takes the new createdAt', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }] }], '2026-08-16');
    const next = planOf([{ Deadlift: [{}] }], '2026-08-17');

    const { plan: result } = carryOverWork(next, previous);

    expect(result.date).toBe('2026-08-16');
    expect(result.createdAt).toBe('2026-08-17T10:00:00.000Z');
  });

  test('leaves both of its inputs alone', () => {
    const previous = planOf([{ Deadlift: [{ weightKg: 100 }, { weightKg: 110 }] }]);
    const next = planOf([{ Deadlift: [{}] }]);
    const before = { previous: structuredClone(previous), next: structuredClone(next) };

    carryOverWork(next, previous);

    expect(previous).toEqual(before.previous);
    expect(next).toEqual(before.next);
  });
});

describe('planFromText', () => {
  test('keeps the text it parsed, so the plan can be edited later', () => {
    const text = '3 Sets\n8 Deadlift';

    expect(planFromText(text)?.text).toBe(text);
  });
});
