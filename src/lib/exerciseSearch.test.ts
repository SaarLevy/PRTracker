import { describe, expect, test } from 'vitest';
import type { Exercise } from '../types';
import { searchExercises } from './exerciseSearch';

let seq = 0;
function exercise(name: string, id?: string): Exercise {
  seq += 1;
  return { id: id ?? `ex${seq}`, name, createdAt: `2026-07-01T10:00:${String(seq).padStart(2, '0')}.000Z` };
}

const LIB = ['Squat', 'Squat Jump', 'Front Squat', 'Bench Press', 'Deadlift'] as const;

describe('searchExercises', () => {
  test('empty query returns all existing (alphabetical), no library, no add-literal', () => {
    const b = exercise('Bench Press');
    const a = exercise('Arnold Press');
    const result = searchExercises('', [a, b], LIB);
    expect(result).toEqual({ existing: [a, b], libraryOnly: [], showAddLiteral: false });
  });

  test('whitespace-only query behaves like empty query', () => {
    const a = exercise('Arnold Press');
    const result = searchExercises('   ', [a], LIB);
    expect(result).toEqual({ existing: [a], libraryOnly: [], showAddLiteral: false });
  });

  test('matches an existing exercise by case-insensitive substring', () => {
    const bench = exercise('Bench Press');
    const squat = exercise('Squat');
    const result = searchExercises('bench', [bench, squat], LIB);
    expect(result.existing).toEqual([bench]);
  });

  test('matches a library exercise not already tracked', () => {
    const result = searchExercises('deadlift', [], LIB);
    expect(result.libraryOnly).toEqual(['Deadlift']);
  });

  test('suppresses a library entry that is already tracked (case-insensitive)', () => {
    const squat = exercise('squat');
    const result = searchExercises('squat', [squat], LIB);
    expect(result.existing).toEqual([squat]);
    expect(result.libraryOnly).not.toContain('Squat');
  });

  test('query matching nothing sets showAddLiteral true', () => {
    const result = searchExercises('Zercher Lunge Combo', [], LIB);
    expect(result).toEqual({ existing: [], libraryOnly: [], showAddLiteral: true });
  });

  test('exact match to an existing name suppresses showAddLiteral', () => {
    const bench = exercise('Bench Press');
    const result = searchExercises('bench press', [bench], LIB);
    expect(result.showAddLiteral).toBe(false);
  });

  test('exact match to a library-only shown name suppresses showAddLiteral', () => {
    const result = searchExercises('deadlift', [], LIB);
    expect(result.showAddLiteral).toBe(false);
  });

  test('partial match with no exact hit still offers showAddLiteral', () => {
    const result = searchExercises('squ', [], LIB);
    expect(result.libraryOnly.length).toBeGreaterThan(0);
    expect(result.showAddLiteral).toBe(true);
  });

  test('ranks exact match above starts-with above contains within libraryOnly', () => {
    const result = searchExercises('squat', [], LIB);
    expect(result.libraryOnly).toEqual(['Squat', 'Squat Jump', 'Front Squat']);
  });

  test('respects a custom limit, keeping the top-ranked entries', () => {
    const result = searchExercises('squat', [], LIB, 2);
    expect(result.libraryOnly).toEqual(['Squat', 'Squat Jump']);
  });

  test('is case-insensitive and trims the query', () => {
    const result = searchExercises('  SQUAT  ', [], LIB);
    expect(result.libraryOnly[0]).toBe('Squat');
  });

  test('never merges two existing exercises that share a name', () => {
    const first = exercise('Bench Press', 'a');
    const second = exercise('Bench Press', 'b');
    const result = searchExercises('bench', [first, second], LIB);
    expect(result.existing).toEqual([first, second]);
  });

  test('existing matches are sorted alphabetically', () => {
    const zed = exercise('Zercher Squat');
    const ab = exercise('Ab Squat Hold');
    const result = searchExercises('squat', [zed, ab], LIB);
    expect(result.existing).toEqual([ab, zed]);
  });
});
