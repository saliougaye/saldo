# Web redesign R3 — Transactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Transactions page as the spec's three parts: a summary of three cells, one tool row, and one list block with the category colour on each row and no chips.

**Architecture:** `apps/web/app/(app)/transactions/page.tsx` stays a server component that reads `listView` and `summarizePeriod`. A new `TxRow` draws one row of the list. The three summary cards become one block of three cells. The filter chips become tool buttons. `Chip.module.css` changes, so the chips of Statistics get the new look too. The keys `↑ ↓ ↵ N /` already work (R2, `Shortcuts`, `SearchField`). This plan only shows them under the list.

**Tech Stack:** Next.js (App Router, server components), CSS Modules with the `@saldo/ui` token variables, `@saldo/core`, `@saldo/i18n`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-web-pages-redesign.html`, W5 and W12, section 03 «Transactions», figure 3.

**Mockup (not in the repository):** `docs/design/redesign/transactions.html`, variant «edit».

**Branch:** `redesign/web`. R1 and R2 are done on it.

---

## Decisions this plan takes where the spec leaves a choice

- **«Income only», «Transfers only» and «Excluded only» stay, in one menu.** The spec names only «Expenses only» in the tool row. The mockup did not model the other three filters, and removing them would remove a feature. They go into a fourth menu, «More». The menu label shows the filter that is on.
- **A closed period has two cells.** «Upcoming» counts what is after today. A closed period has nothing after today, so its summary shows Expenses and Income only.
- **The Income cell counts income transactions.** The note under Income is «12 transactions», with the counted income rows of the period: no transfer, no excluded row, nothing after today. The figure above it uses the same rule (`summarizePeriod`).
- **The dividers «After today» and «Already recorded» go.** The «Upcoming» row and the hairline under its open body do that job. The keys `transactions.upcomingSection`, `settledSection` and `showUpcoming` stay in the catalogs, because the phone uses them.
- **The tag of a row goes into its subtitle**: «Restaurants · Card · #work», as in figure 3. With a tag filter on, `listView` already puts the tags in place of the category, so the page does not add them a second time.
- **The key hint shows only with a mouse, at 760px and wider.** A touch screen has no keys.

## File structure

| File | Change |
|---|---|
| `packages/i18n/src/locales/{en,it,de,es,fr,pt,sv}.ts` | 6 new keys in `transactions`. |
| `apps/web/src/ui/Chip.module.css` | The chip becomes a tool button (W12). |
| `apps/web/app/(app)/transactions/TxRow.tsx`, `TxRow.module.css` | New: one row of the list. |
| `apps/web/app/(app)/transactions/page.tsx` | Summary, tools, filter line, list block, key hint. |
| `apps/web/app/(app)/transactions/transactions.module.css` | Replaced. |
| `apps/web/e2e/transactions.spec.ts` | The summary and the «More» menu. |
| `docs/superpowers/plans/README.md` | R3 ticked. |

---

### Task 1: The strings

**Files:**
- Modify: `packages/i18n/src/locales/en.ts`, `it.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts` (the `transactions` block, after the line `onlyExcluded: …`)

No test of its own: the catalog test and the parity test check the keys.

- [x] **Step 1: Add the keys**

In each file, after the line that starts with `    onlyExcluded:` inside `transactions: {`, add the six lines for that locale.

`en.ts`:

```ts
    moreFilters: 'More',
    summaryLabel: 'Period summary',
    keysMove: 'move',
    keysOpen: 'open',
    keysNew: 'new',
    keysSearch: 'search',
```

`it.ts`:

```ts
    moreFilters: 'Altro',
    summaryLabel: 'Riepilogo del periodo',
    keysMove: 'scorri',
    keysOpen: 'apri',
    keysNew: 'nuova',
    keysSearch: 'cerca',
```

`de.ts`:

```ts
    moreFilters: 'Mehr',
    summaryLabel: 'Übersicht des Zeitraums',
    keysMove: 'bewegen',
    keysOpen: 'öffnen',
    keysNew: 'neu',
    keysSearch: 'suchen',
```

`es.ts`:

```ts
    moreFilters: 'Más',
    summaryLabel: 'Resumen del periodo',
    keysMove: 'moverse',
    keysOpen: 'abrir',
    keysNew: 'nueva',
    keysSearch: 'buscar',
```

`fr.ts`:

```ts
    moreFilters: 'Plus',
    summaryLabel: 'Résumé de la période',
    keysMove: 'parcourir',
    keysOpen: 'ouvrir',
    keysNew: 'nouvelle',
    keysSearch: 'rechercher',
```

`pt.ts`:

```ts
    moreFilters: 'Mais',
    summaryLabel: 'Resumo do período',
    keysMove: 'mover',
    keysOpen: 'abrir',
    keysNew: 'nova',
    keysSearch: 'pesquisar',
```

`sv.ts`:

```ts
    moreFilters: 'Mer',
    summaryLabel: 'Översikt över perioden',
    keysMove: 'flytta',
    keysOpen: 'öppna',
    keysNew: 'ny',
    keysSearch: 'sök',
```

- [x] **Step 2: Run the catalog tests**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): strings for the summary, the More menu and the key hint of Transactions"
```

---

### Task 2: The chip becomes a tool button (W12)

**Files:**
- Replace: `apps/web/src/ui/Chip.module.css`

`Chip` and `FilterMenu` both use these classes. The markup does not change, so the e2e locators (`link` with `aria-current`, `button` with the label) stay valid.

- [x] **Step 1: Replace the CSS**

Replace the whole of `apps/web/src/ui/Chip.module.css` with:

```css
/*
 * W12 (2026-10-21): a filter is a tool button, not a chip — 36px, the input's radius, a hairline.
 * `Chip` (a link that toggles a filter) and `FilterMenu` (a button that opens a menu) share it.
 */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--layout-nav-item-height);
  padding: 0 10px 0 12px;
  border-radius: var(--radius-input);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition-property: scale, background-color, border-color, color;
  transition-duration: var(--motion-press);
  transition-timing-function: var(--motion-easing);
}

.chip:active {
  scale: 0.97;
}

@media (hover: hover) and (pointer: fine) {
  .chip:hover {
    border-color: var(--color-border-strong);
  }
}

/* On: the button fills, so a filter that is set reads at a glance among the ones that are not. */
.active {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-bg);
}

@media (hover: hover) and (pointer: fine) {
  .active:hover {
    border-color: var(--color-text);
  }
}

.chevron {
  flex: none;
  color: var(--color-text-muted);
  transition: rotate var(--motion-press) var(--motion-easing);
}

.active .chevron {
  color: inherit;
}

.chip[data-popup-open] .chevron {
  rotate: 180deg;
}

@media (prefers-reduced-motion: reduce) {
  .chip:active {
    scale: 1;
  }

  .chevron {
    transition: none;
  }
}
```

- [x] **Step 2: Test**

Run: `rtk proxy pnpm --filter web test`
Expected: PASS (`cssTokens.test.ts` included).

- [x] **Step 3: Commit**

```bash
rtk git add apps/web/src/ui/Chip.module.css
rtk git commit -m "feat(web): filters are tool buttons, not chips (W12)"
```

---

### Task 3: `TxRow`, one row of the list

**Files:**
- Create: `apps/web/app/(app)/transactions/TxRow.tsx`
- Create: `apps/web/app/(app)/transactions/TxRow.module.css`

No unit test: a component with no logic (AGENTS.md, «Tests»). Task 5 covers it with Playwright.

- [x] **Step 1: Write the component**

Create `apps/web/app/(app)/transactions/TxRow.tsx`:

```tsx
import type { IconName } from '@saldo/ui';
import type { ReactNode } from 'react';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { PanelLink } from '../../../src/ui/PanelNav';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import styles from './TxRow.module.css';

interface Props {
  /** The row's edit form (W3). */
  href: string;
  id: string;
  icon: IconName;
  /** The category palette's index; none leaves the icon muted. */
  colorIndex: number | null | undefined;
  title: string;
  subtitle: string;
  recurring: boolean;
  /** What the repeat icon means, for a screen reader. */
  recurringLabel: string;
  /** A row dated after today: the title in the muted ink. */
  upcoming: boolean;
  amount: ReactNode;
}

/**
 * One row of Transazioni (W5, figure 3): the category icon in the colour of its category, the
 * title, «Category · Account · #tag» under it, the amount. No chips (W12). The row is a link to
 * its edit form; `selectId` puts it in the walk of the arrows (`ListKeys`).
 */
export function TxRow({
  href,
  id,
  icon,
  colorIndex,
  title,
  subtitle,
  recurring,
  recurringLabel,
  upcoming,
  amount,
}: Props) {
  const tint =
    colorIndex === null || colorIndex === undefined
      ? undefined
      : `var(--category-${paletteIndex(colorIndex)})`;
  return (
    <PanelLink
      className={`${styles.row} ${upcoming ? styles.upcoming : ''}`}
      selectedClassName={styles.selected}
      selectId={id}
      href={href}
    >
      <span className={styles.icon} style={{ color: tint }}>
        <Icon name={icon} size={18} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>
          <b>{title}</b>
          {recurring ? (
            <>
              <Icon name="repeat" size={12} className={styles.repeat} />
              <VisuallyHidden>{recurringLabel}</VisuallyHidden>
            </>
          ) : null}
        </span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      <span className={styles.amount}>{amount}</span>
    </PanelLink>
  );
}
```

- [x] **Step 2: Write the CSS**

Create `apps/web/app/(app)/transactions/TxRow.module.css`:

```css
/* W5: one row of the list. The icon has the colour of its category; nothing else is coloured. */
.row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

@media (hover: hover) and (pointer: fine) {
  .row:hover {
    background: var(--color-raised);
  }
}

.row:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-text);
}

/* The row whose form is open. */
.selected {
  background: var(--color-raised);
}

.icon {
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.title b {
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repeat {
  flex: none;
  color: var(--color-text-faint);
}

.subtitle {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  white-space: nowrap;
}

.upcoming .title b {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}
```

- [x] **Step 3: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error. If `ListRowView['colorIndex']` has another type than `number | null | undefined`, widen the prop to that type.

Do not commit yet: Task 4 uses the component, and both go in one commit.

---

### Task 4: The page — summary, tools, list (W5)

**Files:**
- Modify: `apps/web/app/(app)/transactions/page.tsx`
- Replace: `apps/web/app/(app)/transactions/transactions.module.css`

- [x] **Step 1: Imports**

In `apps/web/app/(app)/transactions/page.tsx`:

1. Replace `import { addDays, summarizePeriod } from '@saldo/core';` with `import { addDays, countsInTotals, isWithin, summarizePeriod } from '@saldo/core';`.
2. Remove the import of `Card, CardGrid, CardLabel, CardNote` and the import of `ListRow`.
3. Add `import { TxRow } from './TxRow';` after the `TransactionsPanels` import.

- [x] **Step 2: The figures of the summary**

After the line `const summary = summarizePeriod(page.data.transactions, period.range, today);`, add:

```tsx
  // W5: the note under Income counts the rows the figure above it adds up.
  const incomeCount = page.data.transactions.filter(
    (tx) => tx.kind === 'income' && isWithin(period.range, tx.date) && countsInTotals(tx, today),
  ).length;
```

Delete the line `const upcomingRows = view.upcomingDays.flatMap((day) => day.rows);` and its comment, if nothing else uses it.

After the `filteredTotal` constant, add:

```tsx
  // «59% of income spent · day 13 of 30»: the share of income, then where the period is.
  const periodNote = period.isCurrent
    ? t('home.dayOf', { elapsed: period.elapsed, length: period.length })
    : t('home.closedCycle');
  const expenseNote =
    summary.income > 0
      ? `${t('home.spentOfIncome', {
          percent: t('targets.percent', { value: Math.round(summary.ratio * 100) }),
        })} · ${periodNote}`
      : periodNote;

  // «More»: the three filters the tool row does not show; the label names the one that is on.
  const moreLabel =
    filters.direction === 'income'
      ? t('transactions.onlyIncome')
      : filters.direction === 'transfer'
        ? t('transactions.onlyTransfers')
        : filters.onlyExcluded
          ? t('transactions.onlyExcluded')
          : t('transactions.moreFilters');
```

- [x] **Step 3: The day sections**

Replace the whole `daySection` function with:

```tsx
  // W5: one day of the list — its date and its expenses, then its rows. A `section` with an
  // `h2`, and the head first: the e2e helpers (`sectionOf`, `:scope > div`) read the day so.
  const daySection = (day: DayView, upcoming: boolean) => (
    <section className={styles.day} key={day.date}>
      <div className={styles.dayHead}>
        <h2 className={styles.dayHeading}>{dayTitle(day.date)}</h2>
        <AmountText
          minor={day.expenseTotal}
          currency={currency}
          locale={locale}
          size="footnote"
          muted
        />
      </div>
      {day.rows.map((row) => (
        <TxRow
          key={row.id}
          id={row.id}
          href={href({ [SELECTION_PARAM]: row.id })}
          icon={row.icon as IconName}
          colorIndex={row.colorIndex}
          title={row.title}
          // With a tag filter on, `listView` already puts the tags in place of the category.
          subtitle={
            filters.tagIds.length > 0
              ? row.subtitle
              : [row.subtitle, ...row.tagNames.map((name) => `#${name}`)].join(' · ')
          }
          recurring={row.recurring}
          recurringLabel={t('recurrence.recurringRow')}
          upcoming={upcoming}
          amount={
            <AmountText
              minor={row.amount.minor}
              currency={currency}
              locale={locale}
              sign={row.amount.signDisplay}
              muted={upcoming || row.amount.muted}
            />
          }
        />
      ))}
    </section>
  );
