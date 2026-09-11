# Investigation: how Saldo asks for things

**This is an investigation, not an implementation plan.** It ends in one decision per form and a
short written scope; the work that follows gets its own plan. Asked for by the user on
2026-09-11: *"creare/modificare un modello ora è una flat screen con tutte le informazioni ma se
non si scrolla le si perde"*.

**Read first:** `docs/design/README.md`, the design line ranges named per form below, and
`2026-09-11-ui-scoping.md` §B, which already decided part of the transaction form.

---

## Decisions (2026-09-11)

Measurements below are computed from the components, not read off a device: a 390×844 screen, the
`@saldo/ui` paddings, and the card contents as written. Treat the totals as ±10%, and re-check the
two marked ⚠ on a simulator before building.

### 0. Two defects found while measuring, which are half the reported problem

Neither is a layout decision, and both make every form worse than its layout explains:

- **`Screen`'s `ScrollView` has no `keyboardShouldPersistTaps`**, so it defaults to `'never'`: while
  the keyboard is up, the first tap on any control is swallowed to dismiss it. On the transaction
  form that is a tap paid on *every* entry — type the amount, tap a category, nothing happens, tap
  it again. Fix: `keyboardShouldPersistTaps="handled"` in `Screen`, once.
- **Nothing in the app avoids the keyboard** (no `KeyboardAvoidingView`, no `windowSoftInputMode`).
  The footer is a sibling *below* the `ScrollView`, so the primary button sits under the keyboard
  whenever an `AmountInput` or a `TextField` has focus. iOS is rescued by the `InputAccessoryView`
  ("Fatto"); Android has no accessory at all, so there the save button is simply unreachable until
  the system back key is pressed. Fix: the footer rides the keyboard, in `Screen`, once.

Both belong to the same `Screen` change as the scroll cue below.

### 1. The pattern per form

| Form | Fields | Opened | Pattern | Change |
| --- | --- | --- | --- | --- |
| Transaction | 10 | many times a day | **flat, one screen, no scroll** | tail collapses into one "Dettagli" disclosure |
| Budget | 6 | a few times a year | **3 steps (new) / one page (edit)** | none — it is the reference |
| Account | 9 | a handful of times ever | **flat + rows that open sheets** | colour/icon, type and credit days become rows |
| Category | 6 | tens of times | **flat + rows that open sheets** | the icon library leaves the page |
| Tag | 1 | rarely | **sheet** | none |

Nothing becomes multi-step that is not already. The argument is the one in §2 of the brief and it
generalises: a step count is a tax on every entry, a scroll is paid only by the entries that need
the field at the bottom — and the three forms that are *not* the transaction form don't need steps
either, because once the sub-pickers leave the page they already fit.

### 2. Transaction (`TransactionForm.tsx`) — flat, and it must end up fitting

Measured today, sheet viewport ≈ 660pt after the docked footer:

| Block | ≈ height |
| --- | --- |
| header + kind segmented | 96 |
| amount card | 90 |
| account + date card | 140 |
| category card (2 tile rows) | 215 |
| description card | 75 |
| tags card | 120 |
| attachments + repeat + exclude card | 220 |
| **total** | **≈ 956** |

So ~300pt — three of the ten fields — live below the fold, and with the keypad up on `new` the
visible window is ~330pt: everything from the category grid down is invisible at the moment the
form opens. That is the complaint, exactly.

**Decision.** Keep every frequent field on the first screen and collapse the rest:

1. kind · amount · account + date · category grid · description — **616pt, fits in 660** with
   nothing hidden. Description stays visible because it is the only field that makes a row
   identifiable in the list later; it costs 75pt and there are 44 spare. ⚠ verify on the shortest
   supported device (iPhone SE, 667pt tall) — if it doesn't fit there, description joins the
   disclosure and the grid drops to one row of four.
2. **tags · attachments · repeat · excludeFromTotals** move into one `Card` with a disclosure row:
   `Dettagli` plus a summary of what is set (`Nessuno` / `2 tag · 1 allegato · si ripete`). The
   summary is what keeps a collapsed field from being an invisible field — a set value is always
   readable without opening anything.
3. The disclosure's default open state: **closed on `new`, open on `edit` when any of its four
   fields is non-empty.** You came back to the form for the thing you already set.

**Fast path, after the change:** FAB → type amount → tap category → *Crea*. Three taps and the
digits, no scroll, no keypad dismissal (the footer rides the keyboard, and the swallowed tap is
gone). Today it is five taps and a scroll.

**§B's open questions, answered:** the "more" disclosure hides tags, attachments, repeat and
exclude — not the note. Recents stay all-time (`topCategories` already ranks by usage over every
row); period-scoping them would make the grid change under the user between cycles for no gain
they asked for. The error rule stays as built: one muted line naming the next missing thing, shown
only once the form has been touched.

