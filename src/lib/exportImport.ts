import type { Entry, Exercise } from '../types';

export const EXPORT_VERSION = 1;

export interface ExportData {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  entries: Entry[];
}

/** Serialize all data to a JSON string for backup/transfer. */
export function serializeExport(exercises: Exercise[], entries: Entry[]): string {
  const data: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    entries,
  };
  return JSON.stringify(data, null, 2);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseExercise(raw: unknown, index: number): Exercise {
  const e = raw as Partial<Exercise> | null;
  if (!e || !isString(e.id) || !isString(e.name) || !isString(e.createdAt)) {
    throw new Error(`Exercise #${index + 1} in this file is invalid.`);
  }
  return { id: e.id, name: e.name, createdAt: e.createdAt };
}

function parseEntry(raw: unknown, index: number, exerciseIds: Set<string>): Entry {
  const e = raw as Partial<Entry> | null;
  if (
    !e ||
    !isString(e.id) ||
    !isString(e.exerciseId) ||
    !isString(e.date) ||
    !isString(e.createdAt) ||
    !isFiniteNumber(e.weightKg) ||
    !isFiniteNumber(e.reps) ||
    (e.note !== undefined && typeof e.note !== 'string')
  ) {
    throw new Error(`Entry #${index + 1} in this file is invalid.`);
  }
  if (!exerciseIds.has(e.exerciseId)) {
    throw new Error(`Entry #${index + 1} references an unknown exercise.`);
  }
  const entry: Entry = {
    id: e.id,
    exerciseId: e.exerciseId,
    date: e.date,
    weightKg: e.weightKg,
    reps: e.reps,
    createdAt: e.createdAt,
  };
  if (e.note !== undefined) entry.note = e.note;
  return entry;
}

/**
 * Parse and validate an export JSON string.
 * Throws an Error with a user-readable message when the data is invalid.
 */
export function parseImport(json: string): { exercises: Exercise[]; entries: Entry[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  const data = raw as Partial<ExportData> | null;
  if (!data || typeof data !== 'object' || !Array.isArray(data.exercises) || !Array.isArray(data.entries)) {
    throw new Error('This file is not a PRTracker export.');
  }
  if (data.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${String(data.version)}.`);
  }

  const exercises = data.exercises.map(parseExercise);
  const exerciseIds = new Set(exercises.map((e) => e.id));
  const entries = data.entries.map((raw, index) => parseEntry(raw, index, exerciseIds));
  return { exercises, entries };
}