```

If `Section` is no longer used anywhere in the file, remove its import.

- [x] **Step 4: The head — summary, tools, filter line**

Inside `<TransactionsPanels …>`, replace the whole `<div className={styles.head}> … </div>` block (from `<div className={styles.head}>` to its closing `</div>`, just before `{!hasRows ? (`) with:

```tsx
        <div className={styles.head}>
          <PeriodHeader
            period={period}
            def={def}
            today={today}
            locale={locale}
            path={PATH}
            params={searchFromFilters(filters)}
            status={plural(t, locale, 'transactions.periodCount', view.totals.count)}
            strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
          />

          {/* W5: one block in three cells. The figures are the period's, whatever the filters. */}
          <section className={styles.summary} aria-label={t('transactions.summaryLabel')}>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('home.expenses')}</span>
              <AmountText minor={summary.spent} currency={currency} locale={locale} size="title" />
              <ProgressBar
                ratio={summary.ratio}
                pace={period.isCurrent ? summary.pace : null}
                tone={summary.overPace ? 'over' : 'normal'}
              />
              <span className={styles.cellNote}>{expenseNote}</span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('home.income')}</span>
              <AmountText
                minor={summary.income}
                currency={currency}
                locale={locale}
                size="title"
                positive
              />
              <span className={styles.cellNote}>
                {plural(t, locale, 'transactions.periodCount', incomeCount)}
              </span>
            </div>
            {period.isCurrent ? (
              <div className={styles.cell}>
                <span className={styles.cellLabel}>{t('home.upcoming')}</span>
                <AmountText
                  minor={view.upcoming.net}
                  currency={currency}
                  locale={locale}
                  size="title"
                  sign="always"
                />
                <span className={styles.cellNote}>
                  {plural(t, locale, 'transactions.upcomingCount', view.upcoming.count)}
                </span>
              </div>
            ) : null}
          </section>

          {/* W5: the search, the three menus, «Expenses only» and «More». */}
          <div className={styles.tools}>
            <SearchField
              // The field is uncontrolled once mounted; a query that changed in the URL must reset it.
              key={filters.query}
              path={PATH}
              keep={keepWithoutQuery}
              value={filters.query}
              label={t('common.search')}
              placeholder={t('transactions.searchPlaceholder')}
            />
            <FilterMenu
              label={accountLabel}
              active={filters.accountId !== null}
              options={choices.accounts.map((account) => ({
                key: account.id,
                label: account.archived
                  ? `${account.name} · ${t('accounts.archivedBadge')}`
                  : account.name,
                href: toggleHref(PATH, filters, { accountId: account.id }, params),
                selected: filters.accountId === account.id,
              }))}
            />
            <FilterMenu
              label={categoryLabel}
              active={filters.categoryId !== null}
              options={choices.categories.map((category) => ({
                key: category.id,
                label: category.child ? `— ${category.name}` : category.name,
                href: toggleHref(PATH, filters, { categoryId: category.id }, params),
                selected: filters.categoryId === category.id,
              }))}
            />
            {choices.tags.length === 0 ? null : (
              <FilterMenu
                label={tagLabel}
                active={filters.tagIds.length > 0}
                options={choices.tags.map((tag) => ({
                  key: tag.id,
                  label: tag.name,
                  href: toggleHref(PATH, filters, { tagId: tag.id }, params),
                  selected: filters.tagIds.includes(tag.id),
                }))}
              />
            )}
            <Chip
              label={t('transactions.onlyExpenses')}
              href={toggleHref(PATH, filters, { direction: 'expense' }, params)}
              active={filters.direction === 'expense'}
            />
            <FilterMenu
              label={moreLabel}
              active={
                filters.direction === 'income' ||
                filters.direction === 'transfer' ||
                filters.onlyExcluded
              }
              options={[
                {
                  key: 'income',
                  label: t('transactions.onlyIncome'),
                  href: toggleHref(PATH, filters, { direction: 'income' }, params),
                  selected: filters.direction === 'income',
                },
                {
                  key: 'transfer',
                  label: t('transactions.onlyTransfers'),
                  href: toggleHref(PATH, filters, { direction: 'transfer' }, params),
                  selected: filters.direction === 'transfer',
                },
                {
                  key: 'excluded',
                  label: t('transactions.onlyExcluded'),
                  href: toggleHref(PATH, filters, { excluded: !filters.onlyExcluded }, params),
                  selected: filters.onlyExcluded,
                },
              ]}
            />
          </div>

          {/* W5: with a filter on, one line: the count, what it spent, and the way back. */}
          {view.filtered && hasRows ? (
            <p className={styles.filterLine}>
              <span>{filteredTotal}</span>
              <Link className={styles.reset} href={link(periodOnly)}>
                {t('transactions.resetFilters')}
              </Link>
            </p>
          ) : null}
          {view.hiddenTransfers === 0 ? null : (
            <p className={styles.filterNote}>
              {plural(t, locale, 'transactions.transfersHidden', view.hiddenTransfers)}
            </p>
          )}
        </div>
