# Debit card as an account type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `debit_card` is an account type next to `cash`, `checking`, `credit_card`, `savings` and `investment`,
offered in the account sheet and in onboarding step 2.

**Architecture:** One more value in `accountTypeSchema`, which the server (`entitySchemas`), the phone's pull
(`localStore.ts`) and the backup parser already validate with. The hand-written copies of the list in the mobile app
become `AccountType` / `accountTypeSchema.options`, so the next type is a one-line change. Onboarding step 2 swaps its
four-way `Segmented` for the prototype's three-column tile grid (`Spese.dc.html` 1660–1665), which has room for all
six types.

**Tech Stack:** `@saldo/core` Zod + vitest; Expo + jest-expo + Testing Library; `@saldo/i18n`.

**Branch:** `feat/debit-card`. The item leaves `TODO.md` in the last commit.

---

## Decisions

**Decided with the user (2026-09-17):**

- A debit card is **its own account** with its own balance, not a payment method attached to a current account.
- It **is offered in onboarding step 2**.

**Decisions where the spec is silent** (recorded here per AGENTS.md):

- It behaves like `checking`: `includeInSpendable` defaults to true, and a transfer that overdraws it is caught
  (`transferOverdrawsSource` only exempts `credit_card`). No close/charge days.
- Its icon is `card`, the same glyph as a credit card; the type label tells them apart. `accountIconOptions` does not
  change.
- Order everywhere: cash, checking, debit card, credit card, savings, investment — the order of the enum.
- Five segments cannot fit a 390pt phone ("Carta di credito" would need 65% of the footnote size), so step 2 uses the
  prototype's tile grid: icon over label, three columns, a label may take two lines. With a grid there is no width
  reason left to hide `investment`, so step 2 offers **all six types**, as the prototype does.
- The onboarding account gets the icon of its type (it was always `landmark`).
- `SYNC_SCHEMA_VERSION` stays at 1: no public users, no older peer to protect. Rebuild the app and redeploy the server
  together. No SQLite migration: `accounts.type` is plain `text`.

---

## File map

| File | Change |
| --- | --- |
| `packages/core/src/entities.ts` (+ test) | `debit_card` in `accountTypeSchema` |
| `packages/core/src/accounts.test.ts` | a debit card is not exempt from the overdraw check |
| `packages/i18n/src/locales/it.ts`, `en.ts` | `accountTypes.debit_card` |
| `apps/mobile/src/db/schema.ts`, `db/seed.ts`, `features/onboarding/state.tsx` | `AccountType` instead of a literal union |
| `apps/mobile/src/features/accounts/AccountTypeSheet.tsx` | `ACCOUNT_TYPES = accountTypeSchema.options` |
| `apps/mobile/src/features/accounts/accountTypeIcon.ts` | type → icon |
| `apps/mobile/src/features/accounts/AccountTypeGrid.tsx` (+ test) | the tile grid |
| `apps/mobile/app/(onboarding)/account-details.tsx`, `categories.tsx` | use the grid; icon from type |
| `apps/mobile/scripts/measure-performance.ts` | include the new type |
| spec §4, §6.29; `TODO.md`; `docs/superpowers/plans/README.md` | docs |

---

### Task 1: `debit_card` in `@saldo/core`

**Files:** `packages/core/src/entities.ts`, `entities.test.ts`, `accounts.test.ts`

- [ ] **Step 1: failing tests.** In `entities.test.ts` import `accountTypeSchema` and add:

```ts
describe('accountTypeSchema', () => {
  it('knows a debit card, between a current account and a credit card', () => {
    expect(accountTypeSchema.options).toEqual([
      'cash',
      'checking',
      'debit_card',
      'credit_card',
      'savings',
      'investment',
    ]);
  });
});
```

In `accounts.test.ts`, `describe('transferOverdrawsSource')`:

```ts
  it('catches a debit card going below zero, as it would a current account', () => {
    expect(transferOverdrawsSource({ type: 'debit_card' }, { now: 5000, after: -1000 })).toBe(true);
  });
```

- [ ] **Step 2:** `pnpm --filter @saldo/core test` — both fail (enum mismatch; `'debit_card'` is a type error / parse).
- [ ] **Step 3:** add `'debit_card'` after `'checking'` in `accountTypeSchema`.
- [ ] **Step 4:** tests pass. Commit `feat(core): a debit card account type`.

### Task 2: labels

- [ ] `accountTypes.debit_card`: `'Carta di debito'` / `'Debit card'`. The parity test passes.
      Commit `feat(i18n): the debit card account type`.

### Task 3: the mobile app follows the enum

- [ ] `db/schema.ts` `.$type<AccountType>()`, `SeedInput.account.type: AccountType`, `OnboardingDraft.accountType:
      AccountType` (all `import type { AccountType } from '@saldo/core'`).
- [ ] `AccountTypeSheet.tsx`: `export const ACCOUNT_TYPES = accountTypeSchema.options;` (comment "Five options" →
      no count).
- [ ] `scripts/measure-performance.ts`: add `'debit_card'` to its list.
- [ ] `pnpm typecheck`. Commit `feat(mobile): the account sheet offers a debit card`.

### Task 4: onboarding step 2 as a tile grid

- [ ] **Step 1: failing test** `src/features/accounts/AccountTypeGrid.test.tsx` (same `Host` as `AccountForm.test.tsx`):
      six radios labelled with the English type names, the chosen one `checked`, pressing "Debit card" calls
      `onChange('debit_card')`, and each label may take two lines.
- [ ] **Step 2:** `accountTypeIcon.ts`:

```ts
export const ACCOUNT_TYPE_ICONS = {
  cash: 'coins', checking: 'landmark', debit_card: 'card',
  credit_card: 'card', savings: 'piggy', investment: 'trend',
} as const satisfies Record<AccountType, IconName>;
```

- [ ] **Step 3:** `AccountTypeGrid.tsx`: `radiogroup` of `ACCOUNT_TYPES`, tiles `width: '31%'`, `minHeight: 70`,
      `padding: 10`, `gap: 9`, `borderRadius: theme.radii.input`, border `borderStrong`/`border`, selected background
      `accent` with `onAccent` icon and text; `Text size="caption" numberOfLines={2}`.
- [ ] **Step 4:** `account-details.tsx` renders `AccountTypeGrid` instead of `Segmented`; `categories.tsx` passes
      `icon: ACCOUNT_TYPE_ICONS[draft.accountType]`.
- [ ] **Step 5:** tests pass. Commit `feat(mobile): onboarding offers every account type as a tile`.

### Task 5: docs

- [ ] Spec §4 `type` row and `includeInSpendable` defaults; §6.29 step 2 names the tile grid.
- [ ] Item leaves `TODO.md`; `README.md` gets a "Picked up from TODO.md" entry.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` through `rtk proxy`. Commit `docs: debit card account type`.
