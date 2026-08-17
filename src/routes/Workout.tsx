import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BackIcon } from '../components/icons';
import { addEntry, addExercise, db } from '../db';
import type { PlannedSet } from '../lib/parseWod';
import { type Plan, clearPlan, collectEntries, loadPlan, planFromText, savePlan } from '../lib/plan';
import { type OcrProgress, ocrImage, takeSharedWod } from '../lib/shareImport';

const PLACEHOLDER = ['3 Super-sets', '8\\8 DB SL RDL', '15 Sit ups', '-', '3 Sets', '8-12 Deadlift'].join('\n');

// Module-level so StrictMode's double mount can't consume (and OCR) the same share twice;
// arriving via the share target always reloads the document, which resets this.
let shareChecked = false;

/** Exercises are matched to plan items by name, case- and whitespace-insensitively. */
const key = (name: string) => name.trim().toLowerCase();

interface SetBoxProps {
  set: PlannedSet;
  onChange: (patch: Partial<PlannedSet>) => void;
}

/**
 * One fillable set: a large weight field over a small reps field.
 *
 * Both are uncontrolled so a half-typed decimal like "62." survives the keystroke; the parsed
 * value is pushed up on every change. The size difference is deliberate — weight is the field
 * you tap between sets, and an equally sized neighbour is how you mis-tap it.
 */
function SetBox({ set, onChange }: SetBoxProps) {
  return (
    <div className="set-box">
      <input
        className="set-weight"
        type="text"
        inputMode="decimal"
        defaultValue={set.weightKg ?? ''}
        placeholder="kg"
        aria-label="Weight in kg"
        onChange={(event) => {
          const parsed = Number.parseFloat(event.target.value.replace(',', '.'));
          onChange({ weightKg: Number.isFinite(parsed) && parsed >= 0 ? parsed : null });
        }}
      />
      <input
        className="set-reps"
        type="text"
        inputMode="numeric"
        defaultValue={set.reps ?? ''}
        placeholder={set.repsLabel || 'reps'}
        aria-label="Reps"
        onChange={(event) => {
          const raw = event.target.value.trim();
          onChange({ reps: /^\d+$/.test(raw) ? Number(raw) : null });
        }}
      />
    </div>
  );
}

/**
 * An exercise name, linked to its history when the exercise is already tracked.
 *
 * Plan items are names, not ids — nothing is written to the database until finalize — so a
 * name with no match yet stays plain text, which is also exactly when there is no history
 * behind the link anyway.
 */
function ExerciseName({ name, exerciseId }: { name: string; exerciseId?: string }) {
  if (!exerciseId) return <span className="wod-item-name">{name}</span>;
  return (
    <Link href={`/exercise/${exerciseId}`} className="wod-item-name wod-item-link">
      {name}
    </Link>
  );
}

