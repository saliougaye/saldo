# Import during onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** onboarding asks how to start — from scratch, from a CSV export (Spendee, Saldo, generic), or from a Saldo
backup — and an imported history starts with the balances the bank shows, not with zero.

**Architecture:** a new first onboarding screen, `start`, sets `draft.path`. *Fresh* is today's four steps. *Import* is
also four: 1 period, 2 currency, 3 the CSV wizard, 4 one current balance per imported account. The wizard in
`profile/import.tsx` becomes an `ImportWizard` component both screens render; onboarding keeps its plan in the draft
instead of writing it, so **nothing is written until "Inizia"**, as today. "Inizia" writes settings, the hidden seed
categories and the import in one SQLite transaction, with each account's `openingBalance = entered − Σ imported
effects` — the §6.22 edit rule, computed by a new core function. *Restore* opens the existing restore screen; a backup
carries its own settings, so the boot router takes it to the tabs.

**Tech Stack:** `@saldo/core` + vitest; Expo Router + jest-expo; `@saldo/i18n`; Maestro.

**Branch:** `feat/onboarding-import`. The item leaves `TODO.md` in the last commit.

---

## Decisions

**Decided with the user (2026-09-17):**

- The question is a **chooser before step 1**, not a screen after "Inizia": the import path skips the account and
  balance steps, so no hand-made account sits beside the imported ones.
- Imported accounts get a **current balance each**, stored as an opening balance (§6.22). No adjustment transactions.
- The import path **skips the category grid**: categories come from the file, plus the hidden seed rows seeding
  always writes (`refunds`, `gifts`).
- **Restoring a backup** is offered on the chooser too.

**Decisions where the spec is silent** (recorded here per AGENTS.md):

- The balance field starts at what the imported history adds up to (opening balance 0), so "Inizia" without edits
  means "the file is the whole story".
- Imported accounts are still created as `checking` (§11.3); changing a type is the account sheet's job.
- `applyImport` creates an account, category or tag **only if it is still missing when it writes**. On the import path
  the hidden seed categories are written just before the import, and a file with a "Regali" income category must not
  produce a second one. It also covers a sync landing between preview and confirm.
- If a sync delivered settings while onboarding was open, "Inizia" writes nothing, exactly as `seedFromOnboarding`
  already does (§8.3).
- The currency step offers the same four common currencies as fresh step 3.

---

## File map

| File | Change |
| --- | --- |
| `packages/core/src/io/importPlan.ts` (+ test) | `importedBalances(plan, today)` |
| `apps/mobile/src/io/importService.ts` (+ test) | `writeImport` without its own transaction; skip existing names; `openingBalances` |
| `apps/mobile/src/db/seed.ts` (+ test) | `account` may be `null` |
| `apps/mobile/src/features/onboarding/importOnboarding.ts` (+ test) | `seedFromImport` |
| `apps/mobile/src/features/onboarding/state.tsx` | `path`, `importPlan` |
| `apps/mobile/src/features/import/ImportWizard.tsx` | pick / map / preview, lifted from `profile/import.tsx` |
| `apps/mobile/src/components/CurrencyChips.tsx` | the four-currency row, lifted from `balance.tsx` |
| `apps/mobile/app/profile/import.tsx` | renders `ImportWizard`, applies on confirm, keeps the done state |
| `apps/mobile/app/(onboarding)/start.tsx`, `import-currency.tsx`, `import-file.tsx`, `import-balances.tsx` | new |
| `apps/mobile/app/(onboarding)/period.tsx`, `balance.tsx`, `app/index.tsx` | route by path; chips; boot to `/start` |
| `packages/i18n/src/locales/it.ts`, `en.ts` | `onboarding.start*`, `onboarding.import*` |
| `apps/mobile/maestro/onboarding-and-first-expense.yaml` | tap "start fresh" |
| spec §6.29, §11.3; `TODO.md`; `docs/superpowers/plans/README.md` | docs |

---

### Task 1: `importedBalances` in core

- [x] **Failing test** in `importPlan.test.ts`: a plan with two accounts, income and expense rows, and a row dated
      after `today` → `Map { 'My Money' → income − expense (future row ignored), 'Carta' → −amount }`; every name in
      `plan.newAccounts` is present, at 0 when it has no rows.
- [x] Implement:

```ts
/**
 * What each account's balance would be if the import were its whole history (§5.3 with an opening
 * balance of 0). Onboarding shows it as the starting balance, and subtracts it from the balance the
 * user enters to get the opening balance (§6.22).
 */
