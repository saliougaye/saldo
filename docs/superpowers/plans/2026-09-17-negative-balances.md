# Negative account balances — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an account's balance can be entered below zero, in the account sheet (§6.22) and in onboarding step 3.

**Architecture:** the sign lives in the keypad buffer as a leading `-`, so `AccountFormValues.buffer` and
`OnboardingDraft.balanceBuffer` keep their shape. `@saldo/core` learns to read and write that sign
(`amountBufferToMinor`, `minorToAmountBuffer`), to keep it while sanitising only when a field allows it
(`sanitizeAmountInput(…, { allowNegative })`), and to flip it (`toggleAmountBufferSign`). `AmountInput` gets an
opt-in `allowNegative` that shows a `±` switch before the amount — the device's `decimal-pad` has no minus key on iOS.
Transaction, budget and category amounts stay positive: they do not opt in.

**Tech Stack:** `@saldo/core` + vitest; Expo + jest-expo + Testing Library; `@saldo/i18n`.

**Branch:** `feat/negative-balances`. The item leaves `TODO.md` in the last commit.

---

## Decisions

**Decided with the user (2026-09-17):**

- The sign control is a **`±` toggle beside the amount**, the same on the account sheet and in onboarding, for every
  account type. A typed or pasted minus is accepted too.

**Decisions where the spec is silent** (recorded here per AGENTS.md):

- The field shows the minus as U+2212 `−` (§5.1), but the buffer stores `-`. Sanitising accepts either.
- A minus anywhere in the edited text makes the amount negative: the caret can sit before the sign when a digit is
  typed, and the sign must not be lost then.
- `-` on its own is a valid buffer: the user may flip the sign before typing. It reads as 0; `-0` never becomes `-0`.
- The toggle is a `switch` for assistive technology, labelled "Negative" / "Negativo", checked when the buffer is
  negative.
- **Bug fixed on the way:** `minorToAmountBuffer` dropped the sign, so editing a credit card at −412,35 € showed
  412,35 and saving — even just a rename — stored +412,35. It now keeps the sign. Its other callers
  (`useTransactionForm`, `CategoryForm`) only ever pass positive amounts.
- Credit cards are not special-cased ("Da rimborsare" in the prototype): the balance is the balance.

---

## File map

| File | Change |
| --- | --- |
| `packages/core/src/money.ts` (+ test) | signed buffer: sanitise, parse, format, toggle |
| `packages/i18n/src/locales/it.ts`, `en.ts` | `common.negative` |
| `apps/mobile/src/components/AmountInput.tsx` (+ `a11y.test.tsx`) | `allowNegative`, `negativeLabel`, `±` switch |
| `apps/mobile/src/features/accounts/AccountForm.tsx` (+ test) | opts in |
| `apps/mobile/app/(onboarding)/balance.tsx` | opts in |
| spec §5.1, §6.22, §6.29; `TODO.md`; `docs/superpowers/plans/README.md` | docs |

---

### Task 1: a signed buffer in `@saldo/core`

**Files:** `packages/core/src/money.ts`, `money.test.ts`

- [x] **Step 1: failing tests.**

```ts
describe('sanitizeAmountInput with allowNegative', () => {
  it('keeps a minus, typed as a hyphen or as U+2212, wherever the caret put it', () => {
    expect(sanitizeAmountInput('-12', 2, { allowNegative: true })).toBe('-12');
    expect(sanitizeAmountInput('−12,5', 2, { allowNegative: true })).toBe('-12.5');
    expect(sanitizeAmountInput('1−2', 2, { allowNegative: true })).toBe('-12');
  });
  it('keeps a lone minus so the sign can come before the digits', () => {
    expect(sanitizeAmountInput('-', 2, { allowNegative: true })).toBe('-');
    expect(sanitizeAmountInput('-05', 2, { allowNegative: true })).toBe('-5');
    expect(sanitizeAmountInput('-.5', 2, { allowNegative: true })).toBe('-0.5');
  });
  it('still drops the minus by default', () => {
    expect(sanitizeAmountInput('−12', 2)).toBe('12');
  });
});
```

