import { aliasKey, expandWords } from './exerciseAliases';
import { EXERCISE_LIBRARY } from './exerciseLibrary';
import type { Exercise } from '../types';

export interface ExerciseSearchResult {
  existing: Exercise[];
  libraryOnly: string[];
  showAddLiteral: boolean;
}

interface SearchQuery {
  lower: string;
  /** The query with shorthand spelled out; see `aliasKey`. Empty when nothing in it is a word. */
  key: string;
  words: string[];
}

/**
 * How well a name answers a query, best first, or -1 for not at all.
 *
 * Each tier holds for the name as typed or once shorthand is spelled out, so "rdl" is an exact
 * match for Romanian Deadlift. The last tier lets the words land anywhere in any order: "db rdl"
 * finds "DB SL RDL". The as-typed check stays because a half-typed plural ("crunche") only
 * matches before it is singularized.
 */
function matchTier(name: string, query: SearchQuery): 0 | 1 | 2 | 3 | -1 {
  const lower = name.toLowerCase();
  const key = aliasKey(name);
  const hasKey = query.key !== '';
  if (lower === query.lower || (hasKey && key === query.key)) return 0;
  if (lower.startsWith(query.lower) || (hasKey && key.startsWith(query.key))) return 1;
  if (lower.includes(query.lower) || (hasKey && key.includes(query.key))) return 2;
  if (hasKey && query.words.every((word) => key.includes(word))) return 3;
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

/**
 * Matches a query against tracked exercises and the built-in library.
 *
 * Matching only: `existing` comes back in the order it was passed. Ordering the tracked list is
 * the caller's job (see `sortExercises`), so the user's chosen sort applies while searching too.
 */
export function searchExercises(
  query: string,
  existing: Exercise[],
  library: readonly string[] = EXERCISE_LIBRARY,
  limit = 20,
): ExerciseSearchResult {
  const trimmed = query.trim();

  if (!trimmed) {
    return { existing, libraryOnly: [], showAddLiteral: false };
  }

  const words = expandWords(trimmed);
  const search: SearchQuery = { lower: trimmed.toLowerCase(), key: words.join(''), words };

  const existingMatches = existing.filter((e) => matchTier(e.name, search) >= 0);

  // Keyed through shorthand, so tracking "RDL" hides the library's Romanian Deadlift.
  const trackedKeys = new Set(existing.map((e) => aliasKey(e.name)));

  const libraryOnly = library
    .filter((name) => !trackedKeys.has(aliasKey(name)))
    .map((name) => ({ name, tier: matchTier(name, search) }))
    .filter((entry) => entry.tier >= 0)
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => entry.name);

  // "Add DB RDL" next to a tracked Dumbbell Romanian Deadlift would only make a duplicate.
  const shownKeys = new Set([...existingMatches.map((e) => aliasKey(e.name)), ...libraryOnly.map(aliasKey)]);
  const showAddLiteral = !shownKeys.has(search.key);

  return { existing: existingMatches, libraryOnly, showAddLiteral };
}
