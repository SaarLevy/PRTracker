import type { Entry } from '../types';
import { chronological } from './records';

export interface ProgressionPoint {
  /** YYYY-MM-DD, same format as Entry.date */
  date: string;
  value: number;
}

/** Groups chronological entries by date, reducing each day's entries to one point. */
function perDay(entries: Entry[], valueOf: (entry: Entry) => number): ProgressionPoint[] {
  const bestByDate = new Map<string, number>();
  for (const entry of chronological(entries)) {
    const value = valueOf(entry);
    const current = bestByDate.get(entry.date);
    if (current === undefined || value > current) {
      bestByDate.set(entry.date, value);
    }
  }
  return [...bestByDate.entries()].map(([date, value]) => ({ date, value }));
}

/** Epley-estimated one-rep max per entry, one point per day (the day's best estimate). */
export function estimatedOneRepMax(entries: Entry[]): ProgressionPoint[] {
  return perDay(entries, (e) => e.weightKg * (1 + e.reps / 30));
}

/** The heaviest weight logged each day. */
export function topWeightPerSession(entries: Entry[]): ProgressionPoint[] {
  return perDay(entries, (e) => e.weightKg);
}

/** Total weight×reps logged each day. */
export function sessionVolume(entries: Entry[]): ProgressionPoint[] {
  const totalByDate = new Map<string, number>();
  for (const entry of chronological(entries)) {
    const total = totalByDate.get(entry.date) ?? 0;
    totalByDate.set(entry.date, total + entry.weightKg * entry.reps);
  }
  return [...totalByDate.entries()].map(([date, value]) => ({ date, value }));
}

/** Reps achieved at a specific weight, one point per day (the day's best rep count at that weight). */
export function repsAtWeight(entries: Entry[], weightKg: number): ProgressionPoint[] {
  return perDay(
    entries.filter((e) => e.weightKg === weightKg),
    (e) => e.reps,
  );
}

/** Weights actually logged for this exercise, heaviest first, for the "reps @ weight" picker. */
export function distinctWeights(entries: Entry[]): number[] {
  return [...new Set(entries.map((e) => e.weightKg))].sort((a, b) => b - a);
}

export type ProgressionRange = '30d' | '90d' | '1y' | 'all';

const RANGE_DAYS: Record<Exclude<ProgressionRange, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

/** Trims a chronological point series to the given window ending on `today`. */
export function filterByRange(points: ProgressionPoint[], range: ProgressionRange, today: Date): ProgressionPoint[] {
  if (range === 'all') return points;
  const days = RANGE_DAYS[range];
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return points.filter((point) => {
    const [y, m, d] = point.date.split('-').map(Number);
    const pointDate = new Date(y, m - 1, d);
    const daysBack = Math.round((todayMidnight.getTime() - pointDate.getTime()) / 86_400_000);
    return daysBack < days;
  });
}
