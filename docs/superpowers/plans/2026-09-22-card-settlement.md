# Credit cards: settle the card from its payment account — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a credit card knows the account it is charged to, what its closed statement still owes and when; "Salda
carta" opens a pre-filled transfer for it, a local reminder fires on the charge day, and a transfer that takes a card
into credit is flagged (not blocked).

**Architecture:** the rules are pure functions in `@saldo/core/accounts.ts` (`creditStatementDue`,
`creditSettlementDraft`, `creditChargeReminders`, `paymentAccountCandidates`, `transferOverpaysCard`) with vitest
tests first. The mobile app keeps two small pure helpers next to their screens (`features/accounts/settlement.ts`:
draft → route params → form values; `features/accounts/cardReminders.ts`: reminder ids, trigger date, tap payload),
tested in the node jest project. Screens only load data, call these, and render. The transfer sheet is the existing
`transaction/new` route, which learns to read pre-fill params. No schema change: `creditPaymentAccountId` already
exists in §4, the SQLite table and the sync payload, so **no migration** and `SYNC_SCHEMA_VERSION` stays at 1.

**Tech Stack:** `@saldo/core` + vitest; Expo SDK 57 (`expo-notifications` date trigger, response listener), jest-expo
+ Testing Library; `@saldo/i18n`.

**Branch:** `feat/card-settlement`. The item leaves `TODO.md` in the last commit.

---

## Decisions

**Decided with the user (2026-09-22):**

- The sheet's default amount is the **closed statement** still due; a second one-tap chip "Tutto il saldo" sets the
  whole debt. Nothing is written until the user saves. No automatic charge, no clamping at 0.
- The reminder fires at **09:00 local** on the charge day.

**Decisions where the spec is silent** (recorded per AGENTS.md):

- **What the statement owes.** `statement = max(0, −balance on the close date)` (the close day belongs to the statement
  it closes, as `creditStatementAccrued` already assumes). `paid` = transfers **into** the card dated after the close
  date and up to the later of the day before the next close and the charge date — so a payment recorded early, late
  (after the charge day), or scheduled for the charge day all count. `due = max(0, min(statement − paid, owed now))`.
  - A **refund** (income on the card) before the close is in the closed balance. One after the close goes to the next
    statement, as banks do, except that `due` never exceeds what the whole card owes today, so a refund that leaves the
    card owing less than the statement caps it.
  - A **card in credit** at the close owes 0. **No close day** → no statement at all (`null`): the card box shows no
    settlement line and "Salda carta" pre-fills the whole balance, with no chips.
- **Transfer date.** When something is due: the statement's charge date, or today if that has passed (an overdue
  statement is paid today) or the card has no charge day. When the statement is already paid, today.
- **Description.** `accounts.settleDescription` = "Saldo {{card}} · {{month}}", month = `formatMonthYear` of the
  statement's close date ("Saldo Visa · aprile 2026"); without a statement, the month of the transfer date.
- **Payment account.** Only non-card, non-archived accounts, and never the card itself. If the stored one has since
  been archived (or is a card), the sheet opens with "Da" empty rather than on a hidden account.
- **Card box** (account detail). Shown for every non-archived-or-archived credit card that has something to show.
  When a statement is due and there is a charge date, the "Prossimo addebito" row becomes "Da saldare il {date}" with
  the amount on the right (same date, so not both); when the statement is paid, a muted "Estratto conto saldato" line.
  The prototype's credit note (`Spese.dc.html` 3061: "…l'addebito parte il {charge} su {account}") is shown when both
  days and the payment account are set. "Salda carta" is a `SecondaryButton` at the bottom of the box, shown when the
  card owes anything and is not archived.
- **Reminder.** One `DATE` trigger per card, id `card-charge:{accountId}`, at 09:00 of the charge date. Every run
  cancels all `card-charge:*` requests and schedules the current set, skipped when the set (ids, times, titles) has not
  changed since the last run. Skipped when due is 0, the charge date is past, the trigger time has passed (today after
  09:00), or there is no charge day. Mounted in `app/(tabs)/_layout.tsx`, so it runs whenever the app is in use,
  whatever screen is open. Permission: exactly the `BudgetAlertsGate` flow (read, request if not granted), but only
  when there is something to schedule. The title follows hidden mode (dots instead of the amount): a lock-screen
  banner is exactly what hiding is for.
- **Tap.** The notification carries `{ kind: 'cardCharge', accountId }`. The tabs layout listens for responses (and
  reads the last one on mount, for a cold start) and pushes `/account/[id]`. The push is deferred one tick and dropped
  if the tabs have unmounted: a tap that also re-locks the app replaces the tabs with the lock (`startOver`), and the
  account must not open over it. A foreground presentation handler is still not set (same as budget alerts): a
  reminder that fires while the app is open is not shown. Noted, not changed.
