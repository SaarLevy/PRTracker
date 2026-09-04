# Exercise list sort: Recent or A–Z

## Problem

The main screen lists tracked exercises in one fixed order — alphabetical, applied inside
`searchExercises`. There is no way to see what you have been training lately, which is the
ordering you want mid-workout: the lift you are about to log is usually one you logged recently.

## Goal

Let the user order the main exercise list either by recent activity or alphabetically, switch
between the two in one tap, and have the choice persist across sessions.

## Decisions

**"Recently edited" means when a set was logged, not the date it was logged for.** The recency key
is `Entry.createdAt`, not `Entry.date`. A set you enter today for last Tuesday still moves its
exercise to the top, because you touched it today. Sorting on `date` would bury backdated work.

**Renames do not count as activity.** Tracking them would require an `updatedAt` field on
`Exercise`, a Dexie version bump, and a change to every write path. Sets are what the ordering is
about; a rename is not training.

**The sort mode is a UI preference, not user data.** It lives in `localStorage`, following the
precedent set by `plan.ts`, so it stays out of export/import.

**The mode applies to search results too.** The toggle reads as "how this list is ordered". Having
it silently stop applying the moment you type is an inconsistency the user would notice and could
not explain.

## Sorting logic

New module `src/lib/exerciseSort.ts`, alongside the other pure-logic modules:

```ts
export type SortMode = 'recent' | 'alpha';

/** Newest entry createdAt per exercise id. */
export function lastLoggedAt(entries: Entry[]): Map<string, string>;

export function sortExercises(
  exercises: Exercise[],
  mode: SortMode,
  logged: Map<string, string>,
): Exercise[];

export function loadSortMode(): SortMode;
export function saveSortMode(mode: SortMode): void;
```

Each exercise gets one comparable ISO timestamp: the newest `createdAt` among its entries, falling
back to the exercise's own `createdAt` when it has none. An exercise just added from the library
therefore sits at the top until something is logged against it — which is what the user wants,
since they added it because they are about to use it.

- `alpha`: `name.localeCompare(other.name)`.
- `recent`: recency key descending, then `name.localeCompare` as the tiebreak.

The name tiebreak makes both orderings total, so the list does not reshuffle between renders.
Both modes return a new array; neither mutates its input.

`loadSortMode` wraps the read in try/catch and validates against the two known values. Missing,
corrupt, or unrecognized values return `'recent'`. Storage can be unavailable (private mode,
blocked site data), and a bad read must not take the list screen down.

Storage key: `prtracker.exerciseSort`.

## Where the sort is applied

`searchExercises` currently sorts `existing` alphabetically itself. That sort moves out: it becomes
matching-only and returns matches in input order. `ExerciseList` applies `sortExercises` to
`results.existing` for both the empty-query and the search case.

This keeps one sort in one place instead of two functions each holding an opinion about ordering,
and it is what makes the toggle apply to search results.

`libraryOnly` keeps its existing tier ranking (exact, then prefix, then substring) inside
`searchExercises`, untouched — untracked names have no recency to sort by.

Four or five assertions in `exerciseSearch.test.ts` currently lean on the alphabetical sort. They
are updated to expect input order, and the alphabetical behavior is asserted in
`exerciseSort.test.ts`, where it now lives.

## The control

A two-button segmented toggle between `.top-bar` and `.exercise-rows`:

```
┌──────────────────────────────┐
│  [ Recent ]     A–Z          │
└──────────────────────────────┘
```

- State: `useState<SortMode>(loadSortMode)`. The lazy initializer reads storage once on mount
  rather than on every render. The setter also calls `saveSortMode`.
- Markup: a `div role="group"` containing two `<button>`s with `aria-pressed`, so the active mode
  is announced and not conveyed by color alone.
- Styling: new `.sort-toggle` rules following the existing pill/chip styling in `index.css`.
- Visibility: shown only when there are at least two tracked exercises. Below that there is nothing
  to order, and this keeps the control off the first-run screen, where the empty-state copy should
  be the only thing competing for attention.

## Data flow

`ExerciseList` already loads both `db.exercises.toArray()` and `db.entries.toArray()` via
`useLiveQuery`, so no new query is needed.

1. `entries` → `lastLoggedAt(entries)`, memoized on `entries`.
2. `searchExercises(query, exercises)` → matches in input order.
3. `sortExercises(results.existing, mode, logged)`, memoized on those three inputs.
4. Rows render unchanged.

## Error handling

The only failure mode is `localStorage` being unavailable or holding garbage, handled by
`loadSortMode` returning `'recent'`. `saveSortMode` failing is not caught: a preference that fails
to persist is not worth a code path, and the in-memory state still works for the session.

## Tests

`src/lib/exerciseSort.test.ts` (vitest, matching the style of the existing `lib` tests):

- alpha mode sorts by name, case-insensitively
- recent mode puts the most recently logged exercise first
- an exercise whose only entry is backdated still sorts by when it was logged
- an exercise with no entries falls back to its own `createdAt`
- equal timestamps break the tie by name
- inputs are not mutated
- `loadSortMode` returns `'recent'` for missing, corrupt, and unrecognized stored values

The toggle itself is not tested: the project has no component-test setup, and adding one for a
two-button toggle is not worth the dependency.

## Out of scope

- Any schema change or Dexie version bump.
- Sorting the library suggestions or the workout screen.
- Additional sort modes (most sets, heaviest, custom order).
