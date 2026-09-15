# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list.

## Delete all data from Settings

- [ ] An option in Settings that deletes all of the user's data.

Today the only way is the **developer-only** "reset device" row in `apps/mobile/app/profile.tsx`. It
signs out, deletes the attachment files and runs `wipeDevice` (`apps/mobile/src/db/wipe.ts`). That
empties the phone, not the server: sign in again and the first sync brings everything back.

To decide:

- Whether "everything" includes the server copy. If it does, it needs a server route, and the other
  devices signed in to the account have to find out; a local wipe on its own is undone by the next
  pull.
- Whether the user stays signed in and lands back on onboarding, or is signed out.
- A confirmation that matches something irreversible.

## Negative account balances

- [ ] Let an account's balance be entered below zero, in the account sheet (§6.22) and in onboarding
      step 3.

A balance can already be negative — a credit card's is by design (§5.3) — but neither form offers a
way to type a minus sign. Entry points: `apps/mobile/src/features/accounts/AccountForm.tsx`,
`apps/mobile/app/(onboarding)/balance.tsx`, and the keypad buffer conversion
`amountBufferToMinor` in `packages/core/src/money.ts`.

## Settle an account (analysis first)

- [ ] Analyse how to bring an account's balance in line with the real one.

Use case: the history comes from a Spendee export, but the bank says the account holds a different
amount. The import creates unknown accounts with `openingBalance 0` (§11.3), so afterwards the
balance is only the sum of the imported rows.

Editing the balance in the account sheet already stores `openingBalance = entered − Σ(transaction
effects)` (§6.22), which shifts every past balance by the difference. Compare it with an adjustment
transaction dated today, visible in the list, before building anything:

- which one keeps statistics and budgets honest — an adjustment must not count as spending or income;
- how it syncs, and what happens when two devices settle the same account;
- whether it should be offered straight after an import.

## Offer an import during onboarding

- [ ] Ask during onboarding whether the user wants to import an existing export.

Onboarding (§6.29) is four steps — period, account details, balance, categories — and the import
wizard is reachable only from Profile (`apps/mobile/app/profile/import.tsx`, §11.3).

To decide:

- Where the question goes: before the account steps, so the import can create the accounts itself,
  or after "Inizia".
- How it meets the settle item above: an imported account starts from 0, so the balance asked in
  step 3 and the imported history have to agree.
- A Saldo JSON backup (§11.1) is a restore, not an import, and may deserve its own path.

## Debit card as an account type

- [ ] Add `debit_card` next to `cash`, `checking`, `credit_card`, `savings` and `investment`.

The list lives in `accountTypeSchema` (`packages/core/src/entities.ts`) and is repeated by hand in
several places that have to follow: `AccountTypeSheet.tsx` (`ACCOUNT_TYPES`), the onboarding
`TYPES` in `(onboarding)/account-details.tsx` and the draft type in `features/onboarding/state.tsx`,
the column type in `apps/mobile/src/db/schema.ts`, `db/seed.ts`, the `accountTypes` labels in both
locales, and the account table in the spec (§4, with its `includeInSpendable` defaults).

**It is a sync schema change, not just a new label.** The server validates pushed rows with
`entitySchemas` (`packages/core/src/sync/protocol.ts`), the phone validates pulled rows the same way
(`apps/mobile/src/sync/localStore.ts`), and a JSON backup is parsed with `accountSchema`
(`packages/core/src/io/backup.ts`). An older app or server would reject an account of the new
type. **`SYNC_SCHEMA_VERSION` stays at 1 anyway** until Saldo is officially public: there are no
active users, so no older peer exists to protect. Rebuild the app and redeploy the server together.

To decide:

- What a debit card means here. It spends the money of a current account, so it could be its own
  account with its own balance — which splits one bank balance in two — or a way to pay that is
  attached to an existing account.
- Its `includeInSpendable` default (true, like `checking`, if it is an account), its icon, and
  whether it belongs in the four segments of onboarding step 2, which already do not fit (see the
  item above).

## No swipe-back on the tab screens

- [ ] On the tab screens (Home, Transactions, Stats, Accounts), the iOS edge swipe must not go back.

The tabs are the bottom of the app: there is nothing behind them a user should be able to return to.
Yet the root `Stack` in `apps/mobile/app/_layout.tsx` does not declare `(tabs)` at all, so it gets the
default native-stack options, swipe-back included.

Likely cause, not yet confirmed on a device: the ways into the tabs replace a route *inside another
navigator* — `router.replace('/(tabs)')` from the last onboarding step
(`app/(onboarding)/categories.tsx`) and from `app/lock.tsx`, and the boot router's `<Redirect>` in
`app/index.tsx` — which can leave the onboarding stack, the lock screen or `index` underneath the
tabs in the root stack. A swipe then brings back a screen that should be gone.

Two parts to the fix, and it probably needs both:

- `<Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />` in the root layout, so the
  gesture is off whatever sits underneath.
- Leaving onboarding and the lock screen without keeping them in the history (for example dismissing
  the stack before replacing), so a hardware back on Android does not reach them either — the swipe
  option only covers iOS.

Check first which screen the swipe actually reveals, from a fresh install through onboarding and from
a cold start behind the lock.

## Pull to refresh

- [ ] Pulling down on a screen starts a sync and shows the spinner until it comes back.

No screen has a `RefreshControl` today. A sync runs on start and whenever the app becomes active
(`apps/mobile/src/sync/SyncProvider.tsx`), and nothing lets you ask for one by hand.

What should make it small:

- `useSync()` already hands screens the scheduler, whose `syncNow()` is the call to make, and the
  sync status, which is what the spinner should follow.
- The screens read SQLite through `useLiveQuery`, which updates by itself when rows change, so the
  pull only has to sync. Nothing needs refetching once it is done.
- Most screens scroll inside `Screen` (`apps/mobile/src/components/Screen.tsx`), so the refresh
  control belongs there, once. The Transactions tab has its own list (`scroll={false}`) and needs
  it separately.

To decide: what the pull does with no server reachable or when offline — Saldo keeps working locally,
so it should say it could not sync rather than fail silently.