### 3. Budget — unchanged

Three steps for `new`, one page for `edit`, `budgetStepReady` per step. The order
categories → amount → details is load-bearing (the median suggestion is computed *from* the
categories). The `details` step is ~280pt and fits. Nothing to do beyond the `Screen` change.

### 4. Account (`AccountForm.tsx`) — rows that open sheets

Nine fields over five cards, and the bottom one is two wrapping grids — twelve colour swatches and
every `accountIconOptions` icon — sitting below `includeInSpendable`, which is the toggle that
decides whether the account counts towards *Totale spendibile*. The most consequential switch on
the screen is under the most decorative grid.

**Decision**, three cards:

1. **balance + name.** The two things that must be filled.
2. **rows.** `Istituto` stays an inline `TextField` (typing, not choosing). `Tipo` becomes a row
   showing the current type, opening a sheet with the five options. `Aspetto` becomes one row with
   the `IconBox` preview as its leading element, opening **one** sheet holding both the colour
   swatches and the icon grid. `Chiusura` / `Addebito` appear as two rows only when
   `type === 'credit_card'`, each opening a sheet with the 1–28 grid.
3. **`includeInSpendable` + its note.**

Same layout for `new` and `edit`: two required fields is not a wizard.

### 5. Category (`CategoryForm.tsx`) — same, harder

The icon card holds `categoryIconGroups` — the whole library, grouped, with a search field — in the
*middle* of the form. Colour, parent and budget are below it and are never seen. This is the worst
case in the app.

**Decision**, three cards:

1. **The preview card becomes the control.** It already draws `IconBox` + the name; tapping it
   opens the appearance sheet (search field, grouped icon grids, colour swatches as its first row).
   The preview shows the result, so it is the natural place to tap for it.
2. **name + direction** (direction on `new` only, as today).
3. **rows:** `Categoria padre` → a sheet shaped like `CategoryPickerSheet`; `Budget mensile` stays
   a toggle with the inline `AmountInput` when on.

≈450pt, whole form visible. Same for `new` and `edit`.

### 6. Tag — nothing to do

One field. `TagEditSheet` is opened from `app/tag/[id].tsx`, which is a screen with the tag's
transactions; creation happens inline on the transaction form ("crea tag X"). The sheet holds a
rename, a merge and a delete-with-confirmation — see the rule check below.

### 7. The scroll cue (question 3) — one change in `Screen`

Today the footer is a sibling *below* the `ScrollView` painted in the page background, so content
is cut at a hard horizontal edge that reads as the end of the document. That is why a form that
scrolls doesn't look like one.

**Decision:** the footer is absolutely positioned **over** the scroll view; the scroll content gets
`paddingBottom = footerHeight` so nothing is unreachable; and a 24pt gradient from transparent to
`palette.bg` sits between them, so the last row visibly dissolves under the button instead of
ending above it. `react-native-svg` is already a dependency (15.15.4) and draws the gradient — no
new package.

Rejected: `showsVerticalScrollIndicator`, which on iOS is invisible at rest and therefore cues
nothing at the only moment it matters; and bottom padding alone, which guarantees a partial row but
still ends on a hard edge.

Applied in `Screen`, so every screen with a `footer` gets it, not five screens by hand.

### 8. Edit is not create (question 4)

The line, stated once and applied everywhere:

- **Only the budget form branches on `mode`,** because it is the only one with steps. Every other
  form is the same page in both modes.
- What `mode` *is* allowed to change anywhere: `autoFocus` (a new form opens on its first empty
  field, an edit opens on nothing), the disclosure's default open state, the title, and the
  presence of delete/archive.
- No form gains a wizard in `edit`.

### 9. Sheets versus screens (question 5)

The rule: **a sheet for a choice made and closed; a screen for a choice with a footnote, a
confirmation, or its own list to manage.** Checked against what exists:

| Component | Verdict |
| --- | --- |
| `CategoryPickerSheet`, `DateSheet`, `CustomRangeSheet`, `PeriodKindSheet`, `CycleStartDaySheet`, `AccountFilterSheet`, `TagFilterSheet`, `RecurrenceScopeSheet` | ✅ choice, made and closed |
| `profile/*`, `settings/*` | ✅ lists to manage |
| New appearance / type / credit-day pickers (§4, §5) | ✅ sheets, by the rule |
| `TagEditSheet` | ❌ it renames, **merges irreversibly into another tag**, and deletes behind a `ConfirmDialog`. Three destructive actions and a list of other tags: that is a screen. It already has one — `app/tag/[id].tsx` — so the fix is to inline it there rather than open a modal from a screen. |

### 10. What the implementation plan covers

