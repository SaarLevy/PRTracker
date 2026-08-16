import { type PlannedGroup, parseWod } from './parseWod';
import { toISODay } from './format';

/**
 * The one workout plan currently being filled in.
 *
 * Plans are scratch state, not history — only the sets you finalize become entries — so this
 * lives in localStorage rather than the database. Nothing here needs to survive an export.
 */
export interface Plan {
  /** YYYY-MM-DD the plan is for; used as the date on every entry it produces. */
  date: string;
  /** Import timestamp, used to tell one plan from another. */
  createdAt: string;
  groups: PlannedGroup[];
}

export interface PlannedEntry {
  name: string;
  weightKg: number;
  reps: number;
}

const STORAGE_KEY = 'prtracker.plan';

export function loadPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Plan) : null;
  } catch {
    // Corrupt JSON or unavailable storage is indistinguishable from having no plan.
    return null;
  }
}

export function savePlan(plan: Plan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function clearPlan(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Builds a plan for today out of raw workout text, or null if no sets could be read. */
export function planFromText(text: string, now = new Date()): Plan | null {
  const groups = parseWod(text);
  if (groups.length === 0) return null;
  return { date: toISODay(now), createdAt: now.toISOString(), groups };
}

/**
 * Imports a `?plan=` query param, if present, and sends the app to the workout screen.
 *
 * This runs before rendering rather than inside the route because routing lives in the hash:
 * a query inside the hash becomes part of the path and matches nothing. Keeping it in the real
 * query string also means any entry point — a share target, a phone shortcut, a pasted link —
 * can land on any URL and still end up with a loaded plan.
 */
export function consumeSharedPlan(): void {
  const text = new URLSearchParams(window.location.search).get('plan');
  if (text === null) return;

  const plan = planFromText(text);
  if (plan) savePlan(plan);

  // Drop the param either way, so a refresh cannot re-import over weights already filled in.
  const { origin, pathname } = window.location;
  window.history.replaceState(null, '', `${origin}${pathname}#/workout`);
}

/**
 * Splits a plan into the sets that can be logged and a count of the half-filled ones.
 *
 * A set needs both a weight and a rep count to become an entry, and rep counts are
 * deliberately left blank for ranges and "Max", so finalizing can warn rather than
 * silently drop the sets you meant to record.
 */
export function collectEntries(plan: Plan): { ready: PlannedEntry[]; incomplete: number } {
  const ready: PlannedEntry[] = [];
  let incomplete = 0;

  for (const group of plan.groups) {
    for (const item of group.items) {
      for (const set of item.sets) {
        const hasWeight = set.weightKg !== null;
        const hasReps = set.reps !== null && set.reps >= 1;
        if (hasWeight && hasReps) ready.push({ name: item.name, weightKg: set.weightKg!, reps: set.reps! });
        else if (hasWeight || hasReps) incomplete += 1;
      }
    }
  }

  return { ready, incomplete };
}
