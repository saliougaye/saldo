# UI scoping: motion, the transaction form, and date entry

**These are investigations, not implementation plans.** Each one ends in a decision and a short
written scope; the work that follows gets its own plan. They are separate because they are
separable — none blocks another, and none blocks phase 10 or 11.

**Read first:** `docs/design/README.md`, then the line ranges named below in
`docs/design/Spese.dc.html`. The prototype is the reference for *what it looks like*; the spec wins
wherever they disagree (AGENTS.md).

---

## A. Motion — ✅ decided and built (2026-09-11)

**Library: `react-native-reanimated` 4**, already installed with its worklets plugin. Layout and
entering/exiting animations run on the UI thread, so they keep their frames while JavaScript is
busy applying a sync or a filter — the thing that would otherwise drop frames exactly when the
list is changing. `LayoutAnimation` was not considered further: crude, and iOS-flaky.

**The scale lives in `@saldo/ui` tokens**, reusing what was there (`fadeMs` 200 for an element,
`sheetMs` 280 for a screen, `progressMs` 300 for a bar) and adding three: `pressMs` 120 for
instant feedback, `countMs` 420 for a number rolling, `staggerMs` 40 between siblings. No duration
is typed into a screen.

**One module, `src/theme/motion.ts`**, exports the four presets everything uses — `entering(i)`,
`appearing`, `leaving`, `reflowing` — plus `useMotion()` and `useCountUp()`.

**What animates, and why:**

| What | Trigger | Preset | What it says |
| --- | --- | --- | --- |
| The **Remaining** figure, an account balance, Totale spendibile | the value changes | `useCountUp` | it *was* something else — the thing you want to know after adding a transaction |
| Budget and cycle bars | the ratio changes | `withTiming` on `scaleX` | how far it moved, not just where it ended |
| Transaction rows and day groups | filter, delete, sync | `appearing` / `leaving` / `reflowing` | which rows went, and that the list closed up rather than jumping |
| Home cards | screen mount | `entering(0…4)`, 40ms apart | order of importance, once per launch |
| Toast | it arrives | `toastEntering` up from its own edge | where it came from, so a swipe would agree |

**What deliberately does not:** every amount in a list (fifty numbers counting at once is a slot
machine); tab switches and keyboard-driven actions; the sheets, which keep the platform's own
slide; anything triggered many times a day, which gets `pressMs` opacity/scale at most.

**Reduced motion** is honoured by construction, not by a check per screen: every preset carries
`ReduceMotion.System`, so Reanimated jumps to the end state, and `useMotion().reduced` covers the
hand-written count-up and the skeleton pulse. Nothing is communicated by motion alone — every
animation above decorates a change already visible in a number, a colour or a label.

**Loading states** came with it: `Skeleton` / `SkeletonRow` / `SkeletonList`, shown through
`useDelayed` so a query the device answers in a frame never flashes one (180ms grace). The
transactions list uses them instead of a bare spinner.

**Original brief.**

**Why now.** The app has almost no motion of its own: sheets slide because `Modal` slides, screens
push because the navigator pushes, and everything else appears instantly. That is not a neutral
default — a number that changes with no transition reads as a glitch, and a list that reorders
without moving is hard to follow. §13 of the spec covers colour, type and radii and says nothing
about timing.

**What to answer.**

1. **Where motion carries meaning**, as opposed to decorating. Candidates, in the order they are
   likely to matter:
   - the **Remaining** figure and the budget bars on Home, when a transaction is added or the
     period changes — a value that animates from the old number tells you it *was* something else;
   - the **transaction list** when a row is added, edited or deleted, and when the filters change;
   - the **FAB → new transaction** transition, which the design draws as a sheet growing out of the
     button rather than a page push;
   - **tab switches**, which today are instant.
2. **What the design already specifies.** Read the prototype's CSS transitions and note durations
   and easings rather than inventing a scale.
3. **One timing scale**, expressed as `@saldo/ui` tokens, so a duration is never typed into a
   screen. Probably three: instant feedback (~120ms), element (~220ms), screen (~320ms). Confirm
   against the prototype.
4. **Which library.** `react-native-reanimated` is already a transitive dependency of the gesture
   handler; `LayoutAnimation` is free but crude and iOS-flaky; `Animated` is built in. Decide once,
   and say why in the scope document.
5. **Reduced motion.** `AccessibilityInfo.isReduceMotionEnabled` — decide whether the scale
   collapses to zero or to something shorter, and make it one hook rather than a check per screen.
6. **What stays still.** Write this down too: a list that animates on every keystroke of a filter
   is worse than one that does not move at all.

**Deliverable.** A scope listing the animations to build, each with its trigger, its token, and
what it communicates; a token addition to `@saldo/ui`; the library decision with its reason.

**Out of scope for the POC:** shared-element transitions between screens, skeleton loaders (there
is nothing slow enough to need them), and anything that depends on gesture-driven navigation.

---

## B. The transaction form (§6.16), new and edit — ◐ partly decided (2026-09-11)

Taken now, from the user's own feedback that the category grid was hiding everything under it:

- **Account and date moved above the grid**, in one card. Both are set on nearly every transaction;
  the grid was three rows tall and pushed them, the tags and the attachments off the screen.