export default function Workout() {
  const [, navigate] = useLocation();
  const [plan, setPlan] = useState<Plan | null>(() => loadPlan());
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [importing, setImporting] = useState<OcrProgress | null>(null);

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const idByName = useMemo(
    () => new Map((exercises ?? []).map((exercise) => [exercise.name.trim().toLowerCase(), exercise.id])),
    [exercises],
  );

  useEffect(() => {
    if (shareChecked) return;
    shareChecked = true;

    void (async () => {
      const shared = await takeSharedWod();
      if (!shared) return;

      // A share replaces the plan wholesale; only ask when there is filled-in work to lose.
      const current = loadPlan();
      const touched = current?.groups.some((g) => g.items.some((i) => i.sets.some((s) => s.weightKg !== null)));
      if (touched && !confirm('Replace the current plan? Weights you filled in will be lost.')) return;

      let raw = shared.text ?? '';
      if (!raw && shared.image) {
        setImporting({ status: 'starting', progress: 0 });
        try {
          raw = await ocrImage(shared.image, setImporting);
        } catch {
          setFailed(true);
          return;
        } finally {
          setImporting(null);
        }
      }
      // On a parse failure the text stays in the textarea for hand-fixing.
      setText(raw);
      importText(raw);
    })();
  }, []);

  function importText(raw: string) {
    const next = planFromText(raw);
    if (!next) {
      setFailed(true);
      return;
    }
    savePlan(next);
    setPlan(next);
    setText('');
    setFailed(false);
    setExpanded(new Set());
  }

  function updateSet(groupIndex: number, itemIndex: number, setIndex: number, patch: Partial<PlannedSet>) {
    if (!plan) return;
    const next = structuredClone(plan);
    Object.assign(next.groups[groupIndex].items[itemIndex].sets[setIndex], patch);
    savePlan(next);
    setPlan(next);
  }

  function toggleGroup(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  function handleDiscard() {
    if (!confirm('Discard this plan? Any weights you filled in will be lost.')) return;
    clearPlan();
    setPlan(null);
  }

  async function handleFinalize() {
    if (!plan) return;
    const { ready, incomplete } = collectEntries(plan);

    if (ready.length === 0) {
      alert('Nothing to log yet — a set needs both a weight and a rep count.');
      return;
    }
    if (incomplete > 0) {
      const noun = incomplete === 1 ? 'set is' : 'sets are';
      if (!confirm(`${incomplete} ${noun} missing a weight or reps and won't be logged. Finalize anyway?`)) return;
    }

    const existing = await db.exercises.toArray();
    const idByName = new Map(existing.map((exercise) => [exercise.name.trim().toLowerCase(), exercise.id]));

    for (const entry of ready) {
      const key = entry.name.trim().toLowerCase();
      let exerciseId = idByName.get(key);
      if (!exerciseId) {
        exerciseId = await addExercise(entry.name);
        idByName.set(key, exerciseId);
      }
      await addEntry({ exerciseId, date: plan.date, weightKg: entry.weightKg, reps: entry.reps });
    }

    clearPlan();
    navigate('/');
  }

  if (importing) {
    const percent = Math.round(importing.progress * 100);
    return (
      <div className="screen screen-no-dock">
        <header className="top-bar">
          <Link href="/" className="icon-btn" aria-label="Back to exercises">
            <BackIcon />
          </Link>
          <h1 className="exercise-title">Workout</h1>
        </header>
        <p className="empty">
          <strong>Reading shared workout…</strong>
          <br />
          {importing.status} {percent}%
        </p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="screen screen-no-dock">
        <header className="top-bar">
          <Link href="/" className="icon-btn" aria-label="Back to exercises">
            <BackIcon />
          </Link>
          <h1 className="exercise-title">Workout</h1>
        </header>

        <p className="empty">
          <strong>No plan loaded.</strong>
          <br />
          Paste the workout text below to turn it into a set-by-set sheet you can fill in as you train.
        </p>

        <textarea
          className="wod-textarea"
          rows={10}
          value={text}
          placeholder={PLACEHOLDER}
          aria-label="Workout text"
          onChange={(event) => {
            setText(event.target.value);
            setFailed(false);
          }}
        />
        {failed && <p className="msg msg-error">No sets found in that text.</p>}

        <button
          type="button"
          className="btn btn-primary wod-load"
          disabled={!text.trim()}
          onClick={() => importText(text)}
        >
          Load plan
        </button>
      </div>
    );
  }

  const readyCount = collectEntries(plan).ready.length;

  return (
    <div className="screen screen-wod">
      <header className="top-bar">
        <Link href="/" className="icon-btn" aria-label="Back to exercises">
          <BackIcon />
        </Link>
        <h1 className="exercise-title">Workout</h1>
        <button type="button" className="btn btn-ghost btn-small" onClick={handleDiscard}>
          Discard
        </button>
      </header>

      <div key={plan.createdAt}>
        {plan.groups.map((group, groupIndex) => {
          const sets = group.items.flatMap((item) => item.sets);
          const done = sets.every((set) => set.weightKg !== null);
          const open = !done || expanded.has(groupIndex);

          return (
            <section key={groupIndex} className="wod-group">
              <button type="button" className="wod-group-head" onClick={() => toggleGroup(groupIndex)}>
                <span className="section-label">{group.label}</span>
                {done && <span className="wod-group-state">{open ? 'hide' : 'done'}</span>}
              </button>

              {open && group.items.length === 1 && (
                <div className="wod-item">
                  <div className="wod-item-head">
                    <ExerciseName name={group.items[0].name} exerciseId={idByName.get(key(group.items[0].name))} />
                    {group.items[0].hint && <span className="wod-item-hint">{group.items[0].hint}</span>}
                  </div>
                  <div className="wod-sets">
                    {group.items[0].sets.map((set, setIndex) => (
                      <SetBox
                        key={setIndex}
                        set={set}
                        onChange={(patch) => updateSet(groupIndex, 0, setIndex, patch)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Two or more exercises means you alternate between them, so a round reads across:
                  one column per exercise, one row per round. */}
              {open && group.items.length > 1 && (
                <div
                  className="wod-grid"
                  style={{ gridTemplateColumns: `18px repeat(${group.items.length}, minmax(0, 1fr))` }}
                >
                  <span />
                  {group.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="wod-grid-head">
                      <ExerciseName name={item.name} exerciseId={idByName.get(key(item.name))} />
                      {item.hint && <span className="wod-item-hint">{item.hint}</span>}
                    </div>
                  ))}

                  {Array.from({ length: Math.max(...group.items.map((item) => item.sets.length)) }, (_, round) => (
                    <Fragment key={round}>
                      <span className="wod-round-index" aria-hidden="true">
                        {round + 1}
                      </span>
                      {group.items.map((item, itemIndex) =>
                        item.sets[round] ? (
                          <SetBox
                            key={itemIndex}
                            set={item.sets[round]}
                            onChange={(patch) => updateSet(groupIndex, itemIndex, round, patch)}
                          />
                        ) : (
                          <span key={itemIndex} />
                        ),
                      )}
                    </Fragment>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="dock">
        <button type="button" className="btn btn-primary btn-log" onClick={() => void handleFinalize()}>
          Finalize workout{readyCount > 0 ? ` · ${readyCount} set${readyCount === 1 ? '' : 's'}` : ''}
        </button>
      </div>
    </div>
  );
}
