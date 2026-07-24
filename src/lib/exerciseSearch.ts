import { EXERCISE_LIBRARY } from './exerciseLibrary';
import type { Exercise } from '../types';

export interface ExerciseSearchResult {
  existing: Exercise[];
  libraryOnly: string[];
  showAddLiteral: boolean;
}

function matchTier(name: string, query: string): 0 | 1 | 2 | -1 {
  const lower = name.toLowerCase();
  if (lower === query) return 0;
  if (lower.startsWith(query)) return 1;
  if (lower.includes(query)) return 2;
  return -1;
}

export function searchExercises(
  query: string,
  existing: Exercise[],
  library: readonly string[] = EXERCISE_LIBRARY,
  limit = 20,
): ExerciseSearchResult {
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  if (!trimmed) {
    return {
      existing: [...existing].sort((a, b) => a.name.localeCompare(b.name)),
      libraryOnly: [],
      showAddLiteral: false,
    };
  }

  const existingMatches = existing
    .filter((e) => e.name.toLowerCase().includes(lowerQuery))
    .sort((a, b) => a.name.localeCompare(b.name));

  const trackedNames = new Set(existing.map((e) => e.name.toLowerCase()));

  const libraryOnly = library
    .filter((name) => !trackedNames.has(name.toLowerCase()))
    .map((name) => ({ name, tier: matchTier(name, lowerQuery) }))
    .filter((entry) => entry.tier >= 0)
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => entry.name);

  const shownNames = new Set([
    ...existingMatches.map((e) => e.name.toLowerCase()),
    ...libraryOnly.map((name) => name.toLowerCase()),
  ]);
  const showAddLiteral = !shownNames.has(lowerQuery);

  return { existing: existingMatches, libraryOnly, showAddLiteral };
}
