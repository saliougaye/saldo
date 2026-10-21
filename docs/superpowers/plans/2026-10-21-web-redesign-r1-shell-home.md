# Web redesign R1 — the top bar and the new Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar of the web app with one top bar on every width, and rebuild the Home as one 1040px column of four blocks (Summary, Budget, Transactions, Goals).

**Architecture:** The shell (`apps/web/app/(app)/layout.tsx`) renders the top bar, the content column and the tab bar. The sidebar goes. The Home page stays a server component that reads `homeView`; one new client component, `TrendScrub`, draws the period trend and lets you move along it with the pointer and the arrow keys. `homeView` changes in two places: «Coming up» is sorted nearest first, and a closed period gets 10 latest rows.

**Tech Stack:** Next.js (App Router, server components), CSS Modules with the `@saldo/ui` token variables, `@saldo/core`, `@saldo/i18n`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-web-home-redesign.html` (H1–H12). The pages spec `2026-10-21-web-pages-redesign.html` is for the plans R2–R7, not this one.

**Mockup (not in the repository):** `docs/design/redesign/home-final.html`. If the folder is missing, the spec carries every value.

**Branch:** `redesign/web` (already created from `main`, the two specs are committed on it).

---

## The redesign in plans

The two specs are split into seven plans. Each plan ends with software that works.

| Plan | Scope | Spec |
|---|---|---|
| **R1 (this plan)** | Top bar, column, Home | H1–H12 |
| R2 | The centred dialog, and the edit form opened from a transaction row | W1–W4 |
| R3 | Transactions | W5 |
| R4 | Statistics | W6–W8 |
| R5 | Accounts | W9 |
| R6 | Profile and Admin | W10 |
| R7 | Empty states and the new `@saldo/core` functions | W11 |

Decisions this plan takes where the spec leaves a choice:

- **No “Search” in the top bar.** The spec (open item 5) says: if the command palette does not exist, do not show “Search”. It does not exist.
- **Admin stays in the top bar** as an icon link, for the `admin` role, until R6 moves it into Profile.
- **The Home empty state** follows H10 (empty title, text, one action) in this plan. R7 replaces it with “Getting started” (W11).
- **The hero cents** (H5: 45% of the size, `textFaint`) change `AmountText`'s `hero` size for every page. Statistics and Accounts use the same figure, and R4/R5 keep it.

## File structure

| File | What changes |
|---|---|
| `packages/ui/src/tokens.ts` | `layout`: `topbarHeight` 56, new `contentColumn`, `columnPadding`, `shellBreakpoint`. |
| `packages/i18n/src/locales/*.ts` (7 locales) | 7 new keys (`home.*`, `targets.spent`). |
| `apps/web/src/features/home/homeView.ts` (+ test) | «Coming up» nearest first; `HOME_ROWS_CLOSED`. |
| `apps/web/app/(app)/layout.tsx` | No sidebar. |
| `apps/web/app/(app)/shell.module.css` | One column of 1040px. |
| `apps/web/src/ui/TopBar.tsx`, `TopBar.module.css` | The full top bar (H1). |
| `apps/web/src/ui/TabBar.module.css` | Breakpoint 1024 → 760. |
| `apps/web/src/ui/SideBar.*`, `ProfileLink.*` | Deleted. |
| `apps/web/src/ui/AmountText.module.css` | Hero cents at 45%, `textFaint`. |
| `apps/web/src/ui/charts/TrendScrub.tsx`, `.module.css` | New: the scrubbable trend (H5). |
| `apps/web/app/(app)/home/page.tsx`, `home.module.css` | The four blocks. |
| `apps/web/app/(app)/home/loading.tsx`, `loading.module.css` | The loading state (H10). |
| `apps/web/e2e/home-stats.spec.ts` | One assertion follows the new budget text. |
| `docs/superpowers/plans/README.md` | The redesign in the roadmap. |

---

### Task 1: Layout tokens

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `layout` object)

Design tokens get no test (AGENTS.md, «Tests»). `css.ts` writes every `layout` entry as `--layout-<kebab-name>`, so the new entries become `--layout-content-column`, `--layout-column-padding` and `--layout-shell-breakpoint` with no other change.

- [x] **Step 1: Change `topbarHeight` and add the three entries**

In `packages/ui/src/tokens.ts`, replace:

```ts
  /** Web (§17.1.7). The top bar that replaces the tab bar on wide screens. */
  topbarHeight: 64,
```

with:

```ts
  /** Web (H1, 2026-10-20): the top bar, on every width. */
  topbarHeight: 56,
  /** Web (H2): the one column every page sits in. The inner part of the top bar has the same width. */
  contentColumn: 1040,
  /** Web (H2): the padding on each side of the column, at and above `shellBreakpoint`. */
  columnPadding: 32,
  /**
   * Web (H1): the top bar shows the destinations and «New transaction» at and above this width;
   * below it, the phone's tab bar does. A media query cannot read a custom property, so the web
   * writes 760 in its `@media` rules with a comment naming this token.
   */
  shellBreakpoint: 760,
```

- [x] **Step 2: Typecheck the package**

Run: `rtk proxy pnpm --filter @saldo/ui typecheck`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
rtk git add packages/ui/src/tokens.ts
rtk git commit -m "feat(ui): layout tokens for the web top bar and the 1040px column"
```

---

### Task 2: New strings

**Files:**
- Modify: `packages/i18n/src/locales/en.ts` (`home`, `targets`)
- Modify: `packages/i18n/src/locales/it.ts` (`home`, `targets`)
- Modify: `packages/i18n/src/locales/de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts` (`home`, `targets`)

The catalog test checks that every locale has the key structure of `it`. Add the 7 keys to all seven locales.

- [x] **Step 1: Add the English keys**

In `packages/i18n/src/locales/en.ts`, in `home`, after `unbudgetedNote: 'spent in categories with no budget',` add:

```ts
    vsUsual: 'Vs usual',
    trendThisPeriod: 'This period',
    trendUsual: 'Usual',
    trendSpentBy: 'spent by {{date}}',
    trendUsualBy: 'usual by {{date}}',
    trendHint: 'Use the arrow keys to move along the days.',
```

In `targets`, after `leftDetail: 'left · {{spent}} spent of {{limit}}',` add:

```ts
    spent: '{{amount}} spent',
```

- [x] **Step 2: Add the Italian keys**

In `packages/i18n/src/locales/it.ts`, in `home`, after the `unbudgetedNote` line add:

```ts
    vsUsual: 'Rispetto al solito',
    trendThisPeriod: 'Questo periodo',
    trendUsual: 'Di solito',
    trendSpentBy: 'spesi al {{date}}',
    trendUsualBy: 'di solito al {{date}}',
    trendHint: 'Usa le frecce per scorrere i giorni.',
```

In `targets`, after the `leftDetail` line add:

```ts
    spent: '{{amount}} spesi',
```

- [x] **Step 2b: Add the keys to `de`, `es`, `fr`, `pt` and `sv`**

Same 7 keys, in the same places, translated. The key-structure test fails without them.

- [x] **Step 3: Run the i18n tests (parity and keys)**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: all tests pass.

