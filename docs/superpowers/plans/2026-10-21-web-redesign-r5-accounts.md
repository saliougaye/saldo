# Web redesign R5 — Accounts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Accounts as four blocks: net worth, one row for each account in «To spend» and in «Savings and investments», a separate Goals block, and the archived row (W9).

**Architecture:**
- `apps/web/app/(app)/accounts/page.tsx` stays a server component. The figures still come from `accountsView` and `accountDetail`.
- The cards go:
  - An account becomes a row: the icon in the account colour, the name, a line, a small sparkline and the balance.
  - A goal leaves its account and goes into the Goals block. Its row has the same shape as the goal rows of the Home (H9). The rows come from `goalViews`, as on the Home.
- The dialogs keep their content. The account dialog gets its «Edit» and «Archive account» at the bottom.

**Tech Stack:** Next.js (App Router, server components), CSS Modules with the `@saldo/ui` token variables, `@saldo/core`, `@saldo/i18n`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-web-pages-redesign.html`, W9 and W12, section 05 «Accounts», figure 6.

**Mockup (not in the repository):** `docs/design/redesign/accounts.html`, variant «split» (Goals apart).

**Branch:** `redesign/web`. R1–R4 are done on it.

---

## Decisions this plan takes where the spec leaves a choice

- **«Settle card» is not in R5.** The web has no flow to pay off a card: the catalogs hold `accounts.settleCard`, but only the phone uses it. A card in debt shows «To repay» in its row and in its dialog, as before. A later plan can add the flow.
- **The net worth line has no new key for «change».** The change over the line (last month-end less the first) shows as a signed amount next to the existing title `accounts.netWorthTrend`.
- **The ghost card «New account» goes.** The «New account» button stays beside the title. Before this plan, «Savings and investments» always showed, because it held that ghost card. Now it shows only when it has an account.
- **A goal row reads «€1,200.00 of €3,000.00 · in Current account».** This needs one new key, `goals.savedOfIn`.
- **The empty states stay as they are.** R7 rebuilds them.

## File structure

| File | Change |
|---|---|
| `packages/i18n/src/locales/{en,it,de,es,fr,pt,sv}.ts` | 1 new key in `goals`. |
| `apps/web/app/(app)/accounts/page.tsx` | The list part replaced; the account dialog's actions move to its bottom. |
| `apps/web/app/(app)/accounts/accounts.module.css` | Replaced. |
| `apps/web/e2e/accounts-goals.spec.ts` | Goals are in their own block. |
| `docs/superpowers/plans/README.md` | R5 ticked. |

---

### Task 1: The string

**Files:**
- Modify: `packages/i18n/src/locales/en.ts`, `it.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts` (the `goals` block, after the line `    free: …`; that line is unique in each file)

- [x] **Step 1: Add the key**

After the line that starts with `    free:` in each file, add the line for that locale:

| File | Line |
|---|---|
| `en.ts` | `    savedOfIn: '{{saved}} of {{target}} · in {{account}}',` |
| `it.ts` | `    savedOfIn: '{{saved}} di {{target}} · in {{account}}',` |
| `de.ts` | `    savedOfIn: '{{saved}} von {{target}} · in {{account}}',` |
| `es.ts` | `    savedOfIn: '{{saved}} de {{target}} · en {{account}}',` |
| `fr.ts` | `    savedOfIn: '{{saved}} sur {{target}} · dans {{account}}',` |
| `pt.ts` | `    savedOfIn: '{{saved}} de {{target}} · em {{account}}',` |
| `sv.ts` | `    savedOfIn: '{{saved}} av {{target}} · på {{account}}',` |

- [x] **Step 2: Run the catalog tests**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): the line of a goal row on Accounts"
```

---

### Task 2: The page (W9)

**Files:**
- Modify: `apps/web/app/(app)/accounts/page.tsx`
- Replace: `apps/web/app/(app)/accounts/accounts.module.css`

No unit test: the page only reads views that have their tests (`accountsView`, `accountDetail`, `goalViews`). Task 3 covers it with Playwright.

The e2e tests read the page through these hooks. Keep them:
- **Blocks:** the blocks are `section`s with the headings `accounts.spending`, `accounts.savings` and `goals.title`.
- **Rows:** a row is a link whose accessible name starts with the account or goal name. Account rows are `PanelLink`s with `selectId` `a:{id}`, and goal rows with `g:{id}`.
- **Free amount:** the text `goals.free` shows in the line of an account that holds goals.
- **Title:** the `h1` is `accounts.title`.

- [ ] **Step 1: Imports**

