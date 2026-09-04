import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BackIcon } from '../components/icons';
import { addEntry, addExercise, db } from '../db';
import { suggestSimilar } from '../lib/exerciseSearch';
import { type PlannedSet, parseWod } from '../lib/parseWod';
import {
  type Plan,
  addRound,
  clearPlan,
  collectEntries,
  isSetFilled,
  loadPlan,
  planFromText,
  removeSet,
  savePlan,
} from '../lib/plan';
import { type OcrProgress, ocrImage, takeSharedWod } from '../lib/shareImport';

const PLACEHOLDER = ['3 Super-sets', '8\\8 DB SL RDL', '15 Sit ups', '-', '3 Sets', '8-12 Deadlift'].join('\n');

// Module-level so StrictMode's double mount can't consume (and OCR) the same share twice;
// arriving via the share target always reloads the document, which resets this.
let shareChecked = false;

/** Exercises are matched to plan items by name, case- and whitespace-insensitively. */
const key = (name: string) => name.trim().toLowerCase();

/** One box's address, flat enough to compare with === so the reveal is a single piece of state. */
const cell = (groupIndex: number, itemIndex: number, setIndex: number) => `${groupIndex}:${itemIndex}:${setIndex}`;

/**
 * Long enough not to fire while a finger settles before typing, short enough to beat the OS's
 * own text-selection gesture to the punch.
 */
const LONG_PRESS_MS = 400;

/** A press that slides this far is the start of a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 8;

interface SetBoxProps {
  set: PlannedSet;
  onChange: (patch: Partial<PlannedSet>) => void;
  /** Whether this box is the one showing its "−". At most one box on screen is. */
  revealed: boolean;
  onReveal: () => void;
  onRemove: () => void;
  removeLabel: string;
}

/**
 * One fillable set: a large weight field over a small reps field.
 *
 * Both are uncontrolled so a half-typed decimal like "62." survives the keystroke; the parsed
 * value is pushed up on every change. The size difference is deliberate — weight is the field
 * you tap between sets, and an equally sized neighbour is how you mis-tap it.
 *
 * A long press reveals the button that removes the set. The press is only watched, never
 * swallowed — nothing here calls preventDefault, so a normal tap still lands on the input,
 * places the caret and raises the keyboard. The native text loupe that would otherwise eat the
 * gesture is held off in CSS, which drops `user-select` on an input until it is focused.
 */