- [x] **Step 4: Commit**

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): strings for the trend and the budget rings of the new Home"
```

---

### Task 3: `homeView` — «Coming up» nearest first, 10 rows in a closed period

**Files:**
- Modify: `apps/web/src/features/home/homeView.ts`
- Test: `apps/web/src/features/home/homeView.test.ts`

The phone has its own query and does not read `homeView`, so this change does not reach the phone. H7 asks for the nearest date first; H8 asks for 10 latest rows in a closed period.

- [x] **Step 1: Write the failing tests**

Append to the `describe('homeView', …)` block in `apps/web/src/features/home/homeView.test.ts`:

```ts
  it('lists «Coming up» with the nearest date first (H7)', () => {
    const view = homeView({
      data: dataWith([
        tx({ id: 'far', amount: 100, date: '2026-09-28' }),
        tx({ id: 'near', amount: 100, date: '2026-09-17' }),
        tx({ id: 'middle', amount: 100, date: '2026-09-22' }),
      ]),
      today: '2026-09-15',
      def: { kind: 'month', startDay: 1 },
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    });
    expect(view.upcoming.rows.map((row) => row.id)).toEqual(['near', 'middle', 'far']);
  });

  it('shows 10 latest rows in a closed period and 5 in the current one (H8)', () => {
    const august = Array.from({ length: 12 }, (_, index) =>
      tx({ id: `a${index}`, amount: 100, date: `2026-08-${String(index + 10).padStart(2, '0')}` }),
    );
    const september = Array.from({ length: 12 }, (_, index) =>
      tx({ id: `s${index}`, amount: 100, date: `2026-09-${String(index + 1).padStart(2, '0')}` }),
    );
    const data = dataWith([...august, ...september]);
    const def = { kind: 'month', startDay: 1 } as const;
    const closed = homeView({
      data,
      today: '2026-09-15',
      def,
      period: {
        range: { start: '2026-08-01', end: '2026-08-31' },
        isCurrent: false,
        elapsed: 31,
        length: 31,
      },
    });
    const current = homeView({
      data,
      today: '2026-09-15',
      def,
      period: {
        range: { start: '2026-09-01', end: '2026-09-30' },
        isCurrent: true,
        elapsed: 15,
        length: 30,
      },
    });
    expect(closed.recent).toHaveLength(10);
    expect(current.recent).toHaveLength(5);
  });
```

- [x] **Step 2: Run the tests and make sure they fail**

Run: `rtk proxy pnpm --filter web test -- src/features/home/homeView.test.ts`
Expected: the two new tests FAIL. The first gets `['far', 'middle', 'near']`; the second gets a length of 5 for the closed period.

- [x] **Step 3: Implement**

In `apps/web/src/features/home/homeView.ts`, replace:

```ts
/** How many rows «In arrivo» and «Ultime transazioni» show before «Vedi tutte» (§6.2). */
export const HOME_ROWS = 5;
```

with:

```ts
/** How many rows «In arrivo» and «Ultime transazioni» show before «Vedi tutte» (§6.2). */
export const HOME_ROWS = 5;

/**
 * H8: a closed period has no «In arrivo», so «Ultime transazioni» takes both columns, 5 rows in
 * each.
 */
export const HOME_ROWS_CLOSED = 10;

/** H7: «In arrivo» reads as a timeline, the nearest date first. Equal dates keep their order. */
function nearestFirst(a: Transaction, b: Transaction): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}
```

Replace:

```ts
  const upcomingAll = byDateDesc.filter((tx) => isUpcoming(tx, today) && tx.date <= periodEnd);
```

with:

```ts
  const upcomingAll = byDateDesc
    .filter((tx) => isUpcoming(tx, today) && tx.date <= periodEnd)
    .sort(nearestFirst);
```

Replace:

```ts
    .slice(0, HOME_ROWS)
    .map(row);
```

with:

```ts
    .slice(0, period.isCurrent ? HOME_ROWS : HOME_ROWS_CLOSED)
    .map(row);
```

- [x] **Step 4: Run the tests and make sure they pass**

Run: `rtk proxy pnpm --filter web test -- src/features/home/homeView.test.ts`
Expected: 4 tests PASS.

- [x] **Step 5: Commit**

```bash
rtk git add apps/web/src/features/home/homeView.ts apps/web/src/features/home/homeView.test.ts
rtk git commit -m "feat(web): «Coming up» nearest first, 10 latest rows in a closed period"
```

---

### Task 4: The shell — one top bar, no sidebar

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/app/(app)/shell.module.css`
- Modify: `apps/web/src/ui/TopBar.tsx`, `apps/web/src/ui/TopBar.module.css`
- Modify: `apps/web/src/ui/TabBar.module.css`
- Delete: `apps/web/src/ui/SideBar.tsx`, `SideBar.module.css`, `ProfileLink.tsx`, `ProfileLink.module.css`

- [x] **Step 1: Make sure nothing else uses the sidebar**

Run: `rtk grep -n "SideBar\|ProfileLink\|data-sidebar" apps/web/src apps/web/app apps/web/e2e`
Expected: matches only in `layout.tsx`, `shell.module.css`, `SideBar.tsx` and `ProfileLink.tsx`. If an e2e test matches, change it in Task 9.

Note (checked on the code): `SubnavLayout` (Profile and Admin) still draws its sub-navigation as a fixed 240px column on screens of 1024px and wider, and `data-section-nav` no longer hides anything. Do not touch it in this plan. R6 replaces it. Until then, Profile and Admin overlap the left edge of the column at those widths.

- [x] **Step 2: Replace the layout**

Replace the whole `apps/web/app/(app)/layout.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { navItems } from '../../src/features/shell/nav';
import { userI18n } from '../../src/i18n/server';
import { isAdminUser } from '../../src/server/auth/admin';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { NavPendingProvider } from '../../src/ui/NavPending';
import { Shortcuts } from '../../src/ui/Shortcuts';
import { TabBar } from '../../src/ui/TabBar';
import { TopBar } from '../../src/ui/TopBar';
import styles from './shell.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * H1 and H2 (2026-10-20): one top bar on every width, and one column of 1040px under it. Below
 * 760px the top bar keeps the brand and the avatar, and the phone's tab bar navigates.
 * The theme is *not* set here: the root layout puts it on `<html>`, which is the only element a
 * portalled popup is also inside.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireWebUser();
  const admin = isAdminUser(user);
  const { t } = await userI18n(user.id);
  const items = navItems(admin).map((item) => ({ ...item, label: t(item.labelKey) }));
  return (
    <NavPendingProvider label={t('common.loading')}>
      <div className={styles.shell}>
        <a className={styles.skip} href="#content">
          {t('web.shell.skipToContent')}
        </a>
        <TopBar
          items={items}
          user={{ name: user.displayName }}
          strings={{
            label: t('web.shell.mainNav'),
            newTransaction: t('web.shell.newTransaction'),
            profile: t('profile.title'),
          }}
        />
        <main className={styles.content} id="content">
          {children}
        </main>
        <TabBar
          items={items.filter((item) => item.trailing !== true)}
          label={t('web.shell.sectionNav')}
          newTransaction={t('web.shell.newTransaction')}
        />
        <Shortcuts />
      </div>
    </NavPendingProvider>
  );
}
```

- [x] **Step 3: Replace the shell CSS**

Replace the whole `apps/web/app/(app)/shell.module.css` with:

