# Investigation: how Saldo asks for things

**This is an investigation, not an implementation plan.** It ends in one decision per form and a
short written scope; the work that follows gets its own plan. Asked for by the user on
2026-09-11: *"creare/modificare un modello ora è una flat screen con tutte le informazioni ma se
non si scrolla le si perde"*.

**Read first:** `docs/design/README.md`, the design line ranges named per form below, and
`2026-09-11-ui-scoping.md` §B, which already decided part of the transaction form.

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
