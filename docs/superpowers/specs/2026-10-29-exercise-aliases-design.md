# Exercise name aliases

## Problem

Exercise names are typed by hand, pasted from gym apps and read back out of OCR, so one lift turns
up as "DB RDL", "Dumbbell RDL" and "Dumbbell Romanian Deadlift". Search was a plain substring match
and the workout plan matched names only by case-insensitive equality. An abbreviation never found
the full name, and a plan line in shorthand logged to a brand-new duplicate exercise.

## Goal

Treat common gym shorthand, hyphens, word splits and plurals as meaningless everywhere two names
are compared: searching, linking a plan item to its history, carrying weights over when a plan is
edited, and finalizing a plan into entries.

## Decisions

**An alias match is the same exercise.** "DB RDL" in a plan links to a tracked Dumbbell Romanian
Deadlift and its sets are logged there. It is not a "did you mean" suggestion.

**Names are never rewritten.** What you typed is what is shown and what a new exercise is called.
Aliases only change what counts as equal.

**The alias list is built in.** No Settings screen and nothing in export/import; adding one is a
one-line change to `ALIASES` in `src/lib/exerciseAliases.ts`.

**Ambiguous shorthand stays out.** PU (pull-up or push-up) and Lat (would turn Lat Pulldown into a
lateral one) are not aliases. SL means single-leg, so a stiff-leg deadlift has to be written SLDL.

**Other names for a lift are phrases.** Anatomical names (shoulder abduction is a lateral raise,
knee flexion a leg curl) and gym synonyms (military press, Scott curl, farmer's walk) replace a run
of words, not one word. Phrases only match whole, which is what makes "lat raise" safe where "lat"
alone is not. Two calls were made knowingly: shoulder press is an overhead press, and a
hyperextension is a back extension, so those library entries now read as the same lift.

**The name as written beats an alias.** Two exercises tracked separately before aliases existed
("DB Row" and "Dumbbell Row") each keep getting their own sets. Merging existing duplicates is out of
scope.

**"Did you mean" stays on raw names.** Comparing expanded names lets shared words dominate: "DB Row"
against "DB Curl" scores about 0.75 once both read "dumbbell …", which would suggest the wrong lift.
Alias matches are already treated as known, so they never reach the suggestion.

## How names are compared

`expandWords` lowercases a name and splits it on spaces, hyphens, underscores and slashes. It also
strips punctuation except `&`. Each word is looked up as written, then as a singular, so KBS stays a
kettlebell swing and DBs become dumbbell. Expanded words are singularized. Phrases are then swapped,
longest first, in one pass. Last, a word repeated right after itself is dropped, so "EZ-Bar Curl"
and "EZ Curl" agree, and so do "Hip Abduction Machine" and "Abductor Machine". `aliasKey` joins the words
without spaces, so "push ups", "pushups" and "Push-Up" are all "pushup".

- `exerciseKey` in `plan.ts` is now `aliasKey`. That covers `carryOverWork`.
- `findExercise` tries the exact name first, then the alias key. The workout screen uses it for the
  preview's known/new mark, the history links and finalize. The search box's Enter uses it too.
- Search matches a name if the raw name contains the raw query, or if every expanded query word
  appears in the name's alias key, in any order. Library ranking adds that word match as a fourth
  tier below exact, prefix and contains. Library entries and the "Add" row are hidden when their
  alias key equals a tracked exercise's key or the query's.
