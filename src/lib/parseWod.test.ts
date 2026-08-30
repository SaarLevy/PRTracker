import { describe, expect, test } from 'vitest';
import { parseWod } from './parseWod';

describe('parseWod', () => {
  test('returns nothing for empty input', () => {
    expect(parseWod('')).toEqual([]);
    expect(parseWod('   \n \n')).toEqual([]);
  });

  test('parses a superset group into one item per exercise, one set per round', () => {
    const groups = parseWod('3 Super-sets\n15 Incline bench DB Row\n15 V-ups');

    expect(groups).toEqual([
      {
        label: 'Super-sets',
        items: [
          {
            name: 'Incline bench DB Row',
            sets: [
              { reps: 15, repsLabel: '15', weightKg: null },
              { reps: 15, repsLabel: '15', weightKg: null },
              { reps: 15, repsLabel: '15', weightKg: null },
            ],
          },
          {
            name: 'V-ups',
            sets: [
              { reps: 15, repsLabel: '15', weightKg: null },
              { reps: 15, repsLabel: '15', weightKg: null },
              { reps: 15, repsLabel: '15', weightKg: null },
            ],
          },
        ],
      },
    ]);
  });

  test('gives each set its own object so filling one weight does not fill the rest', () => {
    const [group] = parseWod('3 Sets\n10 Deadlift');
    group.items[0].sets[0].weightKg = 100;

    expect(group.items[0].sets.map((set) => set.weightKg)).toEqual([100, null, null]);
  });

  describe('group headers', () => {
    test('accepts every qualifier seen in the wild, keeping the label as written', () => {
      const text = ['3 Super-sets\n8 A', '4 Sets\n8 B', '3 Drop sets\n8 C', '3 Triple-sets\n8 D'].join('\n');

      expect(parseWod(text).map((group) => group.label)).toEqual([
        'Super-sets',
        'Sets',
        'Drop sets',
        'Triple-sets',
      ]);
    });

    test('accepts a header missing the word "sets"', () => {
      const groups = parseWod('4 Super\n8-12 Press');

      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe('Super');
      expect(groups[0].items[0].sets).toHaveLength(4);
    });

    test('tolerates a trailing parenthetical', () => {
      const groups = parseWod('3 Triple-sets (10min)\n10 TTB');

      expect(groups[0].label).toBe('Triple-sets (10min)');
      expect(groups[0].items[0].sets).toHaveLength(3);
    });

    test('does not mistake an exercise line for a header', () => {
      const groups = parseWod('3 Super-sets\n8 Press\n15 Sit ups\n10 Hip thrust');

      expect(groups).toHaveLength(1);
      expect(groups[0].items.map((item) => item.name)).toEqual(['Press', 'Sit ups', 'Hip thrust']);
    });
  });

  describe('group boundaries', () => {
    test('starts a new group at a header with no separator of any kind', () => {
      const groups = parseWod(
        String.raw`3 Super-sets
8\8 Lean-in SA DB shoulder abduction
8\8 SL Hip thrust
3 Triple-sets (10min)
10 TTB
15 Goblet squat
20 Crunches`,
      );

      expect(groups.map((group) => group.items.length)).toEqual([2, 3]);
      expect(groups[1].items.map((item) => item.name)).toEqual(['TTB', 'Goblet squat', 'Crunches']);
    });

    test('discards dash separators and blank lines alike', () => {
      const dashes = parseWod('3 Sets\n10 Deadlift\n-\n3 Sets\n10 Press');
      const blanks = parseWod('3 Sets\n10 Deadlift\n\n3 Sets\n10 Press');

      expect(dashes).toEqual(blanks);
      expect(dashes).toHaveLength(2);
    });

    test('skips a section title above the first header', () => {
      const groups = parseWod('Strength\n\n3 Sets\n10 Deadlift');

      expect(groups).toHaveLength(1);
      expect(groups[0].items).toHaveLength(1);
    });

    test('drops a header that has no exercises under it', () => {
      expect(parseWod('3 Super-sets\n\n4 Sets\n10 Deadlift')).toHaveLength(1);
    });
  });

  describe('rep notations', () => {
    test('prefills a plain count', () => {
      const [{ items }] = parseWod('1 Sets\n15 Sit ups');
      expect(items[0].sets[0]).toEqual({ reps: 15, repsLabel: '15', weightKg: null });
    });

    test('prefills the per-side count but keeps the original label', () => {
      const [{ items }] = parseWod('1 Sets\n8\\8 DB SL RDL');
      expect(items[0].name).toBe('DB SL RDL');
      expect(items[0].sets[0]).toEqual({ reps: 8, repsLabel: '8\\8', weightKg: null });
    });

    test('leaves a range unfilled so a guess never reaches PR history', () => {
      const [{ items }] = parseWod('1 Sets\n8-12 Deadlift');
      expect(items[0].sets[0]).toEqual({ reps: null, repsLabel: '8-12', weightKg: null });
    });

    test('leaves "Max" unfilled', () => {
      const [{ items }] = parseWod('1 Sets\nMax bench press');
      expect(items[0].name).toBe('bench press');
      expect(items[0].sets[0]).toEqual({ reps: null, repsLabel: 'Max', weightKg: null });
    });

    test('passes an unrecognised notation through as a label instead of failing', () => {
      const [{ items }] = parseWod('1 Sets\n3x5+ Thrusters');
      expect(items[0]).toEqual({
        name: 'Thrusters',
        sets: [{ reps: null, repsLabel: '3x5+', weightKg: null }],
      });
    });

    test('treats a line with no rep token as a bare exercise name', () => {
      const [{ items }] = parseWod('2 Sets\nBack squat');
      expect(items[0].name).toBe('Back squat');
      expect(items[0].sets).toEqual([
        { reps: null, repsLabel: '', weightKg: null },
        { reps: null, repsLabel: '', weightKg: null },
      ]);
    });
  });

  describe('intensity hints', () => {
    test('splits a trailing percentage off the exercise name', () => {
      const [{ items }] = parseWod('3 Drop sets\n3-4 Bench press @90%\nMax bench press @50%');

      expect(items).toEqual([
        {
          name: 'Bench press',
          hint: '@90%',
          sets: Array.from({ length: 3 }, () => ({ reps: null, repsLabel: '3-4', weightKg: null })),
        },
        {
          name: 'bench press',
          hint: '@50%',
          sets: Array.from({ length: 3 }, () => ({ reps: null, repsLabel: 'Max', weightKg: null })),
        },
      ]);
    });

    test('turns bare rep lines under an exercise name into drop-set stages of it', () => {
      const [{ items }] = parseWod('3 Drop sets\nPress\n4-6 @90%\nMax @50%');

      expect(items).toEqual([
        {
          name: 'Press',
          hint: '@90%',
          sets: Array.from({ length: 3 }, () => ({ reps: null, repsLabel: '4-6', weightKg: null })),
        },
        {
          name: 'Press',
          hint: '@50%',
          sets: Array.from({ length: 3 }, () => ({ reps: null, repsLabel: 'Max', weightKg: null })),
        },
      ]);
    });

    test('omits the hint entirely when there is none', () => {
      const [{ items }] = parseWod('1 Sets\n10 Hip thrust');
      expect(items[0]).not.toHaveProperty('hint');
    });
  });

  describe('rounds-based blocks', () => {
    test('reads the round count out of an EMOM header', () => {
      const [group] = parseWod('E3MOM x 6 Rounds\nBack squat');

      expect(group.label).toBe('E3MOM x 6 Rounds');
      expect(group.items[0].sets).toHaveLength(6);
    });

    test('expands a rep ladder into one set per value', () => {
      const [group] = parseWod('E3MOM x 6 Rounds\nBack squat\n12-8-4-4-8-12');

      expect(group.items[0].sets.map((set) => set.reps)).toEqual([12, 8, 4, 4, 8, 12]);
      expect(group.items[0].sets.map((set) => set.repsLabel)).toEqual(['12', '8', '4', '4', '8', '12']);
    });

    test('does not mistake a two-value range for a ladder', () => {
      const [group] = parseWod('2 Sets\n8-12 Deadlift');

      expect(group.items).toHaveLength(1);
      expect(group.items[0].sets.map((set) => set.repsLabel)).toEqual(['8-12', '8-12']);
    });
  });

  test('parses a full real-world WOD', () => {
    const groups = parseWod(
      String.raw`Strength

3 Super-sets
8\8 DB SL RDL
15 Sit ups
-
3 Sets
8-12 Deadlift
-
3 Drop sets
3-4 Bench press @90%
Max bench press @50%
-
3 Triple-sets
10-20 BB Curls
10-20 DB Skull crushers
10\10 KTB Side bend`,
    );

    expect(
      groups.map((group) => ({
        label: group.label,
        items: group.items.map((item) => `${item.sets.length}x ${item.sets[0].repsLabel} ${item.name}`),
      })),
    ).toEqual([
      { label: 'Super-sets', items: ['3x 8\\8 DB SL RDL', '3x 15 Sit ups'] },
      { label: 'Sets', items: ['3x 8-12 Deadlift'] },
      { label: 'Drop sets', items: ['3x 3-4 Bench press', '3x Max bench press'] },
      {
        label: 'Triple-sets',
        items: ['3x 10-20 BB Curls', '3x 10-20 DB Skull crushers', '3x 10\\10 KTB Side bend'],
      },
    ]);
  });
});
