import { afterEach, describe, expect, test } from 'vitest';
import type { Entry, Exercise } from '../types';
import { lastLoggedAt, loadSortMode, saveSortMode, sortExercises } from './exerciseSort';

function exercise(name: string, createdAt = '2026-01-01T00:00:00.000Z'): Exercise {
  return { id: `ex-${name}`, name, createdAt };
}

function entry(exerciseId: string, date: string, createdAt: string): Entry {
  return { id: `en-${exerciseId}-${createdAt}`, exerciseId, date, weightKg: 100, reps: 5, createdAt };
}

describe('lastLoggedAt', () => {
  test('maps each exercise to the createdAt of its newest entry', () => {
    const entries = [
      entry('a', '2026-02-01', '2026-02-01T10:00:00.000Z'),
      entry('a', '2026-02-05', '2026-02-05T10:00:00.000Z'),
      entry('b', '2026-02-03', '2026-02-03T10:00:00.000Z'),
    ];
    expect(lastLoggedAt(entries)).toEqual(
      new Map([
        ['a', '2026-02-05T10:00:00.000Z'],
        ['b', '2026-02-03T10:00:00.000Z'],
      ]),
    );
  });

  test('is empty when there are no entries', () => {
    expect(lastLoggedAt([])).toEqual(new Map());
  });
});

describe('sortExercises', () => {
  test('alpha mode sorts by name, ignoring case', () => {
    const list = [exercise('deadlift'), exercise('Bench Press'), exercise('arnold press')];
    expect(sortExercises(list, 'alpha', new Map()).map((e) => e.name)).toEqual([
      'arnold press',
      'Bench Press',
      'deadlift',
    ]);
  });

  test('recent mode puts the most recently logged exercise first', () => {
    const squat = exercise('Squat');
    const bench = exercise('Bench Press');
    const logged = new Map([
      [squat.id, '2026-02-01T10:00:00.000Z'],
      [bench.id, '2026-03-01T10:00:00.000Z'],
    ]);
    expect(sortExercises([squat, bench], 'recent', logged).map((e) => e.name)).toEqual([
      'Bench Press',
      'Squat',
    ]);
  });

  test('recent mode ranks a backdated set by when it was logged, not the date it was for', () => {
    const squat = exercise('Squat');
    const bench = exercise('Bench Press');
    // Squat's set is for last month but was typed in today; bench was logged a week ago.
    const logged = lastLoggedAt([
      entry(squat.id, '2026-02-01', '2026-03-10T10:00:00.000Z'),
      entry(bench.id, '2026-03-03', '2026-03-03T10:00:00.000Z'),
    ]);
    expect(sortExercises([bench, squat], 'recent', logged).map((e) => e.name)).toEqual([
      'Squat',
      'Bench Press',
    ]);
  });

  test('recent mode falls back to the exercise createdAt when nothing is logged', () => {
    const old = exercise('Squat', '2026-01-01T00:00:00.000Z');
    const fresh = exercise('Bench Press', '2026-04-01T00:00:00.000Z');
    const logged = new Map([[old.id, '2026-02-01T10:00:00.000Z']]);
    expect(sortExercises([old, fresh], 'recent', logged).map((e) => e.name)).toEqual([
      'Bench Press',
      'Squat',
    ]);
  });

  test('recent mode breaks ties on equal timestamps by name', () => {
    const same = '2026-02-01T10:00:00.000Z';
    const squat = exercise('Squat', same);
    const bench = exercise('Bench Press', same);
    expect(sortExercises([squat, bench], 'recent', new Map()).map((e) => e.name)).toEqual([
      'Bench Press',
      'Squat',
    ]);
  });

  test('does not mutate its input', () => {
    const list = [exercise('Squat'), exercise('Bench Press')];
    const before = [...list];
    sortExercises(list, 'alpha', new Map());
    expect(list).toEqual(before);
  });
});

describe('loadSortMode', () => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };

  afterEach(() => store.clear());

  test('defaults to recent when nothing is stored', () => {
    expect(loadSortMode()).toBe('recent');
  });

  test('defaults to recent when the stored value is not a known mode', () => {
    store.set('prtracker.exerciseSort', 'heaviest');
    expect(loadSortMode()).toBe('recent');
  });

  test('reads back a saved mode', () => {
    saveSortMode('alpha');
    expect(loadSortMode()).toBe('alpha');
  });
});