and in `amountBufferToMinor / minorToAmountBuffer`: `'-12.5'` → `-1250`, `'-'` → `0`, `'-0'` → `0` (`Object.is(…, 0)`),
`minorToAmountBuffer(-41235, 2)` → `'-412.35'` (replacing the old unsigned expectation), negative values in the
round-trip, and `toggleAmountBufferSign`: `'' → '-'`, `'-' → ''`, `'12.5' → '-12.5'`, `'-12.5' → '12.5'`.

- [x] **Step 2:** `pnpm --filter @saldo/core test` — they fail.
- [x] **Step 3:** implement (below). - [x] **Step 4:** tests pass. Commit `feat(core): an amount buffer can carry a sign`.

```ts
export interface AmountInputOptions {
  /** Keep a minus sign (`-` or U+2212) as a leading `-`. Only balances allow one. */
  allowNegative?: boolean;
}

export function sanitizeAmountInput(text, minorDigits, options: AmountInputOptions = {}) {
  const sign = options.allowNegative === true && /[-−]/.test(text) ? '-' : '';
  // …existing body computes `unsigned`…
  return sign + unsigned;
}

export function toggleAmountBufferSign(buffer: string): string {
  return buffer.startsWith('-') ? buffer.slice(1) : `-${buffer}`;
}
```

`amountBufferToMinor` strips a leading `-`, parses the rest and returns `value === 0 ? 0 : -value` when negative.
`minorToAmountBuffer` prefixes `-` when `minor < 0`.

### Task 2: label

- [x] `common.negative`: `'Negativo'` / `'Negative'`. Commit `feat(i18n): a label for the negative amount switch`.

### Task 3: the `±` switch

**Files:** `apps/mobile/src/components/AmountInput.tsx`, `a11y.test.tsx`, `features/accounts/AccountForm.tsx` (+ test),
`app/(onboarding)/balance.tsx`

- [x] **Step 1: failing tests.** In `a11y.test.tsx` `describe('AmountInput')`: without `allowNegative` there is no
      switch; with `allowNegative` and `negativeLabel="Negative"`, buffer `'-12.34'` shows `'−12.34'` in the field and a
      checked `switch` named "Negative"; pressing it calls `onChange('12.34')`; typing `'−5'` calls `onChange('-5')`.
      In `AccountForm.test.tsx`: `accountFormFrom` of an account at `-41235` gives buffer `'-412.35'`, and
      `openingBalanceFrom` of buffer `'-412.35'` for a new account gives `-41235`; the form shows the "Negative" switch.
- [x] **Step 2:** `AmountInput` props `allowNegative?: boolean` and `negativeLabel?: string`. When `allowNegative`,
      render before the currency symbol a 36×36 `Pressable` (`accessibilityRole="switch"`,
      `accessibilityState={{ checked: negative }}`, `hitSlop` 4, `borderRadius: theme.radii.chipSmall`, background
      `raised`, or `accent` when negative, with `Text size="headline"` `±` in `text` / `onAccent`) calling
      `onChange(toggleAmountBufferSign(buffer))`. The field's value swaps `-` for `−`; `onChangeText` passes
      `{ allowNegative }` to `sanitizeAmountInput`.
- [x] **Step 3:** `AccountForm` and onboarding `balance.tsx` pass `allowNegative` and `negativeLabel={t('common.negative')}`.
- [x] **Step 4:** tests pass. Commit `feat(mobile): a balance can be entered below zero`.

### Task 4: docs

- [x] Spec §5.1 (signed buffer, `±` switch), §6.22 and §6.29 step 3 (balance may be negative).
- [x] Item leaves `TODO.md`; `README.md` gets a "Picked up from TODO.md" entry.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` through `rtk proxy`. Commit `docs: negative account balances`.
- [x] Check on a device — *done by the user after execution (2026-09-17): working.*