1. `Screen`: `keyboardShouldPersistTaps`, keyboard-aware footer, footer over content, gradient cue.
2. `TransactionForm`: the `Dettagli` disclosure and its summary line.
3. `AccountForm`: three cards, `Tipo` / `Aspetto` / credit-day sheets.
4. `CategoryForm`: three cards, the preview card as the appearance control.
5. `TagEditSheet` → inline in `app/tag/[id].tsx`.

Budget is untouched. Nothing here changes what is stored.

---

## The problem, stated once

Every create/edit screen in the app is the same shape: a pushed screen, a column of `Card`s, one
field group per card, a primary button pinned at the bottom. It was the right default — it is
uniform, it needs no new component, and it works — but it has one failure mode and every form now
has it: **what does not fit is invisible.** There is no scroll cue, the footer button sits above
the fold and looks like the end of the form, and a field nobody scrolls to is a field nobody sets.

Today the five forms are:

| Form | Where | Fields | Cards |
| --- | --- | --- | --- |
| Transaction | `TransactionForm.tsx` | kind, amount, account (+destination), date, category, description, tags, attachments, repeat, exclude | 6 |
| Budget | `BudgetForm.tsx` | amount, categories, name, period, alert, rollover | 3 (now 3 steps for new) |
| Account | `AccountForm.tsx` | balance, name, institution, type, credit days, colour, icon, include-in-spendable | ~4 |
| Category | `app/category/new.tsx` | name, icon, colour, parent, direction, budget | ~4 |
| Tag | `app/tag/…` | name | 1 |

The budget form has already been split into three steps and that is the reference point: it worked,
but it is also the form the user is least often in.

## What to answer

### 1. Which of the four patterns each form should use

- **Flat screen** (today). Cheap, everything visible at once *if* it fits. Right for one or two
  fields.
- **Multi-step.** Right when the fields are genuinely sequential and the form is entered rarely:
  each step is a decision, and a step cannot hide a field because it *is* the screen. Costs a
  Stepper, back/next state and a rule per step (`budgetStepReady` is the pattern).
- **Rows that open a sub-screen or sheet.** The iOS Settings shape: the form becomes a short list of
  rows showing their current value, each opening its own picker. Nothing is ever below the fold
  because the form is n rows long, not n sections. Costs a screen or sheet per field, and makes
  every change two taps instead of one.
- **Grouping.** Fewer fields rather than a different shape: merge, default, or hide behind a "more"
  disclosure the things almost nobody changes.

Answer it per form, with the count of fields and how often the form is opened as the evidence.

### 2. The transaction form is the exception, and must stay one

The user put it plainly: *"se io voglio inserire diverse transazioni velocemente avere un multistep
non so se è la soluzione più veloce"*. That is the whole argument — this is the screen the app
exists for, and the common case is *add one and leave*, repeatedly.

So for this one form the question is not "which pattern" but **"what is the shortest path to a
saved expense, and what is allowed to be in the way of it"**. Constraints to hold:

- Amount and category are the two things that always change. Everything else has a default that is
  right most of the time (today's date, the last account, no tags, no attachment).
- It is now presented as a sheet, so dismissing is a swipe — cheap. Committing should be equally
  cheap: measure the taps from FAB to saved.
- A step count is a tax paid on **every** entry. A scroll is paid only by the entries that need the
  field at the bottom. That asymmetry is the reason multi-step is probably wrong here and probably
  right for a budget.
- §B's open questions belong here: what a "more" disclosure hides, whether recents should be
  period-scoped, and whether `note` and `excludeFromTotals` belong on the first screen at all.

### 3. What "you can scroll" should look like

Whatever the shape, the flat screens that remain need a cue that there is more below. Options,
cheapest first: content that visibly continues under the footer (padding that guarantees a partial
row is visible), a fading edge over the footer, a scroll indicator that is not hidden. Pick one and
apply it everywhere, not per screen.

### 4. Edit is not create

Create is a sequence: nothing is set, the order is the order of decisions. Edit is random access:
you came for one field and you know which. A wizard is actively hostile there — the budget form
already draws this line (`mode === 'edit'` stays one page) and whatever the other forms do should
draw it the same way.

### 5. Sheets versus screens for the sub-pickers

The app now has both: `CategoryPickerSheet` and `DateSheet` are sheets, `profile/*` settings are
screens. The rule that emerged is worth writing down: **a sheet for a choice made and closed, a
screen for a choice with a footnote, a confirmation, or its own list to manage.** Check the
existing pickers against it, and make icon/colour pickers follow it too.

## Deliverable

A scope naming, for each of the five forms: the pattern it takes, what (if anything) is grouped or
dropped, and what its edit mode does differently. Plus the scroll-cue decision, applied once in
`Screen` rather than five times.

## Out of scope

Rewriting `Screen` into a form framework, drag-to-reorder inside forms, and anything that changes
what is stored rather than how it is asked for.
