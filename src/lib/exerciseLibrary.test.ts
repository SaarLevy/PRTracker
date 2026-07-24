import { describe, expect, test } from 'vitest';
import { EXERCISE_LIBRARY } from './exerciseLibrary';

describe('EXERCISE_LIBRARY', () => {
  test('has between 120 and 180 entries', () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(120);
    expect(EXERCISE_LIBRARY.length).toBeLessThanOrEqual(180);
  });

  test('has no case-insensitive duplicate entries', () => {
    const lower = EXERCISE_LIBRARY.map((name) => name.toLowerCase());
    const unique = new Set(lower);
    expect(unique.size).toBe(lower.length);
  });
});