```

- [x] **Step 5: The list block**

Replace the `: ( <> … </> )` branch of `{!hasRows ? ( … ) : ( … )}` — the part that renders the `<details>` of «In arrivo», the settled divider and `view.days.map(…)` — with:

```tsx
        ) : (
          <div className={styles.listBox}>
            {/* §5.12: what is still to come is one closed row at the top (W5). A native
                disclosure, so it opens with no client state. */}
            {view.upcoming.count === 0 ? null : (
              <details className={styles.upcoming} id={UPCOMING_ID}>
                <summary className={styles.upcomingSummary}>
                  <Icon name="chevR" size={16} className={styles.chevron} />
                  <span className={styles.upcomingText}>
                    <b className={styles.upcomingTitle}>{t('transactions.upcoming')}</b>
                    <span>
                      {plural(t, locale, 'transactions.upcomingCount', view.upcoming.count)}
                    </span>
                  </span>
                  <AmountText
                    minor={view.upcoming.net}
                    currency={currency}
                    locale={locale}
                    sign="always"
                    muted
                  />
                </summary>
                <div className={styles.upcomingBody}>
                  {view.upcomingDays.map((day) => daySection(day, true))}
                </div>
              </details>
            )}
            {view.days.map((day) => daySection(day, false))}
            {/* W5: the keys of the list. Shown with a mouse only; a screen reader has its own. */}
            <p className={styles.keys} aria-hidden="true">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> {t('transactions.keysMove')}
              </span>
              <span>
                <kbd>↵</kbd> {t('transactions.keysOpen')}
              </span>
              <span>
                <kbd>N</kbd> {t('transactions.keysNew')}
              </span>
              <span>
                <kbd>/</kbd> {t('transactions.keysSearch')}
              </span>
            </p>
          </div>
        )}
