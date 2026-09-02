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

function bigramSet(value: string): Set<string> {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) grams.add(normalized.slice(i, i + 2));
  return grams;
}

/**
 * The closest candidate to a name, or null when nothing is convincingly close.
 *
 * Character-bigram Dice similarity: tolerant of typos and word reordering — the two ways
 * OCR and gym-app shorthand actually mangle an exercise name — with no dependency.
 * Used for "did you mean" on import, so a wrong suggestion costs a glance, nothing more.
 */
export function suggestSimilar(name: string, candidates: string[]): string | null {
  const target = bigramSet(name);
  if (target.size === 0) return null;

  let best: string | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const grams = bigramSet(candidate);
    let shared = 0;
    for (const gram of grams) if (target.has(gram)) shared++;
    const score = (2 * shared) / (target.size + grams.size);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  // ponytail: fixed 0.5 threshold, tune only if real WODs prove it too chatty or too shy.
  return bestScore >= 0.5 ? best : null;
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
