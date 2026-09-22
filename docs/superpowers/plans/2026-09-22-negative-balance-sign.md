# Account detail: a negative balance and its "−" (2026-09-22)

From `TODO.md` → Bugs. Diagnosed from code and tests, not on a device.

## Findings

- **The hero keeps the sign for every account but a card.** `AnimatedAmount` → `AmountText` →
  `formatMoneyParts` prints `−` for `minor < 0`; the Home hero and the net worth use the very same
  component. Checked and pinned:
  - `AmountText` already has a test for `−1.284,50 €`; `AnimatedAmount` now has two: at rest, and
    after counting from `50,00 €` down across zero to `−120,00 €` (`useCountUp` lands exactly on the
    target; `countUpValue` is linear arithmetic, zero is not special).
  - Geist 400/500/600 all carry a real `minus` glyph for U+2212 (checked with fontTools), so the
    sign cannot vanish for want of a glyph.
  - The mask overlay is `absoluteFill` at opacity 0 while visible; it covers, never clips, and the
    wrapper's `overflow: 'hidden'` only matters for the roll's travel.
- **On a `credit_card` the "−" is dropped by design** (spec §5.3): the hero reads "Da rimborsare"
  with `creditCardDue(balance)`, the absolute value. The only negative account in the demo data is
  the credit card (`demoData.generated.ts`, `−412,35 €`), which the accounts list shows as
  `−412,35 €` and the detail as "Da rimborsare 412,35 €" — most likely the report. The faint caption
  at the bottom of the same screen prints the signed balance, `−412,35 €`, so the screen shows the
  same figure both ways.
- **Decision (user, 2026-09-22): option A.** The report was on the card. The hero keeps "Da
  rimborsare" with the absolute value, as §5.3 says. The bottom caption goes: it is not in the
  prototype and contradicts the hero. It used no i18n key (`money(balance, …)`), so no catalog
  entry leaves, and no test covered it.
- **The sparkline delta had its sign inverted for a balance below zero.** `deltaPercent` divided
  by the signed baseline: a card going from `−500` to `−120` read `−76%`, an overdraft deepening
  from `−100` to `−300` read `+200%`. It now divides by the baseline's size. The other callers
  (category detail, stats) pass expense totals and medians, never negative, so nothing else moves.

## Steps

- [x] Failing test: `deltaPercent` with a negative baseline (`packages/core/src/stats.test.ts`).
- [x] Fix: `Math.abs(baseline)` in `deltaPercent` (`packages/core/src/stats.ts`).
- [x] Regression tests: `AnimatedAmount` keeps the `−`, at rest and after crossing zero
      (`apps/mobile/src/components/AmountText.test.tsx`).
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` green.
- [x] Product decision on the card hero: A, keep "Da rimborsare" + absolute value.
- [x] Remove the bottom balance caption from `apps/mobile/app/account/[id].tsx`.
- [ ] Manual test on device (user).