In `apps/web/app/(app)/accounts/page.tsx`:

1. **`@saldo/core` import:** add `type GoalView`, `goalCardStatus`, `goalViews` and `pocketParentCandidates`. Look at how `apps/web/src/features/home/homeView.ts` imports `goalViews`, and import it the same way.
2. **`@saldo/i18n` import:** add `goalCardStatusText`, `goalLabel` and `goalStatus`.
3. **Remove** the imports of `Card, CardGrid, CardHead, CardLabel, CardNote, CardSentence`, `ChartFrame`, `HeroFigure`, `PageHead` and `ProgressBar`.
4. **Add:**

```tsx
import { NEW_GOAL_HREF } from '../../../src/features/accounts/goalLinks';
import { paletteIndex } from '../../../src/ui/IconBox';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
```

(If `goalLinks` is already imported, add `NEW_GOAL_HREF` to that import instead.)

5. Delete the `Figure` function (the page no longer uses `HeroFigure`).
6. After the constant `GOAL_RING`, add:

```tsx
/** H9, W9: the ring of a goal row. */
const GOAL_ROW_RING = 40;

/** An account or category colour as the CSS variable the root layout injects. */
function tint(colorIndex: number | null | undefined): string | undefined {
  return colorIndex === null || colorIndex === undefined
    ? undefined
    : `var(--category-${paletteIndex(colorIndex)})`;
}
```

- [ ] **Step 2: The account row**

Replace the whole `accountCard` function with:

```tsx
  // W9: one row for each account — icon, name, the line, a small line of the balance, the balance.
  const accountRow = (row: AccountRowView) => {
    const detail = detailOf(row.account.id);
    const due = detail?.due ?? null;
    const owes = due !== null && due > 0;
    const change = detail === null ? 0 : detail.period.income - detail.period.spent;
    const line = [
      row.account.institution ?? t(`accountTypes.${row.account.type}`),
      t('accounts.periodDelta', { amount: formatMoney(change, currency, locale, 'always') }),
      row.pockets.length === 0 ? null : `${money(row.free)} ${t('goals.free')}`,
    ]
      .filter((part) => part !== null)
      .join(' · ');
    return (
      <PanelLink
        key={row.account.id}
        className={styles.acc}
        selectedClassName={styles.selected}
        selectId={`a:${row.account.id}`}
        href={`${PATH}?a=${row.account.id}`}
      >
        <span className={styles.accIcon} style={{ color: tint(row.account.colorIndex) }}>
          <Icon name={row.account.icon as IconName} size={18} />
        </span>
        <span className={styles.accText}>
          <b>{row.account.name}</b>
          <span>{line}</span>
        </span>
        <span className={styles.accSpark}>
          {detail === null || detail.series.length < 2 ? null : (
            <Sparkline series={detail.series} width={96} height={28} />
          )}
        </span>
        <span className={styles.accValue}>
          <AmountText minor={owes ? due : row.balance} currency={currency} locale={locale} />
          {owes ? <small>{t('accounts.toRepay')}</small> : null}
        </span>
      </PanelLink>
    );
  };
```

- [ ] **Step 3: The goal row**

Replace the whole `goalCard` function and the `cards` function with:

```tsx
  // W9: the goals have a block of their own — the Home's goal row (H9), with the account it is in.
  const goalItems = goalViews(page.data.accounts, page.data.transactions, today, def);
  const goalStatusLine = goalCardStatusText(
    goalItems.length,
    goalCardStatus(goalItems.map((item) => ({ id: item.account.id, progress: item.progress }))),
    t,
    locale,
  );
  const canCreateGoal = pocketParentCandidates(page.data.accounts).length > 0;
  const goalRow = (item: GoalView) => {
    const tone = goalRingTone(item.progress);
    const parentId = item.account.parentAccountId;
    const parentName = parentId == null ? MISSING : (accountNames.get(parentId) ?? MISSING);
    return (
      <PanelLink
        key={item.account.id}
        className={styles.goal}
        selectedClassName={styles.selected}
        selectId={`g:${item.account.id}`}
        href={`${PATH}?g=${item.account.id}`}
      >
        <VisuallyHidden>{goalLabel(item, goalDeps)}</VisuallyHidden>
        <TargetRing
          size={GOAL_ROW_RING}
          ratio={item.progress.ratio}
          pace={goalPace(item.progress)}
          tone={tone}
          icon={item.account.icon as IconName}
          colorIndex={item.account.colorIndex}
        />
        <span className={styles.goalText} aria-hidden="true">
          <b>{item.account.name}</b>
          <span>
            {t('goals.savedOfIn', {
              saved: money(item.progress.saved),
              target: money(item.progress.target),
              account: parentName,
            })}
          </span>
        </span>
        <span className={styles.goalValue} aria-hidden="true">
          {t('targets.percent', { value: Math.round(item.progress.ratio * 100) })}
          <small className={tone === 'over' ? styles.attention : undefined}>
            {goalStatus(item, goalDeps)}
          </small>
        </span>
      </PanelLink>
    );
  };
```