- **Overpay warning.** `transferOverpaysCard` mirrors `transferOverdrawsSource` on the destination: a muted footer
  line "La carta andrà in attivo di {amount}." that never disables save. Like the funds check, it only speaks when the
  transfer moves today's balance (a future-dated one does not, `after === now`).
- **Motion / press feedback.** No new motion. Amount shortcuts are `Chip`s (scale 0.96 + opacity on press, the
  better-ui value); "Salda carta" reuses `SecondaryButton` (opacity on press) to stay consistent with every other
  button — adding scale to the button primitives is an app-wide change outside this item.
- **Import** keeps `creditPaymentAccountId: null`: neither the Spendee CSV nor the generic one carries it.

---

## File map

| File | Change |
| --- | --- |
| `packages/core/src/accounts.ts` (+ test) | the five functions above |
| `packages/i18n/src/locales/it.ts`, `en.ts` | `accounts.*` and `txForm.cardInCredit` keys |
| `apps/mobile/src/features/accounts/PaymentAccountSheet.tsx` | new: pick the payment account |
| `apps/mobile/src/features/accounts/AccountForm.tsx` (+ test) | `creditPaymentAccountId` value, "Addebitata su" row |
| `apps/mobile/app/account/new.tsx`, `app/account/edit/[id].tsx` | write it |
| `apps/mobile/src/features/accounts/settlement.ts` (+ test) | draft ↔ route params ↔ form |
| `apps/mobile/app/transaction/new.tsx` | read the pre-fill params |
| `apps/mobile/src/features/transactions/TransactionForm.tsx` | `amountShortcuts` chips, overpay warning |
| `apps/mobile/app/account/[id].tsx` | card box: settlement line, note, "Salda carta" |
| `apps/mobile/src/features/accounts/cardReminders.ts` (+ test) | ids, trigger date, plan, tap payload |
| `apps/mobile/src/features/accounts/CardRemindersGate.tsx` | schedule the reminders |
| `apps/mobile/src/navigation/useNotificationRoutes.ts` | tap → card detail |
| `apps/mobile/app/(tabs)/_layout.tsx` | mount both |
| spec §5.3, §6.10, §6.16, §6.22; `TODO.md`; plans `README.md` | docs |

---

### Task 1: `creditStatementDue` in core

**Files:** `packages/core/src/accounts.ts`, `packages/core/src/accounts.test.ts`

- [x] **Step 1: failing tests** (fixtures: `acc-card` closes on the 20th, is charged on the 5th, `TODAY` 2026-04-18,
  so the last close is 2026-03-20 and the statement is charged 2026-04-05).

```ts
describe('creditStatementDue', () => {
  const card = ACCOUNTS[0] as AccountRef; // acc-card, close 20, charge 5
  const spend = (date: string, amount: number) => tx({ date, amount, accountId: 'acc-card' });
  const pay = (date: string, amount: number) =>
    tx({ date, amount, kind: 'transfer', accountId: 'acc-checking', toAccountId: 'acc-card', categoryId: null });

  it('owes the balance at the last close day, charged on the next charge day', () => {
    const txs = [spend('2026-03-10', 30000), spend('2026-03-20', 2000), spend('2026-04-01', 5000)];
    expect(creditStatementDue(card, txs, TODAY)).toEqual({
      closeDate: '2026-03-20', chargeDate: '2026-04-05', statement: 32000, due: 32000,
    });
  });

  it('counts a payment made before the close in the statement itself', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-03-15', 30000), spend('2026-03-25', 5000)];
    expect(creditStatementDue(card, txs, TODAY)?.due).toBe(0);
  });

  it('subtracts a partial payment made after the close', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-02', 10000)];
    expect(creditStatementDue(card, txs, TODAY)?.due).toBe(20000);
  });

  it('counts a payment already scheduled for the charge day', () => {
    const today = '2026-03-25';
    const txs = [spend('2026-03-10', 30000), pay('2026-04-05', 30000)];
    expect(creditStatementDue(card, txs, today)?.due).toBe(0);
  });

  it('counts a payment made after the charge day, until the next close', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-10', 30000)];
    expect(creditStatementDue(card, txs, TODAY)?.due).toBe(0);
  });

  it('keeps a refund after the close for the next statement, unless the card owes less', () => {
    const refund = (date: string, amount: number) =>
      tx({ date, amount, kind: 'income', accountId: 'acc-card', categoryId: 'cat-salary' });
    const withSpending = [spend('2026-03-10', 30000), spend('2026-04-01', 20000), refund('2026-04-02', 10000)];
    expect(creditStatementDue(card, withSpending, TODAY)?.due).toBe(30000);
    const refundOnly = [spend('2026-03-10', 30000), refund('2026-04-02', 10000)];
    expect(creditStatementDue(card, refundOnly, TODAY)?.due).toBe(20000);
  });

  it('counts a refund before the close in the statement', () => {
    const txs = [
      spend('2026-03-10', 30000),
      tx({ date: '2026-03-12', amount: 10000, kind: 'income', accountId: 'acc-card', categoryId: 'cat-salary' }),
    ];
    expect(creditStatementDue(card, txs, TODAY)?.statement).toBe(20000);
  });

  it('owes nothing when the card was in credit at the close', () => {
    const txs = [spend('2026-03-10', 1000), pay('2026-03-12', 5000)];
    expect(creditStatementDue(card, txs, TODAY)).toMatchObject({ statement: 0, due: 0 });
  });

  it('never owes more than the card owes today', () => {
    const txs = [spend('2026-03-10', 30000), pay('2026-04-02', 50000)];
    expect(creditStatementDue(card, txs, TODAY)?.due).toBe(0);
  });

  it('has no statement without a close day, and no charge date without a charge day', () => {
    expect(creditStatementDue({ ...card, creditCloseDay: null }, [], TODAY)).toBeNull();
    expect(creditStatementDue({ ...card, creditChargeDay: null }, [], TODAY)?.chargeDate).toBeNull();
  });

  it('is only about credit cards', () => {
    expect(creditStatementDue({ ...card, type: 'checking' }, [], TODAY)).toBeNull();
  });

  it('closes today on the close day', () => {
    const txs = [spend('2026-04-20', 1000)];
    expect(creditStatementDue(card, txs, '2026-04-20')).toMatchObject({
      closeDate: '2026-04-20', chargeDate: '2026-05-05', statement: 1000,
    });
  });
});
```

