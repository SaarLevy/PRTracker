import type { Entry, RepRecord } from '../types';

/** Entries ordered oldest→newest by date, breaking same-day ties by logging time. */
export function chronological(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) =>
    a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date),
  );
}

/** Best weight for each rep count achieved, sorted by reps ascending. */
export function computeRecords(entries: Entry[]): RepRecord[] {
  const bestByReps = new Map<number, Entry>();
  for (const entry of chronological(entries)) {
    const current = bestByReps.get(entry.reps);
    if (!current || entry.weightKg > current.weightKg) {
      bestByReps.set(entry.reps, entry);
    }
  }
  return [...bestByReps.values()]
    .map((e) => ({ reps: e.reps, weightKg: e.weightKg, entryId: e.id, date: e.date }))
    .sort((a, b) => a.reps - b.reps);
}

/** The heaviest entry overall; ties broken by more reps, then earliest. */
export function overallBest(entries: Entry[]): Entry | undefined {
  let best: Entry | undefined;
  for (const entry of chronological(entries)) {
    if (!best || entry.weightKg > best.weightKg || (entry.weightKg === best.weightKg && entry.reps > best.reps)) {
      best = entry;
    }
  }
  return best;
}

/** IDs of entries that set a PR at their rep count when they were logged. */
export function prEntryIds(entries: Entry[]): Set<string> {
  const ids = new Set<string>();
  const bestWeightByReps = new Map<number, number>();
  for (const entry of chronological(entries)) {
    const best = bestWeightByReps.get(entry.reps);
    if (best === undefined || entry.weightKg > best) {
      ids.add(entry.id);
      bestWeightByReps.set(entry.reps, entry.weightKg);
    }
  }
  return ids;
}