export function importedBalances(plan: ImportPlan, today: LocalDate): Map<string, MinorUnits> {
  const balances = new Map<string, MinorUnits>(plan.newAccounts.map((name) => [name, 0]));
  for (const row of plan.transactions) {
    if (row.date > today) continue;
    const signed = row.kind === 'income' ? row.amount : -row.amount;
    balances.set(row.accountName, (balances.get(row.accountName) ?? 0) + signed);
  }
  return balances;
}
```

- [x] Commit `feat(core): the balances an import adds up to`.

### Task 2: the import writer composes

- [x] **Failing tests** in `importService.test.ts`: (a) with an existing income category "Money Back", `applyImport`
      of a plan that lists it in `newCategories` creates no second one; (b) `applyImport(db, repos, plan,
      { openingBalances: new Map([['My Money', 12000]]) })` stores `openingBalance 12000`.
- [x] Split `applyImport` into `writeImport(repos, plan, options)` (no transaction) and `applyImport(db, repos, plan,
      options = {})` = `db.transaction(() => writeImport(…))`. Skip names already in the map;
      `openingBalance: options.openingBalances?.get(name) ?? 0`.
- [x] Commit `feat(mobile): an import can set opening balances and never duplicates a name`.

### Task 3: seeding without a first account

- [x] **Failing test** in `seed.test.ts`: `account: null, selectedCategoryKeys: []` writes settings, no account, and
      only the hidden categories.
- [x] `SeedInput.account` becomes `… | null`; skip the account when null.
- [x] **Failing test** `features/onboarding/importOnboarding.test.ts`: `seedFromImport(db, repos, input)` on the
      fixture plan writes settings (`onboardingCompletedAt`), `refunds`/`gifts`, the imported account with
      `openingBalance = entered − imported`, and the transactions; returns false and writes nothing when settings exist.
- [x] Implement:

```ts
export function seedFromImport(db, repos, input: ImportSeedInput): boolean {
  return db.transaction(() => {
    if (!seedFromOnboarding(repos, { ...input, account: null, selectedCategoryKeys: [] })) return false;
    const imported = importedBalances(input.plan, input.today);
    const openingBalances = new Map(
      [...input.currentBalances].map(([name, current]) => [name, current - (imported.get(name) ?? 0)]),
    );
    writeImport(repos, input.plan, { openingBalances });
    return true;
  });
}
```

- [x] Commit `feat(mobile): onboarding can seed from an import`.

### Task 4: the wizard and the chips become components

- [x] Move pick/map/preview from `profile/import.tsx` into `features/import/ImportWizard.tsx` with props
      `{ currency, context: () => Omit<ImportContext, 'currency'>, confirmLabel: (plan) => string,
      onConfirm: (plan) => void, confirming?: boolean }`. The profile screen keeps `done`, `applyImport` and the header.
- [x] Move the currency row from `balance.tsx` into `components/CurrencyChips.tsx` (`value`, `onChange`).
- [x] `pnpm typecheck` and the mobile tests pass (no behaviour change). Commit
      `refactor(mobile): the import wizard and currency chips are components`.

### Task 5: the onboarding screens

- [x] i18n (it / en): `onboarding.startTitle` "Come vuoi iniziare?" / "How do you want to start?",
      `startBody`, `startFresh` "Da zero" / "From scratch" + `startFreshHint`, `startImport` "Importa un export" /
      "Import an export" + `startImportHint`, `startRestore` "Ripristina un backup" / "Restore a backup" +
      `startRestoreHint`, `importCurrencyTitle`, `importCurrencyBody`, `importFileTitle`, `importFileBody`,
      `importBalancesTitle` "Quanto c'è adesso?" / "What's there now?", `importBalancesBody`.
- [x] `state.tsx`: `path: 'fresh' | 'import'` (default `fresh`), `importPlan: ImportPlan | null`.
- [x] `start.tsx`: title, body, one card with three `ListRow`s (`onboarding-start-fresh|import|restore`). Fresh and
      import set `path` and push `/period`; restore pushes `/profile/restore`.
- [x] `period.tsx` continues to `/account-details` or `/import-currency` by path. `app/index.tsx` redirects
      onboarding to `/start`.
- [x] `import-currency.tsx` (step 2 of 4): `CurrencyChips`, continue → `/import-file`.
- [x] `import-file.tsx` (step 3 of 4): `ImportWizard` with an empty context (nothing exists yet), confirm label
      `common.continue`; on confirm `setDraft({ importPlan })` and push `/import-balances`.
- [x] `import-balances.tsx` (step 4 of 4): per `plan.newAccounts` a card with the name and an `AmountInput`
      (`allowNegative`) starting at `minorToAmountBuffer(importedBalances(plan, today).get(name))`; "Inizia" →
      `seedFromImport`, then `enterTabs(router)`.
- [x] Maestro: tap `onboarding-start-fresh` before step 1. Commit `feat(mobile): onboarding offers an import or a
      restore`.

### Task 6: docs

- [x] Spec §6.29 (the chooser and the import path) and §11.3 (reachable from onboarding; names skipped when present;
      opening balances).
- [x] `TODO.md`: the item leaves; the settle item notes that onboarding already settles imported accounts.
- [x] `README.md` "Picked up from TODO.md" entry. `pnpm lint`, `pnpm typecheck`, `pnpm test` through `rtk proxy`.
      Commit `docs: import during onboarding`.
- [x] Check on a device — *done by the user after execution (2026-09-17): working.*