```

- [x] **Step 6: Replace the page CSS**

Replace the whole of `apps/web/app/(app)/transactions/transactions.module.css` with:

```css
/* W1: the dialog is over the page, so the list keeps its width whatever is open. */
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

/* The panel is fixed over the page at every width: its wrapper takes no place in the list. */
.side {
  display: contents;
}

.head {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* W5: the summary — one block, three cells (two in a closed period). */
.summary {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-bg);
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 20px 24px;
}

.cell + .cell {
  border-inline-start: 1px solid var(--color-border);
}

.cellLabel {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
}

.cellNote {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

/* W5: the tools — the search grows, the buttons follow it on one wrapping row. */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tools > search {
  flex: 1 1 200px;
  inline-size: auto;
  min-width: 200px;
}

.filterLine {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.filterNote {
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.reset {
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  text-decoration: underline;
  text-decoration-color: var(--color-border-strong);
  text-underline-offset: 3px;
}

/* W5: the list — one block. */
.listBox {
  display: flex;
  flex-direction: column;
  padding: 8px 24px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-bg);
}

/* «Upcoming»: one closed row at the top; open, a hairline closes its rows. */
.upcoming {
  display: flex;
  flex-direction: column;
}

.upcoming[open] {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.upcomingSummary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  cursor: pointer;
  list-style: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

.upcomingSummary::-webkit-details-marker {
  display: none;
}

@media (hover: hover) and (pointer: fine) {
  .upcomingSummary:hover {
    background: var(--color-raised);
  }
}

.upcomingText {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.upcomingTitle {
  color: var(--color-text);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
}

.chevron {
  flex: none;
  color: var(--color-text-muted);
  transition: rotate var(--motion-press) var(--motion-easing);
}

.upcoming[open] .chevron {
  rotate: 90deg;
}

.upcomingBody {
  display: flex;
  flex-direction: column;
}

.day {
  display: flex;
  flex-direction: column;
}

.dayHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 0 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.dayHeading {
  min-width: 0;
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-regular);
}

/* A day's title: the name in the text colour, the date in the muted one. */
.dayTitle {
  color: var(--color-text-muted);
}

.dayName {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* The key hint: only with a mouse, on a wide screen. */
.keys {
  display: none;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  color: var(--color-text-faint);
  font-size: var(--font-size-caption);
}

.keys kbd {
  padding: 1px 5px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-icon-box);
  color: var(--color-text-muted);
  font: inherit;
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (hover: hover) and (pointer: fine) and (min-width: 760px) {
  .keys {
    display: flex;
  }
}

@media (max-width: 759px) {
  .summary {
    grid-auto-flow: row;
  }

  .cell {
    padding: 16px 18px;
  }

  .cell + .cell {
    border-inline-start: 0;
    border-top: 1px solid var(--color-border);
  }

  .listBox {
    padding: 4px 16px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}
```

- [x] **Step 7: Lint, typecheck and test**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines. If Biome reports an unused import or variable in `page.tsx` (for example `Section`, `ListRow`, `upcomingRows`), delete it and run lint again.

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS.

Run: `rtk grep -n "styles\.\(head\|summary\|cell\|cellLabel\|cellNote\|tools\|filterLine\|filterNote\|empty\|reset\|listBox\|upcoming\|upcomingSummary\|upcomingText\|upcomingTitle\|chevron\|upcomingBody\|day\|dayHead\|dayHeading\|dayTitle\|dayName\|keys\)\b" "apps/web/app/(app)/transactions/page.tsx"`
Expected: every class the page uses is in the new CSS. Then search for any other `styles.` name in `page.tsx` that the new CSS does not have, and fix it.

- [x] **Step 8: Look at the page**

Run: `rtk proxy pnpm --filter web dev`. Sign in with a seeded user and open `/transactions` at 1440px and at 390px, in the light and the dark theme. Use a temporary Playwright screenshot script if you have no browser; delete it before you commit.

Expected:
- **Summary:** one block, three cells in the current period and two in a closed one. Under Expenses there is a thin bar with the pace tick and «…% of income spent · day N of M».
- **Tool row:** the search grows, then Account, Category, Tag, «Expenses only» and «More».
- **List:** one block. «Upcoming» is a closed row at the top. Each day shows its date and its expenses. Each row shows the category icon in its colour, and no pill.
- **Key hint:** it shows under the list at 1440px with a mouse. It does not show at 390px.
- **Overflow:** nothing overflows at 390px.

- [x] **Step 9: Commit**

```bash
rtk git add "apps/web/app/(app)/transactions"
rtk git commit -m "feat(web): Transactions as a summary, a tool row and one list (W5)"
```

---

### Task 5: e2e

**Files:**
- Modify: `apps/web/e2e/transactions.spec.ts`

- [x] **Step 1: Fix the comment of the upcoming test**

In the test `'«In arrivo» folds the rows dated ahead and opens on a click'`, replace:

```ts
    // Folded: the disclosure hides its rows. The In arrivo card above the list shows the next
    // three, so the checks look inside the disclosure only.
```

with:

```ts
    // Folded: the disclosure hides its rows.
```

- [x] **Step 2: Add a test for the summary and «More»**

In `test.describe('seeded account', …)`, after the test `'filter chips narrow the list and clear again'`, add:

```ts
  test('the summary counts the period, and «More» holds the other filters', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Riepilogo',
      email: 'tx-summary@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const month = previousMonth(monthOf(ledger.today));
    const rows = ledger.transactions.filter((tx) => inRange(tx.date, month));
    const counted = rows.filter((tx) => tx.kind !== 'transfer' && !tx.excludeFromTotals);
    const spent = counted
      .filter((tx) => tx.kind === 'expense')
      .reduce((total, tx) => total + tx.amount, 0);
    const income = counted.filter((tx) => tx.kind === 'income');

    await page.goto(`/transactions?p=${month.start}`);

    // W5: a closed period has two cells, Expenses and Income; the figures are the period's.
    const summary = page.getByRole('region', { name: t('transactions.summaryLabel') });
    await expect(summary).toContainText(money(spent));
    await expect(summary).toContainText(plural(t, lang, 'transactions.periodCount', income.length));
    await expect(summary.getByText(t('home.upcoming'), { exact: true })).toHaveCount(0);

    // «More» holds «Income only»; its label then names the filter that is on.
    await page.getByRole('button', { name: t('transactions.moreFilters') }).click();
    await page.getByRole('menuitem', { name: t('transactions.onlyIncome') }).click();
    await expect(page.getByRole('button', { name: t('transactions.onlyIncome') })).toBeVisible();
    await expect(page.locator(`${SETTLED_DAYS} a`)).toHaveCount(
      rows.filter((tx) => tx.kind === 'income').length,
    );
    await expect(page.getByRole('link', { name: t('transactions.resetFilters') })).toBeVisible();
    await member.context.close();
  });
```

If `LedgerTransaction` has no `excludeFromTotals` field, use the field name that `ledgerRows.ts` gives it (the first test of the file already reads `tx.excludeFromTotals`).

- [x] **Step 3: Run the e2e suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes. A test that looked for the summary cards (`Card`) or for the dividers «After today» / «Already recorded» must follow the new page: fix the test, and say why in the commit.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

- [x] **Step 4: Commit**

```bash
rtk git add apps/web/e2e
rtk git commit -m "test(web): the summary and the More menu of Transactions (W5)"
```

---

### Task 6: Roadmap and gates

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Tick R3**

In `docs/superpowers/plans/README.md`, replace:

```markdown
- [ ] **R3** — Transactions (W5).
```

with:

```markdown
- [x] **R3** — Transactions (W5) (`plans/2026-10-21-web-redesign-r3-transactions.md`).
```

After the paragraph `**Acceptance for R2:** …`, add:

```markdown
**Acceptance for R3:** Transactions shows one summary block (three cells, two in a closed period),
one tool row (search, Account, Category, Tag, «Expenses only», «More») and one list block; each row
has the category icon in its colour and no chips; the key hint shows under the list with a mouse.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck --continue`
Expected: every package passes. On a machine with Node older than 22.22, `site` fails on the engine check only; that is not a failure of this plan.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Look at Statistics**

`Chip.module.css` changed in Task 2. Open `/stats` at 1440px and at 390px.
Expected: its chips are tool buttons and nothing overflows. R4 rebuilds the page.

- [ ] **Step 4: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R3 done"
```