function SetBox({ set, onChange, revealed, onReveal, onRemove, removeLabel }: SetBoxProps) {
  const timer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  function cancel() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  // A press that outlives its box — the tree remounts on a removal — must not fire on the set
  // that took its place.
  useEffect(() => cancel, []);

  return (
    <div
      className="set-box"
      onPointerDown={(event) => {
        origin.current = { x: event.clientX, y: event.clientY };
        cancel();
        timer.current = window.setTimeout(onReveal, LONG_PRESS_MS);
      }}
      onPointerMove={(event) => {
        const { x, y } = origin.current;
        if (Math.hypot(event.clientX - x, event.clientY - y) > MOVE_TOLERANCE_PX) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      // Right-click is the way in with a mouse — and with a keyboard, since Shift+F10 raises a
      // context menu on the focused input. Pre-empting the menu also stops Android opening its
      // own selection popup under a held finger.
      onContextMenu={(event) => {
        event.preventDefault();
        onReveal();
      }}
    >
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
      {revealed && (
        <button type="button" className="set-remove" aria-label={removeLabel} onClick={onRemove}>
          −
        </button>
      )}
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
  // Only OCR failures need a flag; parse feedback is live via the preview.
  const [failed, setFailed] = useState(false);
  const preview = useMemo(() => parseWod(text), [text]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());
  const [importing, setImporting] = useState<OcrProgress | null>(null);
  // The one set box showing its remove button, as a `cell` address.
  const [revealed, setRevealed] = useState<string | null>(null);
  // Bumped when a set is removed. The set inputs are uncontrolled, so they read the plan once,
  // when they mount: without this, deleting set 2 leaves set 3 — and the red "filled" border on
  // it — still showing set 2's weight. Same escape hatch as the plan timestamp it sits beside.
  const [removals, setRemovals] = useState(0);

  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const idByName = useMemo(
    () => new Map((exercises ?? []).map((exercise) => [exercise.name.trim().toLowerCase(), exercise.id])),
    [exercises],
  );
  const exerciseNames = useMemo(() => (exercises ?? []).map((exercise) => exercise.name), [exercises]);

  useEffect(() => {
    if (revealed === null) return;

    // Any press that is not on the "−" itself puts the box back, including the press that begins
    // a scroll — which is what keeps this a transient reveal rather than an edit mode. The
    // `closest` guard is load-bearing: without it the button unmounts before its own click fires.
    function dismiss(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.set-remove')) return;
      setRevealed(null);
    }

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [revealed]);

  useEffect(() => {
    if (shareChecked) return;
    shareChecked = true;

    void (async () => {
      const shared = await takeSharedWod();
      if (!shared) return;

      // A share replaces the plan wholesale; only ask when there is filled-in work to lose.
      const current = loadPlan();
      const touched = current?.groups.some((g) => g.items.some((i) => i.sets.some(isSetFilled)));
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
      // Land in the review screen instead of importing directly, so OCR mistakes can be
      // fixed in the text before the plan is built.
      clearPlan();
      setPlan(null);
      setText(raw);
    })();
  }, []);

  function importText(raw: string) {
    const next = planFromText(raw);
    if (!next) return;
    savePlan(next);
    setPlan(next);
    setText('');
    setCollapsed(new Set());
    setRevealed(null);
    setRemovals(0);
  }

  function updateSet(groupIndex: number, itemIndex: number, setIndex: number, patch: Partial<PlannedSet>) {
    if (!plan) return;
    const next = structuredClone(plan);
    Object.assign(next.groups[groupIndex].items[itemIndex].sets[setIndex], patch);
    savePlan(next);
    setPlan(next);
  }

  function handleAddRound(groupIndex: number) {
    if (!plan) return;
    const next = addRound(plan, groupIndex);
    savePlan(next);
    setPlan(next);
  }

  function handleRemoveSet(groupIndex: number, itemIndex: number, setIndex: number) {
    if (!plan) return;
    const set = plan.groups[groupIndex]?.items[itemIndex]?.sets[setIndex];
    if (!set) return;
    // Same rule as the share import and the discard button: only stop you when there is work to lose.
    if (isSetFilled(set) && !confirm('Remove this set? The weight you entered will be lost.')) return;

    const next = removeSet(plan, groupIndex, itemIndex, setIndex);
    savePlan(next);
    setPlan(next);
    // Not cosmetic: the address would otherwise point at whichever set slid up into the gap.
    setRevealed(null);
    setRemovals((count) => count + 1);
  }

  function toggleGroup(index: number) {
    setCollapsed((prev) => {
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
          Paste the workout text below. The preview shows how it will be read — edit the text until it looks
          right, then load.
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
        {failed && <p className="msg msg-error">Could not read text from the shared image.</p>}
        {text.trim() !== '' && preview.length === 0 && <p className="msg msg-error">No sets found in that text.</p>}

        {preview.length > 0 && (
          <div className="wod-preview" aria-label="Import preview">
            {preview.map((group, groupIndex) => (
              <section key={groupIndex}>
                <span className="section-label">
                  {group.label}
                  {group.items.length > 1 ? ` · ${group.items.length} columns` : ''}
                </span>
                {group.items.map((item, itemIndex) => {
                  const known = idByName.has(key(item.name));
                  const suggestion = known ? null : suggestSimilar(item.name, exerciseNames);
                  return (
                    <p key={itemIndex} className="wod-preview-item">
                      <span className="wod-preview-count">{item.sets.length}×</span>{' '}
                      {item.sets[0]?.repsLabel ? `${item.sets[0].repsLabel} ` : ''}
                      <span className={known ? 'wod-preview-known' : undefined}>{item.name}</span>
                      {item.hint && <span className="wod-item-hint"> {item.hint}</span>}
                      {!known && (
                        <span className="wod-preview-new">
                          {' '}
                          new
                          {suggestion && (
                            <>
                              {' · '}
                              {/* The name is a verbatim substring of the text, so applying the
                                  suggestion is a plain replace; the preview re-parses from it. */}
                              <button
                                type="button"
                                className="wod-preview-suggest"
                                onClick={() => setText((current) => current.replace(item.name, suggestion))}
                              >
                                did you mean “{suggestion}”?
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </p>
                  );
                })}
              </section>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary wod-load"
          disabled={preview.length === 0}
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

      <div key={`${plan.createdAt}:${removals}`}>
        {plan.groups.map((group, groupIndex) => {
          const open = !collapsed.has(groupIndex);
          return (
            <section key={groupIndex} className="wod-group">
              <button type="button" className="wod-group-head" onClick={() => toggleGroup(groupIndex)}>
                <span className="section-label">{group.label}</span>
                <span className="wod-group-state">{open ? 'hide' : 'show'}</span>
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
                        revealed={revealed === cell(groupIndex, 0, setIndex)}
                        onReveal={() => setRevealed(cell(groupIndex, 0, setIndex))}
                        onRemove={() => handleRemoveSet(groupIndex, 0, setIndex)}
                        removeLabel={`Remove set ${setIndex + 1} of ${group.items[0].name}`}
                      />
                    ))}
                    <button
                      type="button"
                      className="set-add"
                      aria-label={`Add a set to ${group.items[0].name}`}
                      onClick={() => handleAddRound(groupIndex)}
                    >
                      +
                    </button>
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
                            revealed={revealed === cell(groupIndex, itemIndex, round)}
                            onReveal={() => setRevealed(cell(groupIndex, itemIndex, round))}
                            onRemove={() => handleRemoveSet(groupIndex, itemIndex, round)}
                            removeLabel={`Remove set ${round + 1} of ${item.name}`}
                          />
                        ) : (
                          <span key={itemIndex} />
                        ),
                      )}
                    </Fragment>
                  ))}

                  {/* A round is the unit here, so one "+" adds a set to every column at once. */}
                  <button
                    type="button"
                    className="set-add"
                    aria-label={`Add a round to ${group.label}`}
                    onClick={() => handleAddRound(groupIndex)}
                  >
                    +
                  </button>
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