Add `const MISSING = '—';` after the constant `RECENT`. Then check that `goalLabel` and `goalStatus` accept a `GoalView`. The Home passes one, so they do.

- [ ] **Step 4: The net worth line's change**

After the `netWorthSeries` constant, add:

```tsx
  // The change over the line: the last month-end less the first.
  const netWorthChange =
    netWorthSeries.length < 2 ? 0 : (netWorthSeries.at(-1) ?? 0) - (netWorthSeries[0] ?? 0);
```

- [ ] **Step 5: The account dialog's actions go to its bottom**

In `accountBody`, cut the whole block:

```tsx
        <div className={formStyles.actions}>
          <Link className={formStyles.actionLink} href={`${PATH}?a=${selected.account.id}&edit`}>
            {t('common.edit')}
          </Link>
          {canArchiveAccount(page.data.accounts, selected.account.id) ? (
            …
          ) : (
            <span className={formStyles.muted}>{t('goals.closeFirst')}</span>
          )}
        </div>
```

Paste it after the closing `</Section>` of «Last transactions», as the last child of the fragment. Change its outer `className` to `` `${formStyles.actions} ${styles.dialogFoot}` ``. The spec puts «Archive account» before «Edit». So in the pasted block, move the `canArchiveAccount(…) ? (…) : (…)` expression above the «Edit» link.

In `goalBody`, change the `className` of the last `<div className={formStyles.actions}>` (the one with «Edit» and `CloseGoal`) to `` `${formStyles.actions} ${styles.dialogFoot}` ``. Then put `CloseGoal` before the «Edit» link, as the spec orders the footer: «Close goal», then «Edit».

- [ ] **Step 6: The list**

Replace everything inside `<div className={styles.list}> … </div>` (from `<PageHead` to the end of the archived `ListRow` ternary) with:

```tsx
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{t('accounts.title')}</h1>
                <PanelLink className={styles.newAccount} href={`${PATH}?new`}>
                  <Icon name="plus" size={16} />
                  {t('accounts.newAccount')}
                </PanelLink>
              </div>

              {/* Net worth: the big figure, the spendable total under it, the line on the right. */}
              <section className={`${styles.box} ${styles.worth}`} aria-label={t('accounts.netWorth')}>
                <div className={styles.worthFigures}>
                  <div className={styles.figure}>
                    <span className={styles.label}>{t('accounts.netWorth')}</span>
                    <AmountText minor={view.netWorth} currency={currency} locale={locale} size="hero" />
                  </div>
                  <div className={styles.figure}>
                    <span className={styles.label}>{t('accounts.spendable')}</span>
                    <AmountText
                      minor={view.spendable}
                      currency={currency}
                      locale={locale}
                      size="headline"
                    />
                    <span className={styles.note}>{t('accounts.spendableNote')}</span>
                  </div>
                </div>
                {netWorthSeries.length < 2 ? null : (
                  <div className={styles.worthTrend}>
                    <div className={styles.worthTrendHead}>
                      <span className={styles.label}>
                        {plural(t, locale, 'accounts.netWorthTrend', netWorthSeries.length)}
                      </span>
                      <AmountText
                        minor={netWorthChange}
                        currency={currency}
                        locale={locale}
                        size="footnote"
                        sign="always"
                      />
                    </div>
                    <Sparkline series={netWorthSeries} height={72} />
                  </div>
                )}
              </section>

              {empty ? (
                <EmptyState title={t('accounts.empty')} />
              ) : (
                <>
                  <section className={styles.box}>
                    <div className={styles.boxHead}>
                      <h2 className={styles.boxTitle}>{t('accounts.spending')}</h2>
                      <span className={styles.meta}>
                        {plural(t, locale, 'accounts.count', view.spending.length)}
                      </span>
                    </div>
                    <div className={styles.rows}>{view.spending.map(accountRow)}</div>
                  </section>

                  {view.savings.length === 0 ? null : (
                    <section className={styles.box}>
                      <div className={styles.boxHead}>
                        <h2 className={styles.boxTitle}>{t('accounts.savings')}</h2>
                        <span className={styles.meta}>{t('accounts.outsideSpendable')}</span>
                      </div>
                      <div className={styles.rows}>{view.savings.map(accountRow)}</div>
                    </section>
                  )}

                  {/* W9: the goals, in a block of their own. */}
                  <section className={styles.box}>
                    <div className={styles.boxHead}>
                      <h2 className={styles.boxTitle}>{t('goals.title')}</h2>
                      {goalItems.length === 0 ? null : (
                        <span className={styles.meta}>{goalStatusLine}</span>
                      )}
                    </div>
                    {goalItems.length === 0 ? (
                      <div className={styles.empty}>
                        <EmptyState title={t('goals.empty')} body={t('goals.emptyBody')} />
                        {canCreateGoal ? (
                          <Link className={styles.action} href={NEW_GOAL_HREF}>
                            {t('goals.create')}
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <div className={styles.goals}>{goalItems.map(goalRow)}</div>
                    )}
                  </section>
                </>
              )}

              {archivedTotal === 0 ? null : (
                <ListRow
                  open
                  href={`${PATH}?archived`}
                  selectId="archived"
                  title={t('profile.archivedAccounts')}
                  trailing={<span className={styles.count}>{archivedTotal}</span>}
                />
              )}
```

