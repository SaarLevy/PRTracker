import type { Entry, Exercise } from '../types';

/**
 * How the main exercise list is ordered.
 *
 * This is a UI preference rather than user data, so — like the workout plan — it lives in
 * localStorage and stays out of export/import.
 */
export type SortMode = 'recent' | 'alpha';

const STORAGE_KEY = 'prtracker.exerciseSort';

export function loadSortMode(): SortMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'alpha' || raw === 'recent' ? raw : 'recent';
  } catch {
    // Unavailable storage is indistinguishable from never having chosen a mode.
    return 'recent';
  }
}

export function saveSortMode(mode: SortMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * The createdAt of each exercise's newest entry, keyed by exercise id.
 *
 * Keyed on createdAt, not date: a set you enter today for last Tuesday still counts as touched
 * today, which is what "recently edited" means to the person who typed it.
 */
export function lastLoggedAt(entries: Entry[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const entry of entries) {
    const current = latest.get(entry.exerciseId);
    if (!current || entry.createdAt > current) latest.set(entry.exerciseId, entry.createdAt);
  }
  return latest;
}

/** Sorted copy of `exercises`; the input is left alone. */
export function sortExercises(
  exercises: Exercise[],
  mode: SortMode,
  logged: Map<string, string>,
): Exercise[] {
  const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name);
  if (mode === 'alpha') return [...exercises].sort(byName);

  // An exercise with no sets yet falls back to when it was added, so one you just picked from
  // the library sits at the top until you log against it.
  const recency = (e: Exercise) => logged.get(e.id) ?? e.createdAt;
  return [...exercises].sort((a, b) => recency(b).localeCompare(recency(a)) || byName(a, b));
}
