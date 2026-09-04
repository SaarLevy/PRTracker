# Adding and removing sets during a workout

## Problem

The workout screen fills in a plan parsed from pasted WOD text. The set count comes from the
group header — "3 Super-sets", "4 Sets" — and is frozen at import: whatever the text said is
exactly how many boxes you get.

Real workouts diverge. You want an extra warmup set, or three was enough and the fourth is never
happening. Today the only options are to leave a box blank forever or discard the plan and
re-import it, losing every weight already filled in.

## Goal

Add a set and remove a set from the loaded plan, during the workout, without leaving the screen.

## Decisions

**A set is added by tapping a "+" shaped like a set box.** Dashed rather than solid, so it reads
as "one more of these" without ever reading as an empty set you forgot to fill.

**In a superset, the round is the unit.** A group with two or more items renders as a grid —
one column per exercise, one row per round — because that is how you actually do it, alternating
between the exercises. So the grid gets one full-width "+" bar beneath it that adds a set to
every column at once. A per-column "+" would put the tiles at different heights as the columns
diverge, and "another round" is what you mean when a superset needs one more.

**Removal is per set, so columns may end up ragged.** You skipped the last round of the accessory
but finished the press. The grid already derives its row count from the longest column and renders
a blank cell for a column that is short, so nothing needed changing to support this.

**Removal is behind a long press.** A set box is a tap target you hit repeatedly with sweaty
hands between sets; a permanently visible delete button next to the number you are typing is a
mis-tap waiting to happen. A long press reveals a "−" circle on that one box, and only that box.
Any press elsewhere — including the press that starts a scroll — puts it away, which keeps this a
transient reveal rather than an edit mode with a state you can get stuck in.

**Confirm only when there is work to lose.** Removing an untouched set is silent; removing one
with a weight in it asks. This is the rule the share-import guard and the discard button already
apply.

**"Filled" means a weight, not reps.** Rep counts arrive prefilled from the WOD, so they cannot
tell a set you did from one you have not started. A set with no weight can never become an entry
anyway.

**New sets append.** A warmup is conceptually the first set, but set order is not stored — a plan
becomes a flat list of entries at finalize — so a warmup box at the end is a visual quirk, not a
data problem. Insert-before and reorder are not worth their UI.

**No warmup flag.** An added set is an ordinary set and gets logged like any other. Marking
warmups so they stay out of history would mean a field on the set, a field on `Entry`, a Dexie
version bump and filtering in `records.ts` — a much larger change, for a light set that cannot
beat a PR regardless.

**Emptying an item is allowed.** Remove the last set of an exercise and the exercise stays on
screen with just its "+". Blocking it would need a rule to explain, and the "+" always brings a
set back.

## Logic

Three pure functions in `src/lib/plan.ts`, beside `collectEntries`:

```ts
/** Adds one set to every item in a group — one more set, or one more round of a superset. */
export function addRound(plan: Plan, groupIndex: number): Plan;

/** Drops one set from one item. */
export function removeSet(plan: Plan, groupIndex: number, itemIndex: number, setIndex: number): Plan;

/** Whether a set holds work you would lose by deleting it. */
export function isSetFilled(set: PlannedSet): boolean;
```

`PlannedItem.sets` is already an array and no round count survives parsing, so both mutations are
a splice with nothing to keep in sync. `collectEntries` and the dock's set count recompute from
the array on every render and need no changes.

A single `addRound` covers both layouts: a lone exercise is a one-item group, so "add one set to
every item" is the same operation in both. It appends one per column and does not pad ragged
columns up to the longest — padding would grow a shortened column by two on one tap.

The new set copies the rep prescription of the one before it but never its weight, which would
otherwise count as a finished set the moment you tapped "+".

## The stale-DOM problem

`SetBox` uses uncontrolled inputs so a half-typed decimal like "62." survives a keystroke. They
read the plan once, when they mount. Remove set 2 of three and React unmounts the *last* box: the
model is `[100, 110]` but the DOM still shows `100, 105`, along with the red "filled" border that
`:has(.set-weight:not(:placeholder-shown))` draws on it.

The fix is the escape hatch the screen already uses. A `key` of `plan.createdAt` force-remounts
the tree when a new plan loads; it gains a counter, bumped on every removal. Only removal needs
it — appending never disturbs an existing index, so "+" leaves the DOM correct and a focused
input keeps its keyboard.

The alternative, a stable `id` on `PlannedSet`, was rejected: ids would have to be minted in
`parseWod`, making a pure deterministic parser depend on `crypto.randomUUID()` and breaking every
literal assertion in its tests, and `loadPlan` — three lines of unvalidated `JSON.parse` — would
become permanent schema-migration code for a value that lives one workout.

## The gesture

Pointer events only, so touch, mouse and pen share one path. Pointer-down starts a 400ms timer;
movement past 8px, pointer up, cancel or leave clears it. 400ms is long enough not to fire while a
finger settles before typing and short enough to beat the OS's own selection gesture.

Pointer-down never calls `preventDefault()` — that is what would kill tap-to-focus, the caret
and the keyboard. Native text selection is suppressed in CSS instead, and only while it would
hurt: the inputs are `user-select: none` until focused, which is exactly when a hold means
"remove this set" rather than "select this text". `-webkit-touch-callout: none` stops iOS's
copy sheet and `touch-action: manipulation` stops double-tap zoom competing with a held finger.

A `contextmenu` handler is a second way in: right-click on a desktop, and pre-empting the menu
also stops Android's own selection popup. It doubles as the keyboard path, since Shift+F10
dispatches `contextmenu` on the focused element and the "−" renders after the inputs in DOM order.

One accepted gap: long-pressing the box you are currently typing in gives the native loupe, not
the "−". You delete sets you did not do, so tapping another box first is not a real cost.

Dismissal is a document pointer-down listener that ignores presses inside `.set-remove` — without
that guard the button unmounts before its own click can fire.

## Tests

`src/lib/plan.test.ts`, following the existing fixture-factory style, with a `superset()` factory
added beside `plan()`. Covered: appending to a lone exercise and to every column of a superset,
independent appends on ragged columns, the new set inheriting reps but never a weight, per-column
rep labels, removal closing the gap, removal leaving a superset ragged, emptying an item, both
functions leaving their input alone, out-of-range indices returning the plan unchanged, and
`isSetFilled` being false for a prefilled rep count and true for a bodyweight zero.

The gesture and the buttons are not tested: the project has no component-test setup, and a
long press is not something jsdom would prove anyway. It is verified by hand on the phone.

## Out of scope

- Any schema change, Dexie version bump, or edit to `types.ts`.
- Marking a set as a warmup, or excluding anything from history and PRs.
- Inserting a set before another one, and reordering sets.
- Adding or removing whole exercises or groups.