Before this plan, the page showed `profile.archivedAccounts` as a note when nothing was archived. A row with nothing behind it says nothing, so the note goes.

- [ ] **Step 7: Replace the page CSS**

Read the old `accounts.module.css` first. Then replace the whole file with the CSS below. It keeps every class that the dialogs use (`label`, `note`, `count`, `cardRows`, `paid`, `periodRow`, `goalHead`, `sentence`).

```css
/* W1: the dialog is over the page; the list is the page. */
.layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.titleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.title {
  font-size: var(--font-size-title);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-tighter);
}

.newAccount {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--layout-nav-item-height);
  padding: 0 14px;
  border-radius: var(--radius-input);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: scale var(--motion-press) var(--motion-easing);
}

.newAccount:active {
  scale: 0.97;
}

/* H3: a plain block in the column. */
.box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-bg);
}

.boxHead {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 4px;
}

.boxTitle {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
}

.meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

/* Net worth: the figures on the left, the line on the right. */
.worth {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 320px);
  align-items: end;
  gap: 24px 40px;
}

.worthFigures {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.figure {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.worthTrend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.worthTrendHead {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

/* W9: an account row. */
.rows {
  display: flex;
  flex-direction: column;
}

.acc {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 96px auto;
  align-items: center;
  gap: 14px;
  min-height: 56px;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

.acc:focus-visible,
.goal:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-text);
}

@media (hover: hover) and (pointer: fine) {
  .acc:hover,
  .goal:hover {
    background: var(--color-raised);
  }
}

.selected {
  background: var(--color-raised);
}

.accIcon {
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
}

.accText {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.accText b {
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accText span {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.accSpark {
  display: flex;
  align-items: center;
}

.accValue {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.accValue small {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-regular);
}

/* W9: the Goals block, two columns on a wide screen. */
.goals {
  display: grid;
  gap: 8px 40px;
}

@media (min-width: 760px) {
  .goals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.goal {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  padding: 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

.goalText {
  min-width: 0;
}

.goalText b {
  display: block;
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goalText span {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goalValue {
  text-align: end;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.goalValue small {
  display: block;
  font-weight: var(--font-weight-regular);
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.goalValue small.attention {
  color: var(--color-accent);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.action {
  display: inline-flex;
  align-items: center;
  height: var(--layout-nav-item-height);
  padding: 0 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-input);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* ---- The dialogs ----------------------------------------------------------------------------- */
.note {
  max-width: 320px;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  line-height: 1.45;
  text-wrap: pretty;
}

.label {
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.count {
  font-size: var(--font-size-body);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.cardRows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.paid {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.periodRow {
  display: flex;
  gap: 24px;
}

.periodRow > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.goalHead {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sentence {
  font-size: var(--font-size-body);
  text-wrap: pretty;
}

/* The footer of a dialog: «Archive account» and «Edit», «Close goal» and «Edit». */
.dialogFoot {
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (max-width: 759px) {
  .box {
    padding: 18px;
  }

  .worth {
    grid-template-columns: minmax(0, 1fr);
  }

  .acc {
    grid-template-columns: 20px minmax(0, 1fr) auto;
  }

  .accSpark {
    display: none;
  }
}
```