- [x] **Step 2:** `rtk proxy pnpm --filter @saldo/core test -- accounts` → FAIL, `creditStatementDue` not exported.
- [x] **Step 3: implement** in `accounts.ts`, after `nextCreditChargeDate`:

```ts
/** A credit card's closed statement and what is left to pay of it (§5.3). */
export interface CreditStatement {
  /** The close day that ended the statement: the last one on or before today. */
  closeDate: LocalDate;
  /** When the bank takes it — the first charge day after the close — or null with no charge day. */
  chargeDate: LocalDate | null;
  /** What the card owed on the close date; 0 if it was in credit. */
  statement: MinorUnits;
  /** What is still to pay of it. */
  due: MinorUnits;
}

export function creditStatementDue(
  account: AccountRef,
  txs: readonly LedgerTx[],
  today: LocalDate,
): CreditStatement | null {
  if (account.type !== 'credit_card' || account.creditCloseDay === null) return null;
  const cycle = cycleContaining(today, account.creditCloseDay);
  const closeDate = cycle.start;
  const chargeDate =
    account.creditChargeDay === null ? null : nextCreditChargeDate(account.creditChargeDay, closeDate);
  const windowEnd = chargeDate !== null && chargeDate > cycle.end ? chargeDate : cycle.end;
  const balanceOn = (date: LocalDate): MinorUnits =>
    accountBalances([account], txs, date).get(account.id) ?? 0;
  const statement = creditCardDue(balanceOn(closeDate));
  let paid = 0;
  for (const tx of txs) {
    if (tx.kind !== 'transfer' || tx.toAccountId !== account.id) continue;
    if (tx.date <= closeDate || tx.date > windowEnd) continue;
    paid += tx.amount;
  }
  const due = Math.max(0, Math.min(statement - paid, creditCardDue(balanceOn(today))));
  return { closeDate, chargeDate, statement, due };
}
```

- [x] **Step 4:** same command → PASS.
- [x] **Step 5:** commit `feat(core): creditStatementDue for a card's closed statement`.

### Task 2: settlement draft, candidates, reminders, overpay check in core

**Files:** `packages/core/src/accounts.ts`, `packages/core/src/accounts.test.ts`

- [x] **Step 1: failing tests**

