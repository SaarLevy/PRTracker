/**
 * Parses the plain-text workout-of-the-day a gym app produces into a fillable plan.
 *
 * The format is human-written and inconsistent, so the parser only extracts what it is
 * confident about — group boundaries, exercise names, and a prefillable rep count where
 * one exists. Anything it does not recognise is passed through verbatim as a label, which
 * degrades to "type the number yourself" rather than a failed import.
 */

export interface PlannedSet {
  /** Prefill for the reps input, or null when the WOD only gave a range or "Max". */
  reps: number | null;
  /** The rep token exactly as written: "8", "8\\8", "8-12", "Max". Shown as label or placeholder. */
  repsLabel: string;
  weightKg: number | null;
}

export interface PlannedItem {
  name: string;
  /** Intensity note from the WOD, e.g. "@90%". Display only. */
  hint?: string;
  sets: PlannedSet[];
}

export interface PlannedGroup {
  /** As written: "Super-sets", "Drop sets", "E3MOM x 6 Rounds". A label, not semantics. */
  label: string;
  items: PlannedItem[];
}

/** A line of only dashes, used as a separator in some WODs and dropped by OCR in others. */
const SEPARATOR = /^[-–—_]+$/;

/** Trailing parenthetical on a group header, e.g. "3 Triple-sets (10min)". */
const PARENTHETICAL = /\([^)]*\)/g;

/** The qualifier words seen in the wild. Any of them, "sets", or both, is a group header. */
const QUALIFIER = /^(?:(super|triple|drop|giant|quad)[-\s]*)?(sets?)?$/i;

/** "E3MOM x 6 Rounds", "EMOM x 10 rounds". */
const ROUNDS_HEADER = /^E\d*MOM\s*x\s*(\d+)\s+rounds?$/i;

/** Trailing intensity note, e.g. "@90%". */
const HINT = /\s*(@\s*\d+\s*%)$/;

/** A standalone rep ladder such as "12-8-4-4-8-12". Three or more values, so "8-12" stays a range. */
const REP_SCHEME = /^\d+(?:-\d+){2,}$/;

/** "3 Super-sets", "4 Sets", "3 Triple-sets (10min)", "4 Super". */
function parseSetsHeader(line: string): { rounds: number; label: string } | null {
  const match = /^(\d+)\s+(.+)$/.exec(line);
  if (!match) return null;

  const rest = match[2].replace(PARENTHETICAL, '').trim();
  const qualifier = QUALIFIER.exec(rest);
  // Both groups optional, so an empty `rest` would match; require at least one to be present.
  if (!qualifier || (!qualifier[1] && !qualifier[2])) return null;

  return { rounds: Number(match[1]), label: match[2].trim() };
}

function parseRoundsHeader(line: string): { rounds: number; label: string } | null {
  const match = ROUNDS_HEADER.exec(line);
  return match ? { rounds: Number(match[1]), label: line } : null;
}

/**
 * A leading token counts as reps if it carries a digit or is the word "Max". That keeps
 * unknown notations splitting correctly ("3x5+ Thrusters") while letting a bare exercise
 * name line ("Back squat") through untouched.
 */
function isRepToken(token: string): boolean {
  return /\d/.test(token) || /^max$/i.test(token);
}

/** Only unambiguous tokens prefill; a range or "Max" is not known until the set is done. */
function prefillReps(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  const perSide = /^(\d+)[\\/]\d+$/.exec(token);
  return perSide ? Number(perSide[1]) : null;
}

function parseItemLine(line: string): { name: string; hint?: string; reps: number | null; repsLabel: string } {
  const hintMatch = HINT.exec(line);
  const hint = hintMatch ? hintMatch[1].replace(/\s+/g, '') : undefined;
  const withoutHint = hintMatch ? line.slice(0, hintMatch.index).trim() : line;

  const split = /^(\S+)\s+(.+)$/.exec(withoutHint);
  if (!split || !isRepToken(split[1])) {
    return { name: withoutHint, hint, reps: null, repsLabel: '' };
  }
  return { name: split[2].trim(), hint, reps: prefillReps(split[1]), repsLabel: split[1] };
}

/**
 * A line that is only a rep token plus an optional hint — "4-6 @90%", "Max @50%" — is a
 * drop-set stage of the exercise named above it, not an exercise of its own.
 */
function parseBareReps(line: string): { reps: number | null; repsLabel: string; hint?: string } | null {
  const hintMatch = HINT.exec(line);
  const token = (hintMatch ? line.slice(0, hintMatch.index) : line).trim();
  if (!token || /\s/.test(token) || !isRepToken(token)) return null;

  const hint = hintMatch ? hintMatch[1].replace(/\s+/g, '') : undefined;
  return { reps: prefillReps(token), repsLabel: token, ...(hint ? { hint } : {}) };
}

function makeSets(count: number, reps: number | null, repsLabel: string): PlannedSet[] {
  return Array.from({ length: count }, () => ({ reps, repsLabel, weightKg: null }));
}

export function parseWod(text: string): PlannedGroup[] {
  const groups: PlannedGroup[] = [];
  let current: PlannedGroup | null = null;
  let rounds = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || SEPARATOR.test(line)) continue;

    const header = parseSetsHeader(line) ?? parseRoundsHeader(line);
    if (header) {
      current = { label: header.label, items: [] };
      rounds = header.rounds;
      groups.push(current);
      continue;
    }

    // Anything before the first header is a section title such as "Strength".
    if (!current) continue;

    const previous = current.items.at(-1);
    if (REP_SCHEME.test(line) && previous) {
      // A ladder under a named exercise: one set per value, replacing the placeholder sets.
      previous.sets = line.split('-').map((value) => ({
        reps: Number(value),
        repsLabel: value,
        weightKg: null,
      }));
      continue;
    }

    const stage = parseBareReps(line);
    if (stage && previous) {
      // The first stage fills in the bare exercise name above; later ones become
      // sibling columns of the same exercise.
      if (previous.sets.every((set) => set.repsLabel === '')) {
        previous.sets = makeSets(rounds, stage.reps, stage.repsLabel);
        if (stage.hint) previous.hint = stage.hint;
      } else {
        current.items.push({
          name: previous.name,
          ...(stage.hint ? { hint: stage.hint } : {}),
          sets: makeSets(rounds, stage.reps, stage.repsLabel),
        });
      }
      continue;
    }

    const { name, hint, reps, repsLabel } = parseItemLine(line);
    current.items.push({ name, ...(hint ? { hint } : {}), sets: makeSets(rounds, reps, repsLabel) });
  }

  return groups.filter((group) => group.items.length > 0);
}