If the old file had a rule that the new `page.tsx` still uses and that the CSS above lacks, add it back. Then run: `rtk grep -on "styles\.[a-zA-Z]*" "apps/web/app/(app)/accounts/page.tsx"` and check every name against the new CSS.

- [ ] **Step 8: Lint, typecheck and test**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines. Delete an import or a variable that Biome reports as unused (for example `GoalProgress` stays: `goalRingTone` uses it).

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS.

- [ ] **Step 9: Look at the page**

Run: `rtk proxy pnpm --filter web dev`. Sign in with a seeded user and open `/accounts` at 1440px and at 390px, in the light and the dark theme. Use a temporary Playwright screenshot script if you have no browser, and delete it before you commit.

Expected:
- **Net worth:** the figure is large, the spendable total is under it, and the line with its change is on the right (under the figures at 390px).
- **Account rows:** «To spend» and «Savings and investments» show one row for each account. Each row has the icon in the account colour, the name, the line, a small sparkline (not at 390px) and the balance. The account that holds goals says «… free». A card in debt shows «To repay».
- **Goals:** a block of its own, two columns at 1440px and one at 390px. Each row has a 40px ring, the name, «… of … · in …», the percent and the state.
- **Dialogs:** a click on an account opens its dialog, with «Archive account» and «Edit» at the bottom. A click on a goal opens its dialog, with «Close goal» and «Edit» at the bottom.
- **Overflow:** nothing overflows at 390px.

- [ ] **Step 10: Commit**

```bash
rtk git add "apps/web/app/(app)/accounts"
rtk git commit -m "feat(web): Accounts as rows, with Goals in a block of their own (W9)"
```

---

### Task 3: e2e

**Files:**
- Modify: `apps/web/e2e/accounts-goals.spec.ts`

- [ ] **Step 1: The goals are in their own block**

In the first test, replace:

```ts
  // The two goals are pockets of «Risparmi»: a ring row each, then what is left free in the account.
  const giappone = savings.getByRole('link', { name: /^Viaggio in Giappone/ });
  const emergenza = savings.getByRole('link', { name: /^Fondo emergenza/ });
  await expect(giappone).toContainText(money(90000));
  await expect(emergenza).toContainText(money(180000));
  await expect(savings.getByText(t('goals.free'))).toBeVisible();
  await expect(spending.getByText('Viaggio in Giappone')).toHaveCount(0);
```

with:

```ts
  // W9: the two goals are pockets of «Risparmi», in the Goals block; «Risparmi» says what is free.
  const goals = page.locator('section').filter({
    has: page.getByRole('heading', { name: t('goals.title') }),
  });
  const giappone = goals.getByRole('link', { name: /^Viaggio in Giappone/ });
  const emergenza = goals.getByRole('link', { name: /^Fondo emergenza/ });
  await expect(giappone).toContainText(money(90000));
  await expect(giappone).toContainText('Risparmi');
  await expect(emergenza).toContainText(money(180000));
  await expect(savings.getByRole('link', { name: /^Risparmi/ })).toContainText(t('goals.free'));
  await expect(savings.getByText('Viaggio in Giappone')).toHaveCount(0);
  await expect(spending.getByText('Viaggio in Giappone')).toHaveCount(0);
```

Change the test title from `'accounts sit in their group, a goal sits under its account, and an account is archived and restored'` to `'accounts sit in their group, goals in their own block, and an account is archived and restored'`.

- [ ] **Step 2: Run the suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes. A test that clicked a goal inside the savings section must now find it in the Goals block. A test that read the note «Archived accounts» with nothing archived must follow the new page. Fix those tests and say why in the commit.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

- [ ] **Step 3: Commit**

```bash
rtk git add apps/web/e2e
rtk git commit -m "test(web): goals in their own block on Accounts (W9)"
```

---

### Task 4: Roadmap and gates

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Tick R5**

In `docs/superpowers/plans/README.md`, replace:

```markdown
- [ ] **R5** — Accounts (W9).
```

with:

```markdown
- [x] **R5** — Accounts (W9) (`plans/2026-10-21-web-redesign-r5-accounts.md`).
```

After the paragraph `**Acceptance for R4:** …`, add:

```markdown
**Acceptance for R5:** Accounts shows the net worth block, one row for each account in «To spend» and
in «Savings and investments» (no cards), a Goals block of its own with 40px rings, and the archived
row; the account dialog has «Archive account» and «Edit» at its bottom.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck --continue`
Expected: every package passes. On a machine with Node older than 22.22, `site` fails on the engine check only; that is not a failure of this plan.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R5 done"
```