```css
.shell {
  min-height: 100dvh;
  background: var(--color-bg);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
}

/* H2: one column of 1040px for every page, with the top bar's inner edges. */
.content {
  flex: 1;
  width: 100%;
  max-width: calc(var(--layout-content-column) + 2 * var(--layout-column-padding));
  margin: 0 auto;
  padding: 16px var(--layout-screen-padding-x) calc(var(--layout-tab-bar-height) + 24px);
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .content {
    padding: 16px var(--layout-column-padding) 64px;
  }
}

.skip {
  position: absolute;
  inset-inline-start: -9999px;
}

.skip:focus {
  position: static;
  display: inline-block;
  padding: 8px 12px;
}
```

- [x] **Step 4: Replace the top bar**

Replace the whole `apps/web/src/ui/TopBar.tsx` with:

```tsx
import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Avatar } from './Avatar';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import { NewTransactionLink } from './NewTransactionLink';
import styles from './TopBar.module.css';

interface Props {
  items: (NavItem & { label: string })[];
  user: { name: string };
  strings: {
    /** Names the landmark: the tab bar is a second `<nav>` on the same page (§17.1.7). */
    label: string;
    newTransaction: string;
    profile: string;
  };
}

/**
 * H1: from left to right the brand, the four destinations, «New transaction» and the avatar.
 * Admin, for the `admin` role, is an icon beside the avatar until R6 moves it into Profile.
 * Below 760px only the brand, Admin and the avatar show: the tab bar carries the rest.
 */
export function TopBar({ items, user, strings }: Props) {
  const main = items.filter((item) => item.trailing !== true);
  const trailing = items.filter((item) => item.trailing === true);
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/home">
          <Brand />
        </Link>
        <nav className={styles.nav} aria-label={strings.label}>
          {main.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              icon={item.icon as IconName}
              label={item.label}
            />
          ))}
        </nav>
        <div className={styles.actions}>
          {trailing.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              icon={item.icon as IconName}
              label={item.label}
              iconOnly
            />
          ))}
          {/* Decision 8: the form on Transazioni, from any page; `N` does the same (`Shortcuts`). */}
          <NewTransactionLink className={styles.new} aria-keyshortcuts="n">
            <Icon name="plus" size={16} />
            {strings.newTransaction}
          </NewTransactionLink>
          <Avatar name={user.name} label={strings.profile} />
        </div>
      </div>
    </header>
  );
}
```

Replace the whole `apps/web/src/ui/TopBar.module.css` with:

```css
/* H1: 56px, sticky, the page colour at 88% with a 12px blur, a 1px line under it. */
.bar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--layout-topbar-height);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg) 88%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

/* H2: the same inner width as the content column, so the brand and the avatar align with the blocks. */
.inner {
  height: 100%;
  max-width: calc(var(--layout-content-column) + 2 * var(--layout-column-padding));
  margin: 0 auto;
  padding: 0 var(--layout-screen-padding-x);
  display: flex;
  align-items: center;
  gap: 24px;
}

.brand {
  color: var(--color-text);
  text-decoration: none;
}

/* The destinations are words only: the icons belong to the tab bar. */
.nav {
  display: none;
  gap: 2px;
}

.nav a {
  height: 32px;
}

.nav svg {
  display: none;
}

.actions {
  margin-inline-start: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.new {
  display: none;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border-radius: var(--radius-input);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-decoration: none;
  transition: scale var(--motion-press) var(--motion-easing);
}

.new:active {
  scale: 0.97;
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .inner {
    padding: 0 var(--layout-column-padding);
  }

  .nav {
    display: flex;
  }

  .new {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .new:active {
    scale: 1;
  }
}
```

- [x] **Step 5: Move the tab bar's breakpoint to 760**

In `apps/web/src/ui/TabBar.module.css`, replace:

```css
/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
```

with:

```css
/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
```

- [x] **Step 6: Delete the sidebar**

```bash
rtk git rm apps/web/src/ui/SideBar.tsx apps/web/src/ui/SideBar.module.css apps/web/src/ui/ProfileLink.tsx apps/web/src/ui/ProfileLink.module.css
```

- [x] **Step 7: Typecheck and lint**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

- [ ] **Step 8: Look at it**

Run: `rtk proxy pnpm --filter web dev`, sign in, and open `/home` at 1440px, 900px and 390px.
Expected: at 1440px and 900px, the top bar shows the brand, Home, Transactions, Statistics, Accounts, «New transaction» and the avatar, and no sidebar shows. At 390px the top bar shows the brand and the avatar, and the tab bar is at the bottom. The brand aligns with the left edge of the content.

- [x] **Step 9: Commit**

```bash
rtk git add apps/web/app/\(app\)/layout.tsx apps/web/app/\(app\)/shell.module.css apps/web/src/ui/TopBar.tsx apps/web/src/ui/TopBar.module.css apps/web/src/ui/TabBar.module.css
rtk git commit -m "feat(web): one top bar on every width, the sidebar goes (H1, H2)"
```

---

### Task 5: The hero figure — cents at 45%

**Files:**
- Modify: `packages/ui/src/tokens.ts`
- Modify: `apps/web/src/ui/AmountText.module.css`

- [x] **Step 1: Add the token and the rule**

The test `cssTokens.test.ts` refuses a font size typed by hand, `em` included. So add a token first. In `packages/ui/src/tokens.ts`, in `fontSize`, after `heroWeb: 56,` add `heroWebCents: 25.2,` (45% of 56). Then:

In `apps/web/src/ui/AmountText.module.css`, after the `.hero { … }` block, add:

```css
/* H5: in the big figure, the cents and the currency are 45% of the size (a token: no `em` by hand), in `textFaint`. */
.hero .dim {
  font-size: var(--font-size-hero-web-cents);
  opacity: 1;
  color: var(--color-text-faint);
  letter-spacing: var(--tracking-tight);
}
```

- [x] **Step 2: Commit**

```bash
rtk git add packages/ui/src/tokens.ts apps/web/src/ui/AmountText.module.css
rtk git commit -m "feat(web): the hero figure's cents at 45% in textFaint (H5)"
```

---

### Task 6: `TrendScrub` — the period trend you can move along

**Files:**
- Create: `apps/web/src/ui/charts/TrendScrub.tsx`
- Create: `apps/web/src/ui/charts/TrendScrub.module.css`

The component is a client component because it follows the pointer and the keys. The page formats every string and amount on the server and passes arrays, so the client code does not need the translator or the currency.

The control is a `slider` (ARIA): the value is the day, `aria-valuetext` is what the tooltip says. A test for this component would test a component with mocked data, which AGENTS.md does not want; Task 9 covers it end to end.

- [ ] **Step 1: Create the component**

Create `apps/web/src/ui/charts/TrendScrub.tsx`:

