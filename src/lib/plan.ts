import { type PlannedGroup, type PlannedSet, parseWod } from './parseWod';
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

function nextSet(previous: PlannedSet | undefined): PlannedSet {
  return { reps: previous?.reps ?? null, repsLabel: previous?.repsLabel ?? '', weightKg: null };
}

/**
 * Adds one set to every item in a group — one more set of a lone exercise, one more round of a
 * superset. They are the same operation because a lone exercise is a one-item group.
 *
 * The new set copies the rep prescription of the one before it but never its weight: a prefilled
 * weight would count as a finished set the moment you tapped "+". Ragged columns each grow by
 * one rather than being padded up to the longest, so one tap never adds two sets to a column.
 */
export function addRound(plan: Plan, groupIndex: number): Plan {
  if (!plan.groups[groupIndex]) return plan;
  const next = structuredClone(plan);
  for (const item of next.groups[groupIndex].items) item.sets.push(nextSet(item.sets.at(-1)));
  return next;
}

/** Drops one set from one item. Emptying an item is allowed — the "+" always brings one back. */
export function removeSet(plan: Plan, groupIndex: number, itemIndex: number, setIndex: number): Plan {
  const sets = plan.groups[groupIndex]?.items[itemIndex]?.sets;
  if (!sets || setIndex < 0 || setIndex >= sets.length) return plan;
  const next = structuredClone(plan);
  next.groups[groupIndex].items[itemIndex].sets.splice(setIndex, 1);
  return next;
}

/**
 * Whether a set holds work you would lose by deleting it.
 *
 * Only the weight counts. Rep counts arrive prefilled from the WOD, so they cannot tell a set you
 * did from one you have not started — and a set with no weight can never become an entry anyway.
 */
export function isSetFilled(set: PlannedSet): boolean {
  return set.weightKg !== null;
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