```ts
describe('paymentAccountCandidates', () => {
  it('offers live accounts that are not cards and not the card itself', () => {
    const list = [
      ...ACCOUNTS,
      { ...(ACCOUNTS[0] as AccountRef), id: 'acc-card-2' },
    ];
    expect(paymentAccountCandidates(list, 'acc-card').map((a) => a.id)).toEqual([
      'acc-checking',
      'acc-savings',
    ]);
  });
});

describe('creditSettlementDraft', () => {
  const card = { ...(ACCOUNTS[0] as AccountRef), creditPaymentAccountId: 'acc-checking' };
  const spend = (date: string, amount: number) => tx({ date, amount, accountId: 'acc-card' });

  it('pays the statement from the payment account on the charge day', () => {
    const txs = [spend('2026-04-10', 30000), spend('2026-04-19', 5000)];
    expect(creditSettlementDraft(card, ACCOUNTS, txs, '2026-04-25')).toEqual({
      fromAccountId: 'acc-checking',
      toAccountId: 'acc-card',
      statementAmount: 30000,
      balanceAmount: 35000,
      amount: 30000,
      date: '2026-05-05',
      statementDate: '2026-04-20',
    });
  });

  it('pays an overdue statement today', () => {
    const txs = [spend('2026-03-10', 30000)];
    expect(creditSettlementDraft(card, ACCOUNTS, txs, TODAY)).toMatchObject({ amount: 30000, date: TODAY });
  });

  it('offers the whole balance, today, once the statement is paid', () => {
    const txs = [spend('2026-04-01', 5000)];
    expect(creditSettlementDraft(card, ACCOUNTS, txs, TODAY)).toMatchObject({
      statementAmount: 0, balanceAmount: 5000, amount: 5000, date: TODAY,
    });
  });

  it('falls back to the whole balance without a close day', () => {
    const txs = [spend('2026-04-01', 5000)];
    expect(
      creditSettlementDraft({ ...card, creditCloseDay: null }, ACCOUNTS, txs, TODAY),
    ).toMatchObject({ statementAmount: null, amount: 5000, date: TODAY, statementDate: TODAY });
  });

  it('leaves the source empty when the payment account is gone or archived', () => {
    expect(creditSettlementDraft({ ...card, creditPaymentAccountId: 'acc-old' }, ACCOUNTS, [], TODAY).fromAccountId).toBeNull();
    expect(creditSettlementDraft({ ...card, creditPaymentAccountId: null }, ACCOUNTS, [], TODAY).fromAccountId).toBeNull();
  });
});

describe('creditChargeReminders', () => {
  const spend = (date: string, amount: number) => tx({ date, amount, accountId: 'acc-card' });

  it('reminds on the charge day of a statement still due', () => {
    const txs = [spend('2026-04-10', 30000)];
    expect(creditChargeReminders(ACCOUNTS, txs, '2026-04-25')).toEqual([
      { accountId: 'acc-card', date: '2026-05-05', amount: 30000 },
    ]);
  });

  it('includes the charge day itself', () => {
    const txs = [spend('2026-04-10', 30000)];
    expect(creditChargeReminders(ACCOUNTS, txs, '2026-05-05')).toHaveLength(1);
  });

  it('skips a paid statement, a passed charge day, a card without one, and archived cards', () => {
    const paid = [
      spend('2026-04-10', 30000),
      tx({ date: '2026-05-05', amount: 30000, kind: 'transfer', accountId: 'acc-checking', toAccountId: 'acc-card', categoryId: null }),
    ];
    expect(creditChargeReminders(ACCOUNTS, paid, '2026-04-25')).toEqual([]);
    expect(creditChargeReminders(ACCOUNTS, [spend('2026-03-10', 30000)], TODAY)).toEqual([]);
    const noCharge = ACCOUNTS.map((a) => (a.id === 'acc-card' ? { ...a, creditChargeDay: null } : a));
    expect(creditChargeReminders(noCharge, [spend('2026-04-10', 30000)], '2026-04-25')).toEqual([]);
    const archived = ACCOUNTS.map((a) => (a.id === 'acc-card' ? { ...a, archivedAt: '2026-04-01T00:00:00.000Z' } : a));
    expect(creditChargeReminders(archived, [spend('2026-04-10', 30000)], '2026-04-25')).toEqual([]);
  });
});

describe('transferOverpaysCard', () => {
  const card = { type: 'credit_card' } as const;
  it('flags a transfer that takes a card into credit', () => {
    expect(transferOverpaysCard(card, { now: -5000, after: 1000 })).toBe(true);
  });
  it('lets a card be paid off exactly, or stay in debt', () => {
    expect(transferOverpaysCard(card, { now: -5000, after: 0 })).toBe(false);
    expect(transferOverpaysCard(card, { now: -5000, after: -1000 })).toBe(false);
  });
  it('is quiet when the transfer moves nothing, for other accounts, or without a preview', () => {
    expect(transferOverpaysCard(card, { now: 1000, after: 1000 })).toBe(false);
    expect(transferOverpaysCard({ type: 'checking' }, { now: -5000, after: 1000 })).toBe(false);
    expect(transferOverpaysCard(undefined, { now: -5000, after: 1000 })).toBe(false);
    expect(transferOverpaysCard(card, null)).toBe(false);
  });
});
```

- [x] **Step 2:** run → FAIL.
- [x] **Step 3: implement** (after `creditStatementDue`, and `transferOverpaysCard` after `transferOverdrawsSource`):