```tsx
'use client';

import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import styles from './TrendScrub.module.css';

/** The coordinate space of the lines. The SVG stretches it to the width it gets. */
const VIEW_WIDTH = 600;
/** H5: the chart is 170px high. */
const HEIGHT = 170;
/** The top of the highest value stays below the top edge, so the dot and its ring stay inside. */
const HEADROOM = 0.92;
/** The five dates under the chart: the first day, the last day and three between. */
const AXIS_TICKS = 5;

interface Props {
  /** Cumulative counted spend per elapsed day (§5.6). */
  current: readonly number[];
  /** The usual spend per day of the whole period. */
  usual: readonly number[];
  /** How many days the period has. The x axis covers all of them. */
  span: number;
  /** One label per day of the period, «12 Sep». */
  dates: readonly string[];
  /** One formatted amount per elapsed day, for the tooltip. */
  currentAmounts: readonly string[];
  /** One formatted amount per day of the period, for the tooltip after today. */
  usualAmounts: readonly string[];
  strings: {
    /** Names the slider for a screen reader. */
    label: string;
    thisPeriod: string;
    usual: string;
    /** «spent by {date}», one per day. */
    spentBy: readonly string[];
    /** «usual by {date}», one per day. */
    usualBy: readonly string[];
    hint: string;
  };
}

function points(values: readonly number[], x: (index: number) => number, y: (value: number) => number): string {
  return values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
}

/**
 * H5: this period as a solid line, the usual as a dashed line, three grid lines and five dates.
 * Move the pointer over it, or focus it and use ← →, Home and End: a vertical line, a dot and a
 * tooltip show the day. Up to today the tooltip shows what you spent by that day; after today, what
 * you usually spend by that day, and the dot is faint.
 */
export function TrendScrub({ current, usual, span, dates, currentAmounts, usualAmounts, strings }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState<number | null>(null);
  const days = Math.max(span, 1);
  const max = Math.max(1, ...current, ...usual);
  const x = (index: number) => (days === 1 ? 0 : (index / (days - 1)) * VIEW_WIDTH);
  const y = (value: number) => HEIGHT - (value / max) * HEIGHT * HEADROOM;
  const last = Math.max(current.length - 1, 0);
  const clamp = (index: number) => Math.min(days - 1, Math.max(0, index));

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    setDay(clamp(Math.round(ratio * (days - 1))));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = day ?? last;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = from - 1;
    if (event.key === 'ArrowRight') next = from + 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = days - 1;
    if (next === null) return;
    event.preventDefault();
    setDay(clamp(next));
  };

  const shown = day ?? last;
  const past = shown < current.length;
  const value = past ? (current[shown] ?? 0) : (usual[shown] ?? 0);
  const amount = past ? (currentAmounts[shown] ?? '') : (usualAmounts[shown] ?? '');
  const caption = past ? (strings.spentBy[shown] ?? '') : (strings.usualBy[shown] ?? '');
  const left = (x(shown) / VIEW_WIDTH) * 100;
  const top = (y(value) / HEIGHT) * 100;
  const ticks = Array.from({ length: AXIS_TICKS }, (_, index) =>
    Math.round((index * (days - 1)) / (AXIS_TICKS - 1)),
  );

  return (
    <div className={styles.trend}>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i className={styles.keyCurrent} />
          {strings.thisPeriod}
        </span>
        <span>
          <i className={styles.keyUsual} />
          {strings.usual}
        </span>
      </div>
      <div
        ref={box}
        className={`${styles.scrub} ${day === null ? '' : styles.on}`}
        role="slider"
        tabIndex={0}
        aria-label={strings.label}
        aria-describedby="trend-hint"
        aria-valuemin={1}
        aria-valuemax={days}
        aria-valuenow={shown + 1}
        aria-valuetext={`${amount}, ${caption}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setDay(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setDay(null)}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {[0.25, 0.5, 0.75].map((share) => (
            <line
              key={share}
              className={styles.grid}
              x1={0}
              x2={VIEW_WIDTH}
              y1={HEIGHT * share}
              y2={HEIGHT * share}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            className={styles.base}
            x1={0}
            x2={VIEW_WIDTH}
            y1={HEIGHT}
            y2={HEIGHT}
            vectorEffect="non-scaling-stroke"
          />
          {usual.length < 2 ? null : (
            <polyline className={styles.usual} points={points(usual, x, y)} vectorEffect="non-scaling-stroke" />
          )}
          {current.length < 2 ? null : (
            <polyline className={styles.current} points={points(current, x, y)} vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <span className={styles.line} style={{ insetInlineStart: `${left}%` }} aria-hidden="true" />
        <span
          className={`${styles.dot} ${past ? '' : styles.dotFaint}`}
          style={{ insetInlineStart: `${left}%`, insetBlockStart: `${top}%` }}
          aria-hidden="true"
        />
        <span
          className={styles.tip}
          style={{
            insetInlineStart: `${left}%`,
            transform: `translateX(${left < 12 ? '0' : left > 88 ? '-100%' : '-50%'})`,
          }}
          aria-hidden="true"
        >
          <b>{amount}</b>
          <small>{caption}</small>
        </span>
      </div>
      <div className={styles.axis} aria-hidden="true">
        {ticks.map((index) => (
          <span key={index}>{dates[index] ?? ''}</span>
        ))}
      </div>
      <p id="trend-hint" className={styles.hint}>
        {strings.hint}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS**

Create `apps/web/src/ui/charts/TrendScrub.module.css`:

```css
.trend {
  min-width: 0;
}

.legend {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 10px;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  display: inline-block;
  width: 14px;
}

.keyCurrent {
  border-top: 1.75px solid var(--color-text);
}

.keyUsual {
  border-top: 1.25px dashed var(--color-text-faint);
}

.scrub {
  position: relative;
  height: 170px;
  cursor: crosshair;
  touch-action: pan-y;
  outline: none;
}

.scrub:focus-visible {
  outline: 2px solid var(--color-text);
  outline-offset: 6px;
  border-radius: var(--radius-input);
}

.svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.grid {
  stroke: var(--color-border);
  stroke-width: 1;
}

.base {
  stroke: var(--color-border-strong);
  stroke-width: 1;
}

.current {
  fill: none;
  stroke: var(--color-text);
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.usual {
  fill: none;
  stroke: var(--color-text-faint);
  stroke-width: 1.25;
  stroke-dasharray: 3 4;
}

.line,
.dot,
.tip {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease;
}

.on .line,
.on .dot,
.on .tip {
  opacity: 1;
}

.line {
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-border-strong);
}

.dot {
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: var(--radius-pill);
  background: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-bg);
}

.on .dotFaint {
  opacity: 0.4;
}

.tip {
  top: -8px;
  padding: 6px 9px;
  border-radius: var(--radius-input);
  background: var(--color-text);
  color: var(--color-bg);
  font-size: var(--font-size-caption);
  line-height: 1.35;
  white-space: nowrap;
}

.tip b {
  display: block;
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-semibold);
}

.tip small {
  opacity: 0.72;
}

.axis {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--color-text-faint);
  font-size: var(--font-size-caption);
}

/* Read by a screen reader through `aria-describedby`, not shown. */
.hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .line,
  .dot,
  .tip {
    transition: none;
  }
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines. If Biome reformats the long lines, run `rtk proxy pnpm exec biome check --write apps/web/src/ui/charts/TrendScrub.tsx` and check the diff.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/src/ui/charts/TrendScrub.tsx apps/web/src/ui/charts/TrendScrub.module.css
rtk git commit -m "feat(web): TrendScrub, the period trend you move along with the pointer or the keys (H5)"
```

---

### Task 7: The Home — four blocks

**Files:**
- Modify: `apps/web/app/(app)/home/page.tsx` (whole file)
- Modify: `apps/web/app/(app)/home/home.module.css` (whole file)

Every figure still comes from `homeView`. The e2e helpers depend on three things that this page keeps: each block is a `<section>` with an `<h2>`; a figure label and its amount have the same parent; the budget and goal tiles carry their `targets.itemLabel` and `goals.itemLabel` in a `VisuallyHidden`.

- [ ] **Step 1: Replace the page**

Replace the whole `apps/web/app/(app)/home/page.tsx` with:

```tsx
import type { BudgetAdvice, BudgetView, GoalView } from '@saldo/core';
import { goalPace, goalTone, pocketParentCandidates } from '@saldo/core';
import {
  budgetCardStatusText,
  formatDayMonth,
  formatMoney,
  type GoalTextDeps,
  goalCardStatusText,
  goalLabel,
  goalOf,
  goalStatus,
  plural,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { Fragment, type ReactNode } from 'react';
import { NEW_GOAL_HREF } from '../../../src/features/accounts/goalLinks';
import { budgetRowFor } from '../../../src/features/budgets/budgetRow';
import { budgetStatus } from '../../../src/features/budgets/budgetText';
import { HOME_ROWS, type HomeRow, homeView } from '../../../src/features/home/homeView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { TrendScrub } from '../../../src/ui/charts/TrendScrub';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { NewTransactionLink } from '../../../src/ui/NewTransactionLink';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { TargetRing } from '../../../src/ui/TargetRing';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import styles from './home.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** H6: the budget ring of the Home. */
const BUDGET_RING = 52;
/** H9: the goal ring of the Home. */
const GOAL_RING = 40;

interface Segment {
  key: string;
  text: string;
  strong: boolean;
}

/** The catalogs' one piece of markup: `<b>` around the figure a target's sentence is about (§5.13). */
function segments(text: string): Segment[] {
  return text
    .split(/<b>|<\/b>/)
    .map((part, index) => ({ key: `${index}`, text: part, strong: index % 2 === 1 }));
}

/** What `<Trans>` does on the phone, for a server component with no i18next around it. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((segment) =>
        segment.strong ? (
          <b className={styles.strong} key={segment.key}>
            {segment.text}
          </b>
        ) : (
          <Fragment key={segment.key}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

/** A category colour as the CSS variable the root layout injects, or nothing for a row with none. */
function tint(colorIndex: number | null | undefined): string | undefined {
  return colorIndex === null || colorIndex === undefined
    ? undefined
    : `var(--category-${paletteIndex(colorIndex)})`;
}

/**
 * The Home (H4): one column, four blocks, in the order of the questions — how the period goes
 * (Summary), what you can still spend (Budget), what moved (Transactions), what you set aside
 * (Goals). Every figure comes from `homeView`, the same `@saldo/core` the phone calls.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, period, settings } = page;
  const view = homeView({
    data: page.data,
    today,
    def,
    period,
    kindLabel: (kind) => t(`kinds.${kind}`),
  });

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = (ratio: number) => t('targets.percent', { value: Math.round(ratio * 100) });

  // ---- Summary (H5) ---------------------------------------------------------------------------
  const delta = view.trend.delta;
  const dayDates = Array.from({ length: Math.max(period.length, 1) }, (_, index) => {
    const date = new Date(`${period.range.start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return formatDayMonth(date.toISOString().slice(0, 10), locale);
  });

  // ---- Transactions (H7, H8) ------------------------------------------------------------------
  const txRow = (row: HomeRow, upcoming: boolean) => (
    <Link
      key={row.id}
      className={`${styles.row} ${upcoming ? styles.rowUp : ''}`}
      href={`/transactions?t=${row.id}`}
    >
      <time className={styles.rowDate} dateTime={row.date}>
        {formatDayMonth(row.date, locale)}
      </time>
      <span className={styles.rowIcon} style={{ color: tint(row.colorIndex) }}>
        <Icon name={row.icon as IconName} size={16} />
      </span>
      <span className={styles.rowText}>
        <b>{row.title}</b>
        {row.recurring ? (
          <>
            <Icon name="repeat" size={12} className={styles.rowRepeat} />
            <VisuallyHidden>{t('recurrence.recurringRow')}</VisuallyHidden>
          </>
        ) : null}
        <span>{row.subtitle}</span>
      </span>
      <AmountText
        minor={row.amount.minor}
        currency={currency}
        locale={locale}
        sign={row.amount.signDisplay}
        muted={upcoming || row.amount.muted}
      />
    </Link>
  );
  const showUpcoming = period.isCurrent && view.upcoming.count > 0;
  const newTransaction = (
    <NewTransactionLink className={styles.primaryAction}>
      <Icon name="plus" size={15} />
      {t('web.shell.newTransaction')}
    </NewTransactionLink>
  );
  const emptyTransactions = (
    <div className={styles.empty}>
      <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />
      {newTransaction}
    </div>
  );

  // ---- Budget (H6, D5) ------------------------------------------------------------------------
  const budgets = budgetRowFor({
    t,
    money,
    percent,
    categories: page.data.categories,
    styles,
    href: (item) => `/profile/budgets?b=${item.budget.id}`,
  });
  const featured = view.budgets.items.find((item) => item.budget.id === view.budgets.featuredId);
  const advice = view.budgets.advice;
  const adviceSentence = (sentence: BudgetAdvice, item: BudgetView): ReactNode => {
    const end = formatDayMonth(item.range.end, locale);
    if (sentence.kind === 'perDay') {
      return <Rich text={t('targets.perDay', { amount: money(sentence.perDay), end })} />;
    }
    if (sentence.kind === 'overLimit') {
      return <Rich text={t('targets.overLimitAction', { amount: money(sentence.overrun) })} />;
    }
    return null;
  };
  const budgetTile = (item: BudgetView) => {
    const tone = budgets.tone(item);
    return (
      <Link key={item.budget.id} className={styles.tile} href={`/profile/budgets?b=${item.budget.id}`}>
        <VisuallyHidden>{budgets.label(item)}</VisuallyHidden>
        <span className={styles.tileBody} aria-hidden="true">
          <TargetRing
            size={BUDGET_RING}
            ratio={item.ratio}
            pace={budgets.pace(item)}
            tone={tone}
            icon={item.budget.icon as IconName}
            colorIndex={budgets.colour(item)}
          />
          <span className={styles.tileName}>{item.budget.name}</span>
          <span className={item.overLimit ? styles.tileOver : styles.tileValue}>
            {item.overLimit
              ? t('targets.overLimitBy', { amount: money(item.spent - item.limit) })
              : t('targets.left', { amount: money(item.limit - item.spent) })}
          </span>
          <span className={styles.tileNote}>{t('targets.spent', { amount: money(item.spent) })}</span>
          <span className={styles.tileNote}>
            {item.open ? (
              budgetStatus(item, { t, money })
            ) : (
              <Rich text={t('targets.closed', { percent: percent(item.ratio) })} />
            )}
          </span>
        </span>
      </Link>
    );
  };
  const budgetStatusLine = budgetCardStatusText(view.budgets.items.length, view.budgets.status, t, locale);

  // ---- Goals (H9) -----------------------------------------------------------------------------
  const goalDeps: GoalTextDeps = { t, locale, money, today, periodKind: settings.periodKind };
  const goalWebTone = (item: GoalView): 'normal' | 'over' | 'done' => {
    const tone = goalTone(item.progress);
    return tone === 'attention' ? 'over' : tone === 'plain' ? 'normal' : 'done';
  };
  const goalRow = (item: GoalView) => (
    <Link key={item.account.id} className={styles.goal} href={`/accounts?g=${item.account.id}`}>
      <VisuallyHidden>{goalLabel(item, goalDeps)}</VisuallyHidden>
      <TargetRing
        size={GOAL_RING}
        ratio={item.progress.ratio}
        pace={goalPace(item.progress)}
        tone={goalWebTone(item)}
        icon={item.account.icon as IconName}
        colorIndex={item.account.colorIndex}
      />
      <span className={styles.goalText} aria-hidden="true">
        <b>{item.account.name}</b>
        <span>{goalOf(item, goalDeps)}</span>
      </span>
      <span className={styles.goalValue} aria-hidden="true">
        {percent(item.progress.ratio)}
        <small className={goalWebTone(item) === 'over' ? styles.attention : undefined}>
          {goalStatus(item, goalDeps)}
        </small>
      </span>
    </Link>
  );
  const goalStatusLine = goalCardStatusText(view.goals.items.length, view.goals.status, t, locale);
  const canCreateGoal = pocketParentCandidates(page.data.accounts).length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <PeriodHeader
          period={period}
          def={def}
          today={today}
          locale={locale}
          path="/home"
          status={
            period.isCurrent
              ? t('home.dayOf', { elapsed: period.elapsed, length: period.length })
              : t('home.closedCycle')
          }
          strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
        />
      </div>

      {/* Summary (H5) */}
      <section className={`${styles.box} ${styles.summary}`} aria-label={t('home.remaining')}>
        <div>
          <div className={styles.figure}>
            <span className={styles.label}>
              {period.isCurrent ? t('home.remaining') : t('home.leftover')}
            </span>
            <AmountText minor={view.summary.remaining} currency={currency} locale={locale} size="hero" />
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>{t('home.income')}</dt>
              <dd>
                <AmountText minor={view.summary.income} currency={currency} locale={locale} positive />
              </dd>
            </div>
            <div>
              <dt>{t('home.expenses')}</dt>
              <dd>
                <AmountText minor={view.summary.spent} currency={currency} locale={locale} />
              </dd>
            </div>
            <div>
              <dt>{t('home.vsUsual')}</dt>
              <dd className={delta === null ? styles.muted : delta > 0 ? styles.attention : styles.positive}>
                {delta === null ? '—' : formatMoney(delta, currency, locale, 'always')}
              </dd>
            </div>
          </dl>
        </div>
        {view.trend.current.length === 0 && view.trend.usual.length === 0 ? (
          <div className={styles.chartEmpty}>{t('stats.empty')}</div>
        ) : (
          <TrendScrub
            current={view.trend.current}
            usual={view.trend.usual}
            span={period.length}
            dates={dayDates}
            currentAmounts={view.trend.current.map((value) => money(value))}
            usualAmounts={view.trend.usual.map((value) => money(value))}
            strings={{
              label: t('stats.cycleTrend'),
              thisPeriod: t('home.trendThisPeriod'),
              usual: t('home.trendUsual'),
              spentBy: dayDates.map((date) => t('home.trendSpentBy', { date })),
              usualBy: dayDates.map((date) => t('home.trendUsualBy', { date })),
              hint: t('home.trendHint'),
            }}
          />
        )}
      </section>

      {/* Budget (H6) */}
      <section className={styles.box}>
        <div className={styles.blockHead}>
          <h2>{t('home.budget')}</h2>
          <span className={styles.meta}>{budgetStatusLine}</span>
          <Link className={styles.headLink} href="/profile/budgets">
            {t('targets.allBudgets')}
            <Icon name="chevR" size={15} />
          </Link>
        </div>
        {period.isCurrent && featured !== undefined && advice !== null && advice.kind !== 'closed' ? (
          <p className={styles.advice}>
            <b className={styles.strong}>{featured.budget.name}.</b> {adviceSentence(advice, featured)}
          </p>
        ) : null}
        {view.budgets.items.length === 0 ? (
          <EmptyState title={t('budgets.empty')} body={t('budgets.emptyBody')} />
        ) : (
          <div className={styles.rings}>{view.budgets.items.map(budgetTile)}</div>
        )}
        <Link className={styles.foot} href="/profile/budgets?new">
          <span>
            {t('home.unbudgeted')}{' '}
            <b className={styles.strong}>{money(view.budgets.unbudgeted)}</b>
          </span>
          <span className={styles.footAction}>{t('targets.createBudget')}</span>
        </Link>
      </section>

      {/* Transactions (H7, H8) */}
      <section className={styles.box}>
        <div className={styles.blockHead}>
          <h2>{t('tabs.transactions')}</h2>
          {showUpcoming ? (
            <span className={styles.meta}>
              {plural(t, locale, 'home.upcomingSummary', view.upcoming.count, {
                amount: formatMoney(view.upcoming.net, currency, locale, 'always'),
              })}
            </span>
          ) : null}
          <Link className={styles.headLink} href="/transactions">
            {t('home.allTransactions')}
            <Icon name="chevR" size={15} />
          </Link>
        </div>
        {view.recent.length === 0 && !showUpcoming ? (
          emptyTransactions
        ) : period.isCurrent ? (
          <div className={styles.halves}>
            <div>
              <span className={styles.group}>{t('home.latest')}</span>
              {view.recent.length === 0 ? emptyTransactions : view.recent.map((row) => txRow(row, false))}
            </div>
            {showUpcoming ? (
              <div>
                <span className={styles.group}>
                  {t('home.upcomingUntil', { date: formatDayMonth(period.range.end, locale) })}
                </span>
                {view.upcoming.rows.map((row) => txRow(row, true))}
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <span className={styles.group}>{t('home.latest')}</span>
            <div className={styles.halves}>
              <div>{view.recent.slice(0, HOME_ROWS).map((row) => txRow(row, false))}</div>
              <div>{view.recent.slice(HOME_ROWS).map((row) => txRow(row, false))}</div>
            </div>
          </div>
        )}
      </section>

      {/* Goals (H9) */}
      <section className={styles.box}>
        <div className={styles.blockHead}>
          <h2>{t('goals.title')}</h2>
          <span className={styles.meta}>{goalStatusLine}</span>
          <Link className={styles.headLink} href="/accounts">
            {t('goals.all')}
            <Icon name="chevR" size={15} />
          </Link>
        </div>
        {view.goals.items.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState title={t('goals.empty')} body={t('goals.emptyBody')} />
            {canCreateGoal ? (
              <Link className={styles.action} href={NEW_GOAL_HREF}>
                {t('goals.create')}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className={styles.goals}>{view.goals.items.map(goalRow)}</div>
        )}
      </section>
    </div>
  );
}
```

Note: `budgetRowFor` returns `label`, `pace`, `tone` and `colour` beside `row`, each taking the budget item; the old page already used them.

- [ ] **Step 2: Replace the CSS**

Replace the whole `apps/web/app/(app)/home/home.module.css` with:

```css
/* H4: one column, the blocks 16px apart. */
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head {
  display: flex;
  align-items: center;
  min-height: 56px;
}

/* H3: a plain card — `bg`, a 1px border, the card radius, no shadow. */
.box {
  padding: 24px;
  border-radius: var(--radius-card);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
}

.strong {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.muted {
  color: var(--color-text-muted);
}

.positive {
  color: var(--color-positive);
}

.attention {
  color: var(--color-accent);
}

/* ---- Summary --------------------------------------------------------------------------------- */
.summary {
  display: grid;
  gap: 28px;
}

.figure {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 24px;
}

.label {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  gap: 32px;
}

.stats dt {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.stats dd {
  margin-top: 2px;
  font-size: var(--font-size-headline);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.chartEmpty {
  display: grid;
  place-items: center;
  min-height: 170px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

/* ---- Block head ------------------------------------------------------------------------------ */
.blockHead {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.blockHead h2 {
  font-size: var(--font-size-headline);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-tight);
}

.meta {
  color: var(--color-text-muted);
}

.headLink {
  margin-inline-start: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-decoration: none;
}

@media (hover: hover) and (pointer: fine) {
  .headLink:hover {
    color: var(--color-text);
  }
}

/* ---- Budget ---------------------------------------------------------------------------------- */
.advice {
  margin: -4px 0 12px;
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.rings {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0 -10px;
}

.tile {
  padding: 12px 10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
  transition: background-color 120ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .tile:hover {
    background: var(--color-raised);
  }
}

.tileBody {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tileName {
  margin-top: 10px;
  font-weight: var(--font-weight-medium);
}

.tileValue,
.tileOver {
  font-size: var(--font-size-headline);
  font-weight: var(--font-weight-medium);
}

.tileOver {
  color: var(--color-accent);
}

.tileNote {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  margin-top: 8px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  text-decoration: none;
}

.footAction {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

/* ---- Transactions ---------------------------------------------------------------------------- */
.halves {
  display: grid;
  gap: 20px;
}

.group {
  display: block;
  padding-bottom: 6px;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

/* H7: a 44px row — date, icon in the category colour, title and category, amount. */
.row {
  display: grid;
  grid-template-columns: 52px 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
  transition: background-color 120ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .row:hover {
    background: var(--color-raised);
  }
}

.rowDate {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.rowIcon {
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
}

.rowText {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.rowText b {
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rowText > span {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  white-space: nowrap;
}

.rowRepeat {
  align-self: center;
  flex: none;
  color: var(--color-text-faint);
}

.rowUp .rowText b {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-regular);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.primaryAction,
.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-input);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: scale var(--motion-press) var(--motion-easing);
}

.primaryAction {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.action {
  border: 1px solid var(--color-border-strong);
  color: var(--color-text);
}

.primaryAction:active,
.action:active {
  scale: 0.97;
}

/* ---- Goals ----------------------------------------------------------------------------------- */
.goals {
  display: grid;
  gap: 8px 40px;
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
  transition: background-color 120ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .goal:hover {
    background: var(--color-raised);
  }
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

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .summary {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 40px;
    align-items: end;
  }

  .halves,
  .goals {
    grid-template-columns: 1fr 1fr;
    column-gap: 40px;
  }
}

@media (max-width: 759px) {
  .box {
    padding: 18px;
  }

  .rings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stats {
    gap: 16px;
  }

  .row {
    grid-template-columns: 44px 16px minmax(0, 1fr) auto;
    gap: 10px;
  }

  .rowText {
    flex-direction: column;
    gap: 0;
  }
}

@media (max-width: 360px) {
  .rowText > span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primaryAction:active,
  .action:active {
    scale: 1;
  }
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors. `--font-weight-regular` is the 400 weight of `fontWeight` in `tokens.ts`.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines. Run `rtk proxy pnpm exec biome check --write "apps/web/app/(app)/home"` if Biome only asks for formatting.

- [ ] **Step 4: Look at it**

Run: `rtk proxy pnpm --filter web dev`. Sign in with the seeded account and open `/home`.
Expected:
- The order is Summary, Budget, Transactions, Goals. Each block is a card with a 1px border and no shadow.
- The big figure has small faint cents. Income is green. “Vs usual” is in `accent` above the usual and green below.
- Move the pointer over the chart: a line, a dot and a tooltip follow it. Press <kbd>Tab</kbd> until the chart has the focus, then <kbd>←</kbd>, <kbd>→</kbd>, <kbd>Home</kbd> and <kbd>End</kbd>: the tooltip moves.
- Budget shows one ring per budget, one advice sentence with the budget name first, and the “Not budgeted” line at the bottom.
- Transactions shows “Latest” on the left and “Coming up” on the right, the nearest date first.
- Step back one period with ‹: “Coming up” goes and “Latest” shows 10 rows in two columns.
- Goals shows rows with a 40px ring in two columns.
- At 390px every block is one column, with the tab bar at the bottom.

- [ ] **Step 5: Commit**

```bash
rtk git add "apps/web/app/(app)/home/page.tsx" "apps/web/app/(app)/home/home.module.css"
rtk git commit -m "feat(web): the Home as one column of four blocks (H3–H9, H11, H12)"
```

---

### Task 8: The loading state of the Home

**Files:**
- Modify: `apps/web/app/(app)/home/loading.tsx`
- Create: `apps/web/app/(app)/home/loading.module.css`

H10: each block shows its shapes in `raised`, with no data. The shapes pulse to 50% opacity every 1.6s, and do not pulse with reduced motion. `SkeletonPending` keeps «Loading…» for a screen reader, as `PageSkeleton` does. `data-skeleton` stays, because `scripts/measure-nav.ts` looks for it.

- [ ] **Step 1: Replace `loading.tsx`**

Replace the whole `apps/web/app/(app)/home/loading.tsx` with:

```tsx
import { SkeletonPending } from '../../../src/ui/NavPending';
import styles from './loading.module.css';

/**
 * H10, Loading: the four blocks of the Home in their places, with shapes and no data. A change of
 * tab shows the shell and this at once, while the server renders the page.
 */
export default function Loading() {
  return (
    <div className={styles.page} aria-hidden="true" data-skeleton="">
      <div className={`${styles.sk} ${styles.title}`} />
      <div className={`${styles.box} ${styles.summary}`}>
        <div>
          <div className={`${styles.sk} ${styles.label}`} />
          <div className={`${styles.sk} ${styles.figure}`} />
          <div className={styles.stats}>
            <div className={`${styles.sk} ${styles.stat}`} />
            <div className={`${styles.sk} ${styles.stat}`} />
            <div className={`${styles.sk} ${styles.stat}`} />
          </div>
        </div>
        <div className={`${styles.sk} ${styles.chart}`} />
      </div>
      <div className={styles.box}>
        <div className={`${styles.sk} ${styles.label}`} />
        <div className={styles.rings}>
          <div className={`${styles.sk} ${styles.ring}`} />
          <div className={`${styles.sk} ${styles.ring}`} />
          <div className={`${styles.sk} ${styles.ring}`} />
          <div className={`${styles.sk} ${styles.ring}`} />
        </div>
      </div>
      <div className={styles.box}>
        <div className={`${styles.sk} ${styles.label}`} />
        <div className={`${styles.sk} ${styles.line}`} />
        <div className={`${styles.sk} ${styles.line}`} />
        <div className={`${styles.sk} ${styles.line}`} />
      </div>
      <div className={styles.box}>
        <div className={`${styles.sk} ${styles.label}`} />
        <div className={`${styles.sk} ${styles.line}`} />
      </div>
      <SkeletonPending />
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS**

Create `apps/web/app/(app)/home/loading.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.box {
  padding: 24px;
  border-radius: var(--radius-card);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary {
  display: grid;
  gap: 28px;
}

.sk {
  border-radius: 6px;
  background: var(--color-raised);
}

.title {
  width: 180px;
  height: 24px;
  margin: 16px 0;
}

.label {
  width: 96px;
  height: 14px;
}

.figure {
  width: min(260px, 100%);
  height: 56px;
  margin: 10px 0 24px;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.stat {
  width: 80px;
  height: 32px;
}

.chart {
  height: 170px;
}

.rings {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
}

.ring {
  width: 52px;
  height: 52px;
  border-radius: 50%;
}

.line {
  height: 20px;
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .summary {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    gap: 40px;
    align-items: end;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .sk {
    animation: pulse 1.6s ease-in-out infinite;
  }
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `rtk proxy pnpm --filter web typecheck` and `rtk proxy pnpm lint`
Expected: no errors, no `lint/…` lines.

- [ ] **Step 4: Commit**

```bash
rtk git add "apps/web/app/(app)/home/loading.tsx" "apps/web/app/(app)/home/loading.module.css"
rtk git commit -m "feat(web): the Home loads with the shapes of its four blocks (H10)"
```

---

### Task 9: End-to-end tests

**Files:**
- Modify: `apps/web/e2e/home-stats.spec.ts`

The budget tile no longer shows `targets.leftDetail` («left · {spent} spent of {limit}»). It shows `targets.spent` («{amount} spent») under what is left.

- [ ] **Step 1: Change the budget assertion**

In `apps/web/e2e/home-stats.spec.ts`, in the test `'the budgets and the goals are cards that carry the seeded figures'`, replace:

```ts
      // D5: every budget is a card; the line under the figure says what is spent of the limit.
      if (spentSoFar <= budget.amount) {
        await expect(
          page.getByText(
            t('targets.leftDetail', { spent: money(spentSoFar), limit: money(budget.amount) }),
            { exact: true },
          ),
        ).toHaveCount(1);
      }
```

with:

```ts
      // H6: every budget is a ring tile; under what is left, a line says what is spent.
      await expect(
        page.getByText(t('targets.spent', { amount: money(spentSoFar) }), { exact: true }).first(),
      ).toBeVisible();
```

Rename the test to `'the budgets and the goals carry the seeded figures'`.

- [ ] **Step 2: Look for tests that need the sidebar**

Run: `rtk grep -n "data-sidebar\|SideBar\|sidebar" apps/web/e2e`
Expected: no match. If a test opened a destination from the sidebar, open it from the top bar instead: `page.getByRole('navigation', { name: t('web.shell.mainNav') }).getByRole('link', { name })`.

- [ ] **Step 3: Add a test for the trend keys**

Append inside `test.describe('Home', …)` in `apps/web/e2e/home-stats.spec.ts`:

```ts
  test('the trend moves day by day with the arrow keys (H5)', async ({ browser, t }) => {
    const member = await createMember(browser, t, {
      name: 'Andamento',
      email: 'home-trend@e2e.test',
      seed: true,
    });
    const { page } = member;
    await page.goto('/home');
    const trend = page.getByRole('slider', { name: t('stats.cycleTrend') });
    await trend.focus();
    await page.keyboard.press('Home');
    await expect(trend).toHaveAttribute('aria-valuenow', '1');
    await page.keyboard.press('ArrowRight');
    await expect(trend).toHaveAttribute('aria-valuenow', '2');
    await page.keyboard.press('End');
    const last = await trend.getAttribute('aria-valuemax');
    await expect(trend).toHaveAttribute('aria-valuenow', last ?? '');
    await member.context.close();
  });
```

- [ ] **Step 4: Run the Home tests**

Run: `rtk proxy pnpm --filter web e2e -- home-stats.spec.ts`
Expected: every test in the file passes. If «In arrivo» checks an order, it now gets the nearest date first: change the expected list to `ahead.sort((a, b) => a.date.localeCompare(b.date))`.

- [ ] **Step 5: Run the whole suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes. A test that clicked a sidebar link fails here: fix it as in Step 2.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/e2e/home-stats.spec.ts
rtk git commit -m "test(web): the Home's budget tiles and the trend keys"
```

---

### Task 10: Roadmap and final checks

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Add the redesign to the roadmap**

In `docs/superpowers/plans/README.md`, before `### Notifications for future transactions`, add:

```markdown
### Web redesign — top bar, one column, new pages ◐ in progress

Specs: `specs/2026-10-20-web-home-redesign.html` (H1–H12) and `specs/2026-10-21-web-pages-redesign.html`
(W1–W12). Branch: `redesign/web`. Seven plans, each one ends with software that works:

- [x] **R1** — the top bar and the new Home (`plans/2026-10-21-web-redesign-r1-shell-home.md`).
- [ ] **R2** — the centred dialog, and the edit form opened from a transaction row (W1–W4).
- [ ] **R3** — Transactions (W5).
- [ ] **R4** — Statistics (W6–W8).
- [ ] **R5** — Accounts (W9).
- [ ] **R6** — Profile and Admin (W10).
- [ ] **R7** — empty states and the new `@saldo/core` functions (W11).

**Acceptance for R1:** no sidebar on any width; the top bar and the content share the 1040px column;
the Home shows Summary, Budget, Transactions and Goals in this order; the trend moves with the pointer
and with ← → Home End; «Coming up» shows the nearest date first; a closed period shows 10 latest rows.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck`
Expected: every package passes.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Check the other pages under the new shell**

Run: `rtk proxy pnpm --filter web dev` and open `/transactions`, `/stats`, `/accounts`, `/profile` and `/admin` at 1440px and at 390px.
Expected: each page is in the 1040px column under the top bar, and nothing overflows. Their own redesign is R3–R6. If a page overflows the column, fix it with a `min-width: 0` on the grid child that overflows, and note the fix in the commit.

- [ ] **Step 4: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R1 done"
```

---

## Self-review

- **Spec coverage.** H1 → Task 4. H2 → Tasks 1 and 4. H3 → Task 7 (`.box`). H4 → Task 7 (order of the sections). H5 → Tasks 5, 6, 7. H6 → Task 7 (rings, one advice, foot line; D5 kept). H7 → Tasks 3 and 7. H8 → Tasks 3 and 7. H9 → Task 7. H10 → Task 7 (empty per block, closed period) and Task 8 (loading). H11 → Task 7 uses no chips, no dots, no entrance motion. H12 → `TargetRing` keeps `--color-bar-grey`. Open item 5 (Search) → not shown, noted above. Open item D10 → R6.
- **Placeholders.** None: every code step has its code; the two «if» notes give the exact fallback.
- **Names.** `HOME_ROWS_CLOSED`, `TrendScrub`, `targets.spent`, `home.vsUsual`, `home.trend*` are the same in every task.
