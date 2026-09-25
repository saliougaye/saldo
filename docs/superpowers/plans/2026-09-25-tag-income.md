# Tag detail and Statistiche tag card: income beside spend

**Goal.** The tag view and the Statistiche tag card show what a tag spent **and** what it brought in, as two
figures that are never netted (ROADMAP «Tag detail: the total ignores income», spec §5.10, §5.7).

**Decision (2026-09-25).** Two figures. The hero becomes «Totale uscite» / «Totale entrate» side by side; the card
keeps ranking by spend and signs any income under it. Both count what the category split counts
(`countsInTotals`), so the hero now leaves out rows flagged `excludeFromTotals`, as the split already did.

## Steps

- [x] **Core, test first.** Replace `spendingByTag(txs, range, today, kind)` with
      `tagTotals(txs, range, today)` in `packages/core/src/ledger.ts`: per tag `{ tagId, expense, income, count }`,
      ranked by expense, then income, then id; `untagged`/`untaggedCount` stay expense-only; transfers and
      uncounted rows skipped. Tests in `ledger.test.ts`: ranking with income, income-only tag, no netting,
      transfers excluded, overshoot, untagged, ties, empty.
- [x] **i18n.** `tags.totalIncome`, `tags.totals` (`{{expense}}`/`{{income}}`), `stats.tagsFlows`, in every locale.
- [x] **Card, test first.** `TagSpendCard.test.tsx`: income shows signed under the spend and the header reads
      «Uscite · entrate»; an income-only tag is listed with just its income; no income keeps «Uscite».
      `TagSpendCard.tsx` renders it with `tagTotals`.
- [x] **Tag view.** `apps/mobile/app/tag/[id].tsx` reads `tagTotals` for its tag; two `amountLg` figures in a row
      (the hero size does not fit two); the bottom caption uses `tags.totals`.
- [x] `apps/mobile/scripts/measure-performance.ts` times `tagTotals`.
- [x] Spec §5.10 and §5.7.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` clean.