```ts
export const CREDIT_REMINDER_HOUR = 9;

/** Where a card may be charged: live accounts that hold money, never a card (§6.22). */
export function paymentAccountCandidates<T extends Pick<AccountRef, 'id' | 'type' | 'archivedAt'>>(
  accounts: readonly T[],
  cardId: string | null,
): T[] {
  return accounts.filter(
    (account) => account.type !== 'credit_card' && account.archivedAt === null && account.id !== cardId,
  );
}

/** What "Salda carta" pre-fills; the user still edits and saves it. */
export interface CreditSettlementDraft {
  fromAccountId: string | null;
  toAccountId: string;
  /** Closed statement still due; null when the card has no close day. */
  statementAmount: MinorUnits | null;
  /** Everything the card owes today. */
  balanceAmount: MinorUnits;
  amount: MinorUnits;
  date: LocalDate;
  /** The day whose month the description names. */
  statementDate: LocalDate;
}

export function creditSettlementDraft(
  card: AccountRef & Pick<Account, 'creditPaymentAccountId'>,
  accounts: readonly Pick<AccountRef, 'id' | 'type' | 'archivedAt'>[],
  txs: readonly LedgerTx[],
  today: LocalDate,
): CreditSettlementDraft {
  const statement = creditStatementDue(card, txs, today);
  const balanceAmount = creditCardDue(accountBalances([card], txs, today).get(card.id) ?? 0);
  const payable = statement !== null && statement.due > 0;
  const date =
    payable && statement.chargeDate !== null && statement.chargeDate > today ? statement.chargeDate : today;
  const from = paymentAccountCandidates(accounts, card.id).find(
    (account) => account.id === card.creditPaymentAccountId,
  );
  return {
    fromAccountId: from?.id ?? null,
    toAccountId: card.id,
    statementAmount: statement?.due ?? null,
    balanceAmount,
    amount: payable ? statement.due : balanceAmount,
    date,
    statementDate: statement?.closeDate ?? date,
  };
}

export interface CreditChargeReminder {
  accountId: string;
  date: LocalDate;
  amount: MinorUnits;
}

/** One reminder per live card whose statement is still due on a charge day from today on. */
export function creditChargeReminders(
  accounts: readonly AccountRef[],
  txs: readonly LedgerTx[],
  today: LocalDate,
): CreditChargeReminder[] {
  const out: CreditChargeReminder[] = [];
  for (const account of accounts) {
    if (account.archivedAt !== null) continue;
    const statement = creditStatementDue(account, txs, today);
    if (statement === null || statement.chargeDate === null) continue;
    if (statement.due <= 0 || statement.chargeDate < today) continue;
    out.push({ accountId: account.id, date: statement.chargeDate, amount: statement.due });
  }
  return out;
}

/** The mirror of `transferOverdrawsSource` on the other end: a card paid past zero. A warning only. */
export function transferOverpaysCard(
  destination: Pick<AccountRef, 'type'> | undefined,
  preview: BalancePreview | null,
): boolean {
  if (destination === undefined || preview === null) return false;
  if (destination.type !== 'credit_card') return false;
  return preview.after > 0 && preview.after > preview.now;
}
```

- [x] **Step 4:** run → PASS; `rtk proxy pnpm --filter @saldo/core typecheck`.
- [x] **Step 5:** commit `feat(core): card settlement draft, charge reminders, overpay check`.

### Task 3: i18n keys

**Files:** `packages/i18n/src/locales/it.ts`, `en.ts` (in `accounts`, after `transferTo`; in `txForm` after
`missing_insufficientFunds`)

- [x] **Step 1:** add

| key | it | en |
| --- | --- | --- |
| `accounts.creditPaymentAccount` | Addebitata su | Paid from |
| `accounts.noPaymentAccount` | Nessuno | None |
| `accounts.creditNote` | Il ciclo chiude il {{close}} di ogni mese, l’addebito parte il {{charge}} su {{account}}. | The statement closes on day {{close}} of each month and is charged on day {{charge}} to {{account}}. |
| `accounts.dueOn` | Da saldare il {{date}} | Due on {{date}} |
| `accounts.statementPaid` | Estratto conto saldato | Statement paid |
| `accounts.settleCard` | Salda carta | Pay off card |
| `accounts.settleDescription` | Saldo {{card}} · {{month}} | {{card}} payment · {{month}} |
| `accounts.settleStatement` | Estratto conto | Statement |
| `accounts.settleBalance` | Tutto il saldo | Whole balance |
| `accounts.reminderTitle` | Carta {{name}}: {{amount}} da saldare oggi | Card {{name}}: {{amount}} due today |
| `txForm.cardInCredit` | La carta andrà in attivo di {{amount}}. | The card will be {{amount}} in credit. |

- [x] **Step 2:** `rtk proxy pnpm --filter @saldo/i18n test` → parity PASS. Commit `feat(i18n): card settlement copy`.

### Task 4: "Addebitata su" in the account sheet

**Files:** create `apps/mobile/src/features/accounts/PaymentAccountSheet.tsx`; modify `AccountForm.tsx`,
`AccountForm.test.tsx`, `app/account/new.tsx`, `app/account/edit/[id].tsx`

- [x] **Step 1: failing test** in `AccountForm.test.tsx`:

```tsx
it('picks the payment account of a credit card from live non-card accounts', async () => {
  const onChange = jest.fn();
  const checking = { ...accountFixture, id: 'a1', name: 'Conto BPM', type: 'checking' } as Account;
  const other = { ...accountFixture, id: 'a2', name: 'Amex', type: 'credit_card' } as Account;
  await render(
    <Host>
      <AccountForm
        values={{ ...emptyAccountForm(), type: 'credit_card' }}
        onChange={onChange}
        mode="new"
        onSubmit={jest.fn()}
        accounts={[checking, other]}
      />
    </Host>,
  );
  await userEvent.press(screen.getByText('Paid from'));
  expect(screen.queryByText('Amex')).toBeNull();
  await userEvent.press(screen.getByText('Conto BPM'));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ creditPaymentAccountId: 'a1' }));
});
```

(`accountFixture` = the file's existing account literal, or a new full `Account` constant in the test.)

- [x] **Step 2:** run `rtk proxy pnpm --filter mobile test -- AccountForm` → FAIL.
- [x] **Step 3: implement.**
  - `AccountFormValues.creditPaymentAccountId: string | null` (empty form `null`, `accountFormFrom` copies it).
  - `AccountFormProps.accounts?: readonly Account[]` (default `[]`) and `accountId?: string | null` (edit: the card's
    own id, excluded). Candidates = `paymentAccountCandidates(accounts, accountId)`.
  - Under the charge-day row, a `ListRow` titled `accounts.creditPaymentAccount`, subtitle = the chosen account's name
    (looked up in `accounts`, so an archived one still reads) or `accounts.noPaymentAccount`, chevron, opens sheet
    `'payment'`.
  - `PaymentAccountSheet` is `AccountFilterSheet`'s shape: a "Nessuno" row (`wallet` icon box, muted) then one row per
    candidate (icon box in its colour), a check on the selected one, `selected` for VoiceOver, closes on pick.
  - `new.tsx`: pass `accounts`, write `creditPaymentAccountId: values.type === 'credit_card' ? values.creditPaymentAccountId : null`.
  - `edit/[id].tsx`: pass `accounts` and `accountId={account.id}`, write the same field in `update`.
- [x] **Step 4:** run → PASS. Commit `feat(mobile): pick the account a credit card is charged to`.

### Task 5: pre-filled transfer ("Salda carta" params)

**Files:** create `apps/mobile/src/features/accounts/settlement.ts` + `settlement.test.ts`; modify
`app/transaction/new.tsx`, `src/features/transactions/TransactionForm.tsx`

- [ ] **Step 1: failing tests** (`settlement.test.ts`, node project):

```ts
import { settlementForm, settlementParams } from './settlement';

const draft = {
  fromAccountId: 'acc-checking', toAccountId: 'acc-card', statementAmount: 30000,
  balanceAmount: 35000, amount: 30000, date: '2026-05-05', statementDate: '2026-04-20',
};

describe('settlement params', () => {
  it('round-trips a draft through route params into a transfer form', () => {
    const params = settlementParams(draft, 'Saldo Visa · aprile 2026');
    const form = settlementForm(params, '2026-04-25', 2);
    expect(form?.values).toMatchObject({
      kind: 'transfer', buffer: '300.00', date: '2026-05-05', accountId: 'acc-checking',
      toAccountId: 'acc-card', description: 'Saldo Visa · aprile 2026', categoryId: null,
    });
    expect(form?.shortcuts).toEqual([
      { key: 'statement', minor: 30000 },
      { key: 'balance', minor: 35000 },
    ]);
  });

  it('offers no shortcuts when statement and balance agree, or there is no statement', () => {
    expect(settlementForm(settlementParams({ ...draft, balanceAmount: 30000 }, ''), '2026-04-25', 2)?.shortcuts).toEqual([]);
    expect(settlementForm(settlementParams({ ...draft, statementAmount: null }, ''), '2026-04-25', 2)?.shortcuts).toEqual([]);
    expect(settlementForm(settlementParams({ ...draft, statementAmount: 0 }, ''), '2026-04-25', 2)?.shortcuts).toEqual([]);
  });

  it('leaves the source empty and the amount blank when there is nothing to take', () => {
    const form = settlementForm(settlementParams({ ...draft, fromAccountId: null, amount: 0 }, ''), '2026-04-25', 2);
    expect(form?.values).toMatchObject({ accountId: null, buffer: '' });
  });

  it('ignores a plain new transaction and a malformed link', () => {
    expect(settlementForm({}, '2026-04-25', 2)).toBeNull();
    expect(settlementForm({ settleTo: 'acc-card', date: 'nope', amount: 'x' }, '2026-04-25', 2)?.values).toMatchObject({
      date: '2026-04-25', buffer: '',
    });
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement** `settlement.ts`:

```ts
import {
  type CreditSettlementDraft, isLocalDate, type LocalDate, type MinorDigits, minorToAmountBuffer,
} from '@saldo/core';
import { emptyForm, type TransactionFormValues } from '../transactions/useTransactionForm';

/** Route params of `/transaction/new` for "Salda carta": strings only, as expo-router wants. */
export type SettlementParams = Record<string, string>;

export interface AmountShortcut { key: 'statement' | 'balance'; minor: number }

export function settlementParams(draft: CreditSettlementDraft, description: string): SettlementParams {
  return {
    settleTo: draft.toAccountId,
    from: draft.fromAccountId ?? '',
    amount: String(draft.amount),
    date: draft.date,
    description,
    statement: draft.statementAmount === null ? '' : String(draft.statementAmount),
    balance: String(draft.balanceAmount),
  };
}

function minor(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

/** The transfer form "Salda carta" opens on, or null for a plain new transaction. */
export function settlementForm(
  params: Partial<Record<string, string | string[]>>,
  today: LocalDate,
  minorDigits: MinorDigits,
): { values: TransactionFormValues; shortcuts: AmountShortcut[] } | null {
  const read = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === 'string' ? value : undefined;
  };
  const to = read('settleTo');
  if (to === undefined || to.length === 0) return null;
  const from = read('from');
  const date = read('date');
  const amount = minor(read('amount'));
  const statement = minor(read('statement'));
  const balance = minor(read('balance'));
  return {
    values: {
      ...emptyForm(date !== undefined && isLocalDate(date) ? date : today, from !== undefined && from.length > 0 ? from : null),
      kind: 'transfer',
      toAccountId: to,
      buffer: amount > 0 ? minorToAmountBuffer(amount, minorDigits) : '',
      description: read('description') ?? '',
    },
    shortcuts:
      statement > 0 && balance > 0 && statement !== balance
        ? [{ key: 'statement', minor: statement }, { key: 'balance', minor: balance }]
        : [],
  };
}
```

  - `new.tsx`: `const params = useLocalSearchParams();` then
    `const [settlement] = useState(() => settlementForm(params, today, minorDigits));` and seed
    `values` from `settlement?.values ?? emptyForm(...)`; pass `amountShortcuts={settlement?.shortcuts.map(s => ({ ...s, label: t(\`accounts.settle${s.key === 'statement' ? 'Statement' : 'Balance'}\`) }))}`.
  - `TransactionForm`: optional prop `amountShortcuts?: readonly { key: string; label: string; minor: number }[]`,
    rendered as a row of `Chip`s under the `AmountInput` (gap 6, marginTop 10) when non-empty; a chip is `active` when
    `amountBufferToMinor(values.buffer, minorDigits) === shortcut.minor` and sets `buffer` to
    `minorToAmountBuffer(minor, minorDigits)`; its `accessibilityLabel` is `"{label}, {amount}"` via `spoken`.
  - `TransactionForm`: `const overpays = transferOverpaysCard(accounts.find(a => a.id === values.toAccountId), transferPreview.to);`
    and in the footer, when `overpays`, a muted footnote `t('txForm.cardInCredit', { amount: spoken(transferPreview.to?.after ?? 0) })`
    after the missing line. Save stays enabled.
- [ ] **Step 4:** run settlement + TransactionForm tests → PASS. Commit `feat(mobile): open the transfer sheet pre-filled to settle a card`.

### Task 6: card box on the account detail

**Files:** `apps/mobile/app/account/[id].tsx`

- [ ] **Step 1:** load rows up to the far end of the settlement window as well:
  `useTransactionsInRangeQuery('1970-01-01', addDays(today, 62))` feeds a `future` list; the existing
  `rows` becomes `future.filter(tx => tx.date <= today)` so the balance, sparkline and recent list are unchanged.
- [ ] **Step 2:** compute `statement = creditStatementDue(account, future, today)` and
  `draft = creditSettlementDraft(account, accounts, future, today)` for credit cards.
- [ ] **Step 3:** render the box for a credit card when any of these exist: accrued row (close day), the
  charge/settlement row (charge day), the note (both days + payment account), the button (not archived and
  `draft.balanceAmount > 0`).
  - charge row: `statement?.due > 0 && statement.chargeDate !== null` → `ListRow` title
    `t('accounts.dueOn', { date: formatDayMonth(chargeDate, locale) })`, trailing `AmountText` of `due`;
    else the existing "Prossimo addebito" row; plus, when `statement.statement > 0 && statement.due === 0`, a caption
    `accounts.statementPaid` in `textFaint`.
  - note: caption `textFaint` `t('accounts.creditNote', { close, charge, account: paymentName })`.
  - button: `SecondaryButton label={t('accounts.settleCard')}` (marginTop 8) →
    `router.push({ pathname: '/transaction/new', params: settlementParams(draft, t('accounts.settleDescription', { card: account.name, month: formatMonthYear(ym(draft.statementDate), locale) })) })`.
- [ ] **Step 4:** typecheck; commit `feat(mobile): statement due and Salda carta on the card box`.

### Task 7: charge-day reminder

**Files:** create `apps/mobile/src/features/accounts/cardReminders.ts` + `cardReminders.test.ts`,
`CardRemindersGate.tsx`, `apps/mobile/src/navigation/useNotificationRoutes.ts`; modify `app/(tabs)/_layout.tsx`

- [ ] **Step 1: failing tests** (`cardReminders.test.ts`, node project):

```ts
import { isReminderId, reminderAccountId, reminderId, reminderTrigger } from './cardReminders';

describe('card reminders', () => {
  it('names one request per card', () => {
    expect(reminderId('acc-1')).toBe('card-charge:acc-1');
    expect(isReminderId('card-charge:acc-1')).toBe(true);
    expect(isReminderId('budget')).toBe(false);
  });

  it('fires at 09:00 local on the charge day, and not once that time has passed', () => {
    const at = reminderTrigger('2026-05-05', 9, new Date(2026, 4, 1, 12));
    expect(at).toEqual(new Date(2026, 4, 5, 9, 0, 0, 0));
    expect(reminderTrigger('2026-05-05', 9, new Date(2026, 4, 5, 8, 59))).toEqual(new Date(2026, 4, 5, 9));
    expect(reminderTrigger('2026-05-05', 9, new Date(2026, 4, 5, 9, 0))).toBeNull();
  });

  it('reads the card back from a tapped notification, and nothing else', () => {
    expect(reminderAccountId({ kind: 'cardCharge', accountId: 'acc-1' })).toBe('acc-1');
    expect(reminderAccountId({ kind: 'other', accountId: 'acc-1' })).toBeNull();
    expect(reminderAccountId({ kind: 'cardCharge', accountId: 3 })).toBeNull();
    expect(reminderAccountId(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement** `cardReminders.ts`:

```ts
import { type LocalDate, parseLocalDate } from '@saldo/core';

const PREFIX = 'card-charge:';

export const reminderId = (accountId: string): string => `${PREFIX}${accountId}`;
export const isReminderId = (identifier: string): boolean => identifier.startsWith(PREFIX);

/** `hour`:00 local on `date`, or null once that moment has passed: the OS would drop it anyway. */
export function reminderTrigger(date: LocalDate, hour: number, now: Date): Date | null {
  const { year, month, day } = parseLocalDate(date);
  const at = new Date(year, month - 1, day, hour, 0, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}

export function reminderPayload(accountId: string): Record<string, string> {
  return { kind: 'cardCharge', accountId };
}

export function reminderAccountId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  return record.kind === 'cardCharge' && typeof record.accountId === 'string' ? record.accountId : null;
}
```

  `CardRemindersGate.tsx` (renders nothing): loads `useAccountsQuery`, `useTransactionsInRangeQuery('1970-01-01',
  addDays(today, 62))`, settings, `useHiddenMoney`, `useAppLocale`; waits for both `loaded`; builds
  `creditChargeReminders(accounts, rows, today)` → `{ id, at: reminderTrigger(date, CREDIT_REMINDER_HOUR, new Date()), title, accountId }`
  dropping null triggers; a signature `JSON.stringify(planned.map(p => [p.id, p.at.getTime(), p.title]))` kept in a
  ref short-circuits unchanged runs. The async body: `getAllScheduledNotificationsAsync()` → cancel every
  `isReminderId`; if nothing planned, store the signature and stop; else the `BudgetAlertsGate` permission read/request;
  then `scheduleNotificationAsync({ identifier, content: { title, data: reminderPayload(accountId) }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at } })`;
  store the signature only when every call succeeded and the effect was not cancelled; errors are logged with `log`.

  `useNotificationRoutes.ts`: in an effect keyed on `router`, `open(response)` reads
  `reminderAccountId(response.notification.request.content.data)` and, one `setTimeout(0)` later and only if still
  mounted, `Notifications.clearLastNotificationResponse()` + `router.push({ pathname: '/account/[id]', params: { id } })`.
  Called with `Notifications.getLastNotificationResponse()` on mount and from
  `addNotificationResponseReceivedListener`.

  `(tabs)/_layout.tsx`: `useNotificationRoutes();` and render `<CardRemindersGate />` next to `<Tabs>` in a fragment.
- [ ] **Step 4:** run → PASS; typecheck. Commit `feat(mobile): remind on a credit card's charge day`.

### Task 8: docs and gates

- [ ] **Step 1:** spec §5.3 credit-card bullet (statement due rule, settlement, reminder), §6.10 (card box),
  §6.16 (pre-fill + chips + overpay warning), §6.22 (Addebitata su). Plans `README.md` gets a "Picked up from
  `TODO.md` on 2026-09-22" entry. Remove the item from `TODO.md`.
- [ ] **Step 2:** `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm test`; read the output (no
  `lint/…` lines, no `×`).
- [ ] **Step 3:** commit `docs: card settlement in the spec; leaves TODO`.

## Status

Not started.
