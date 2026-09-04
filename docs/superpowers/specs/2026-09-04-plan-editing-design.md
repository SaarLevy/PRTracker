# Editing a loaded plan

## Problem

The workout screen is a one-way door. You paste the WOD text, tap "Load plan", and the text is gone —
a `Plan` is `{ date, createdAt, groups }` and nothing else.

So when the parse got an exercise wrong, or you typo'd a name, or the gym swapped one out halfway
through, the only way back is "Discard" and retype the whole workout. That also throws away every
weight already filled in, which is the part that actually hurts: the plan text takes a minute to
retype, but the sets you already did are gone for good.

## Goal

Get back to the text, change a line, and return to the workout with your weights still in place.

## Decisions

**The plan remembers the text it came from.** A `text` field on `Plan`, set once in `planFromText`.
Every entry point already funnels through that function — the textarea, the `?plan=` query param in
`consumeSharedPlan`, and the share target — so one line covers all three.

Re-serializing `groups` back into text was rejected. `parseWod` is deliberately lossy: group labels,
hints, rep ladders and drop-set columns all collapse into the same shape, so a round trip would hand
you back text you did not write, and you would then have to edit *that*.

**Editing is non-destructive until you re-load.** Tapping "Edit plan" reveals the text screen but
leaves localStorage alone. A mis-tap costs nothing — "Cancel" puts the plan straight back, and so
does navigating away and returning, or the PWA reloading. Nothing writes to storage while the editor
is open, so there is no window in which the plan exists only in React state.

**Work carries over per exercise, matched by name.** Re-loading re-parses from scratch, so the new
plan's boxes start empty and a merge step copies across what you had filled in. Names match case- and
whitespace-insensitively, in document order, so an exercise that moves to a different group still
finds its weights. Repeated names are matched Nth-occurrence to Nth-occurrence — `parseWod` gives
drop-set stages the same name across sibling columns, so a name is not a unique key.

**You only lose weights on an exercise you actually changed.** That is the invariant, and it settles
the two awkward cases:

- A filled set past what the edited text prescribes — the 4th set you added with "+" when the text
  said three — is appended back rather than truncated. An *unfilled* extra is dropped; the "+" always
  brings one back.
- A filled set whose exercise no longer appears in the text is genuinely lost, so it is counted and
  confirmed before anything happens: "2 sets you filled in are no longer in the plan and will be
  lost. Load anyway?" The same confirm-only-when-there-is-work-to-lose rule that Discard, the share
  import and set removal already apply.

**Reps carry over only while the prescription is unchanged.** A weight is always yours. A rep count
is ambiguous — it arrives prefilled from the text, so it cannot tell a set you did from one you have
not started, which is the same reason `isSetFilled` ignores it. The rule: carry the old `reps` when
the new set's `repsLabel` is identical to the old one's, otherwise let the text's prefill win. Edit
"8 Deadlift" to "5 Deadlift" and you get 5; type 7 into a "Max" box and leave that line alone and you
keep 7.

**The button sits at the end of the scroll, not in the dock.** Changing the plan is something you go
looking for, not something that should sit under your thumb next to "Finalize workout" while you tap
between sets with sweaty hands. `.screen-wod` already reserves bottom padding for the fixed dock, so
a button at the end of the scroll content clears it with no layout change.

**The plan keeps its original date.** `planFromText` stamps today; the merge restores the previous
plan's `date`, so editing a workout you started before midnight does not move it to the next day.
`createdAt` is deliberately *not* preserved — it is half of the React `key` that force-remounts the
uncontrolled set inputs, and a remount is exactly what re-loading needs.

## Logic

One pure function in `src/lib/plan.ts`, beside `addRound` and `removeSet`:

```ts
/** Carries the work filled in on `previous` across to a freshly parsed `next`. */
export function carryOverWork(next: Plan, previous: Plan): { plan: Plan; lost: number };
```

The `{ plan, lost }` shape mirrors `collectEntries`'s `{ ready, incomplete }`: the caller uses the
count for its confirm and the value for its state.

1. Bucket every item in `previous` into a map keyed by normalized name, keeping document order
   within each bucket.
2. Walk `next` in document order, shifting the next unclaimed previous item with the same key. An
   empty or absent bucket means the item is new, and it keeps its parsed sets.
3. For a matched item, each new set at index `i` takes `previous.sets[i].weightKg` when that set
   exists, and its `reps` as well when `repsLabel` is unchanged.
4. Every `previous.sets[j]` with `j >= next.sets.length` that is filled gets appended, carrying its
   weight, reps and label verbatim.
5. `lost` counts the filled sets of previous items that were never claimed. A matched item cannot
   lose a set, because step 4 catches the overflow — which is the invariant, in code.

**The name key is extracted.** `Workout.tsx` had `name.trim().toLowerCase()` written out four times.
The merge needs the identical rule in `plan.ts`, and two definitions of "the same exercise" in two
files will drift, so it becomes an exported `exerciseKey` that both use. `ExerciseList.tsx` and
`exerciseSearch.ts` normalize for different purposes and are left alone.

## The screen

An `editing` state holds the plan being edited: non-null only while the text screen is showing an
edit rather than a fresh import. It is what "Cancel" restores and what the merge reads.

"Edit plan" sets it, fills the textarea from `plan.text` and drops `plan` to null. No `clearPlan()`
and no confirm — nothing is destroyed yet. A plan already in localStorage from before this change has
no text; you land in an empty box and Cancel gets you out with the plan intact, for the one workout
that spans the upgrade.

While editing, the header gains a "Cancel" beside the back arrow, the empty-state copy explains that
weights carry over, and the primary button reads "Update plan".

The share-import effect gained a `setEditing(null)`. Its `await takeSharedWod()` resolves after
mount, so a share can in principle land while the editor is open, and would otherwise leave the merge
pointed at a plan the share had just cleared.

## Tests

`src/lib/plan.test.ts`, in the existing fixture-factory style. Covered: weights carrying by position;
a renamed exercise starting empty and counting as lost; unfilled sets of a removed exercise not
counting; reps carrying only while the label holds; filled extras appended and unfilled ones dropped,
neither counted as lost; repeated names matching Nth-to-Nth; an exercise moved between groups still
matching; case and whitespace ignored; the date coming from the previous plan and `createdAt` from
the new one; neither input mutated. Plus `planFromText` storing its text.

The buttons and the flow are not tested — the project has no component-test setup — and are verified
by hand.

## Out of scope

- Serializing a plan back to text, or reflecting "+"/"−" set changes into the text.
- Editing exercise names, hints or set counts directly on the workout screen.
- Any schema change, Dexie version bump, or edit to `types.ts` — a plan lives in localStorage.
- Undo, or a history of plan revisions.