- **The grid caps at seven** (`topCategories(..., limit = 7)`) plus the "Altro" tile: two rows.
  "Altro" now opens `CategoryPickerSheet` — the full list, subcategories indented under their
  parents — instead of expanding the card inline, which is what made the form grow without bound.
- A category chosen from the picker that is not in the grid is **shown in it anyway**, so the
  selection is never invisible.

**Still open:** the timed fast path, what a "more" disclosure should hide (`excludeFromTotals`,
the note), whether recents should be "most used in this period" rather than all-time, and the
error/save-button rules. The brief below stands for those.

**Original brief.**

**Why now.** It is the screen the app exists for — most sessions are "add a transaction and leave"
— and it is the one that has grown the most: amount keypad, kind, account, category, date, tags,
attachments, repeat, note, exclude. It was assembled row by row as phases landed, and it has never
been looked at whole.

**What to answer.**

1. **What the fast path actually is.** Time the sequence for the most common entry — an expense, on
   the default account, in a recent category, today — and count the taps. Compare with the
   prototype's intent. Anything that is not on that path should be reachable without being in the
   way of it.
2. **The order of the fields**, against the design (lines 980–1100 of the prototype) and against
   what it costs to change each one. The date defaults to today and is rarely touched; the category
   almost always is.
3. **New versus edit.** They share a form but not a purpose: new opens with the keypad up and a
   half-filled row, edit opens on an existing row where the amount is usually *not* what is being
   changed. §6.16 already says the keypad starts closed on edit — check the rest follows.
4. **Recently used categories and accounts.** The form shows all of them; the design shows a short
   list with "tutte". Decide the rule (last used? most used in this period?) and where it lives —
   `@saldo/core`, with a test, not in the screen.
5. **What can be removed.** Every row on that screen costs the ones below it. `excludeFromTotals`
   and `note` are rare; the attachment strip is new. Consider a "more" disclosure, and say what the
   default open state is.
6. **Errors and the save button.** What is disabled, what is explained, and where — today a form
   that cannot be saved does not always say why.

**Deliverable.** A scope with the field order, the disclosure rule, the recents rule (as a core
function signature), and a list of what moves or goes.

---

## C. Date and time entry — ✅ decided and built (2026-09-11)

**Decision: drawn, not native.** `@react-native-community/datetimepicker` is gone from the app
(dependency removed). `src/components/Calendar.tsx` draws the month grid from `@saldo/ui` tokens
and `monthGrid` in `@saldo/core`; `src/components/DateSheet.tsx` wraps it for a single day, and
`CustomRangeSheet` uses the same component in its range mode — so there is one calendar, not two.

- **Why drawn.** The platform picker arrives in its own typeface, radii and colours, differs
  between iOS and Android, and cannot draw a range at all — which meant the period range sheet was
  already a second, worse date UI. The cost was one component plus its tests.
- **Shortcuts.** "Oggi" and "Ieri" stay chips on the transaction form (no sheet to open at all for
  the common case); the sheet repeats "Oggi" so a mis-tap is one tap to undo.
- **Grid.** Always six rows, so the sheet does not change height between months. The neighbouring
  months' days are drawn faintly rather than left blank.
- **Locale.** The week starts where `firstWeekdayFor(locale)` says — Monday for Italian, Sunday for
  English — and the ISO week the period logic uses (§5.2) is untouched by that display choice.
- **Time.** Nothing in the picker mentions one: Saldo stores `LocalDate` and no time (D8).

**What is left of C:** nothing blocking. If the drawn calendar needs a year jump (tapping the month
title) or a swipe between months, that is a follow-up, not a decision.

**Original brief.**

**Why now.** The date row opens a picker that was built to be functional, and dates are entered on
*every* transaction. The design draws a calendar (lines 1120–1180) that the app does not have.

**What to answer.**

1. **What the design actually asks for**, in detail: month grid, the week strip, the "oggi /
   ieri" shortcuts, and whether it is a sheet or a screen.
2. **Native versus drawn.** `@react-native-community/datetimepicker` gives the platform picker —
   familiar, free, accessible, and visually foreign to this app, differently on each platform. A
   drawn calendar matches the design and costs a component plus its tests. The decision is a
   product one: write down which it is and why, because it will not be revisited cheaply.
3. **Shortcuts.** Most transactions are today or yesterday. Decide whether those are buttons above
   the calendar, and whether the row itself offers them without opening anything.
4. **Time.** Saldo stores `LocalDate` and no time at all (D8), so there is nothing to enter — but
   the Spendee import does carry timestamps, and the viewer shows only dates. Confirm nothing in
   the UI implies a time is being kept.
5. **Ranges.** `CustomRangeSheet` already picks two dates for a period. Whatever comes out of this
   should be the same component, so a range is not a second implementation of a calendar.
6. **Locale.** The first day of the week and the month names come from `@saldo/i18n`; the picker
   must not hard-code Monday or Italian.

**Deliverable.** A scope naming the component, the decision on native versus drawn with its
reason, the shortcut rule, and how the range case reuses it.

---

## Sequencing

C then B then A, if they are done in order: date entry is inside the transaction form, so deciding
it first avoids reworking the form twice, and motion is best scoped once the screens it animates
have stopped moving. None of them blocks phases 10 and 11.
