import { describe, expect, test } from 'vitest';
import type { Entry, Exercise } from '../types';
import { parseImport, serializeExport } from './exportImport';

const exercises: Exercise[] = [
  { id: 'ex1', name: 'Bench Press', createdAt: '2026-07-01T10:00:00.000Z' },
  { id: 'ex2', name: 'Squat', createdAt: '2026-07-02T10:00:00.000Z' },
];

const entries: Entry[] = [
  {
    id: 'e1',
    exerciseId: 'ex1',
    date: '2026-07-03',
    weightKg: 80,
    reps: 5,
    note: 'felt easy',
    createdAt: '2026-07-03T18:00:00.000Z',
  },
  { id: 'e2', exerciseId: 'ex2', date: '2026-07-04', weightKg: 120, reps: 3, createdAt: '2026-07-04T18:00:00.000Z' },
];

describe('serializeExport', () => {
  test('includes version and exportedAt timestamp', () => {
    const data = JSON.parse(serializeExport(exercises, entries));
    expect(data.version).toBe(1);
    expect(new Date(data.exportedAt).getTime()).not.toBeNaN();
  });
});

describe('parseImport', () => {
  test('round-trips exported data', () => {
    const json = serializeExport(exercises, entries);
    expect(parseImport(json)).toEqual({ exercises, entries });
  });

  test('rejects invalid JSON', () => {
    expect(() => parseImport('not json{')).toThrow(/not valid json/i);
  });

  test('rejects JSON that is not a PRTracker export', () => {
    expect(() => parseImport('{"foo": 1}')).toThrow(/not a prtracker export/i);
  });

  test('rejects unsupported versions', () => {
    const data = { version: 99, exportedAt: '2026-07-04T00:00:00.000Z', exercises: [], entries: [] };
    expect(() => parseImport(JSON.stringify(data))).toThrow(/version/i);
  });

  test('rejects malformed exercises', () => {
    const data = { version: 1, exportedAt: '2026-07-04T00:00:00.000Z', exercises: [{ id: 'x' }], entries: [] };
    expect(() => parseImport(JSON.stringify(data))).toThrow(/exercise/i);
  });

  test('rejects malformed entries', () => {
    const bad = { ...entries[0], weightKg: 'heavy' };
    const data = { version: 1, exportedAt: '2026-07-04T00:00:00.000Z', exercises, entries: [bad] };
    expect(() => parseImport(JSON.stringify(data))).toThrow(/entry/i);
  });

  test('rejects entries that reference a missing exercise', () => {
    const orphan = { ...entries[0], exerciseId: 'missing' };
    const data = { version: 1, exportedAt: '2026-07-04T00:00:00.000Z', exercises, entries: [orphan] };
    expect(() => parseImport(JSON.stringify(data))).toThrow(/unknown exercise/i);
  });
});
