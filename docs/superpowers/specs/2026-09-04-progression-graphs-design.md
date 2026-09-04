# Per-exercise progression graphs

## Problem

The exercise detail page shows `RecordsPanel` (best weight per rep count) and `HistoryList` (every
set, newest first). Both are useful but static — neither shows the *shape* of progress over time.
There's no way to see a lift trending up, plateauing, or answer "was I actually stronger three
months ago at this rep range?" without mentally scanning the history list.

## Goal

Add a progression chart to the exercise detail page: pick a metric, pick a time range, see a line.
No new dependency, and the existing Records/History view stays exactly as it is today.

## Decisions

**A new "Progress" tab, next to a renamed "Records" tab.** The current page content (RecordsPanel
+ HistoryList + log form) becomes the "Records" tab, unchanged. "Progress" is new and empty until
selected — nobody who ignores this feature sees any difference.

**Four metrics, switchable, not one fixed chart:**
- **Est. 1RM** — Epley estimate (`weightKg * (1 + reps / 30)`) per entry, one point per day (the
  day's max estimate, since both weight and reps vary entry to entry).
- **Top weight** — the heaviest `weightKg` logged each day.
- **Volume** — `weightKg * reps` summed across a day's entries.
- **Reps @ weight** — pick a weight you've actually logged (dropdown, populated from that
  exercise's own entries) and plot reps at that exact weight over time. This is the one metric
  that needs an extra control, so the dropdown only appears when it's selected.

Est. 1RM is the default on first opening the tab — it's the one metric that's comparable across
sessions with different rep counts, so it's the most likely to show a clean trend immediately.

**Time range presets: 30d / 90d / 1y / All.** No custom date picker — four buttons is enough
resolution for a personal tracker and keeps the control bar simple. Selection is local component
state, not persisted — reopening the tab always starts at Est. 1RM / All.

**Hand-rolled SVG chart, no charting library.** Data volume is small (a personal tracker; hundreds
of points per exercise at most), so there's no performance case for a library, and a custom
component matches the app's existing hand-rolled, dependency-free style (no UI framework is used
anywhere else in the app) better than adopting a library's own look and bundle weight.

**Sparse-data states, not a broken chart:**
- 0 entries in range → empty state, "Log some sets to see progress" (0 total) or "No data in this
  range" (range excludes existing history).
- 1 point in range → render the single point, no line. A line through one point is either invisible
  or misleadingly flat.

## Logic

New `src/lib/progression.ts`, pure functions over an `Entry[]`, parallel in spirit to
`src/lib/records.ts` and built on its `chronological`:

```ts
export interface ProgressionPoint {
  date: string; // YYYY-MM-DD, same format as Entry.date
  value: number;
}

export function estimatedOneRepMax(entries: Entry[]): ProgressionPoint[];
export function topWeightPerSession(entries: Entry[]): ProgressionPoint[];
export function sessionVolume(entries: Entry[]): ProgressionPoint[];
export function repsAtWeight(entries: Entry[], weightKg: number): ProgressionPoint[];

/** Weights actually logged for this exercise, descending, for the "Reps @ weight" picker. */
export function distinctWeights(entries: Entry[]): number[];

export type ProgressionRange = '30d' | '90d' | '1y' | 'all';

/** Trims a chronological point series to the given window ending today. */
export function filterByRange(points: ProgressionPoint[], range: ProgressionRange, today: Date): ProgressionPoint[];
```

All four series functions group same-day entries down to one point (max value for that day) —
consistent with how `computeRecords` already treats "best for X" per key. `filterByRange` takes
`today` as a parameter (not `new Date()` internally) so it stays deterministic and testable, the
same reason `timeAgo`/`formatDay` in `src/lib/format.ts` take a `now`/`now` argument.

## Components

- **`src/components/ProgressSection.tsx`** — owns the local state (selected metric, selected
  range, selected weight for "Reps @ weight"), reads `entries` (passed in from `ExerciseDetail`,
  same as `RecordsPanel`/`HistoryList` already receive), computes the active series via
  `progression.ts`, and renders the metric switcher, the conditional weight dropdown, the range
  buttons, and `ProgressChart`. Follows `RecordsPanel`'s pattern of a stateless-except-props
  component reading already-fetched data, not touching Dexie itself.
- **`src/components/ProgressChart.tsx`** — the SVG line chart: gridlines, a polyline (or a single
  circle when there's exactly one point), a hover/tap tooltip showing `formatDay` + the value
  (`formatWeightKg` for weight-based metrics, plain integer for reps/volume). Responsive width via
  `ResizeObserver` on a wrapping `div`; fixed height. Empty-state rendering (0 or 1-filtered points)
  lives here since it's purely a function of the series it's given.

## `ExerciseDetail.tsx` changes

Add tab state (`'records' | 'progress'`, default `'records'`) and a small tab-switcher control in
the header area. Wrap the existing `<RecordsPanel>` + `<HistoryList>` block in the `'records'`
branch, unchanged. Add `<ProgressSection entries={chrono} />` in the `'progress'` branch — reuses
the `chrono` memo that already exists for `RecordsPanel`. The log form (`LogBar`) stays visible
regardless of tab, matching how it isn't part of either "view" conceptually.

## Tests

`src/lib/progression.test.ts`, following `records.test.ts`'s `entry()` fixture-factory style:
- Each series function: empty input → `[]`; multiple entries on one day collapse to one point
  (max value); multiple days produce one point per day in chronological order.
- `estimatedOneRepMax`: formula check against a known weight/reps pair.
- `repsAtWeight`: entries at other weights are excluded.
- `distinctWeights`: dedups and sorts descending.
- `filterByRange`: boundary cases for each preset (a point exactly `today`, one just inside/outside
  a window) using an injected `today`, plus `'all'` returning everything unfiltered.

`ProgressChart`/`ProgressSection` are not unit tested — this project has no component-test setup
(consistent with `plan.test.ts`'s note that gesture/UI code is verified by hand), so these are
checked manually in the dev server: cycling all four metrics, all four ranges, the weight dropdown,
and the 0-entry/1-entry/range-excludes-all empty states.

## Out of scope

- Any cross-exercise or overall dashboard (workout frequency, streaks, total volume across all
  exercises) — a separate, later effort.
- Zooming, panning, or a custom date-range picker beyond the four presets.
- Persisting the selected metric/range/weight across visits.
- Any change to `types.ts`, `db.ts`, or the Dexie schema — this feature only reads existing
  `Entry` data.
