# Web: the G2 redesign — sidebar, dialog panels, Home and the other pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The web app gets the layout that the user approved on 2026-10-11. A sidebar replaces the top bar. Every detail panel is a dialog over the page with a scrim. Home is «G2». Transazioni, Statistiche, Conti, Profilo and Admin follow «K · Scelta».

**Architecture:** The plan has nine parts, A to I. Do them in this order, because each part uses the components of the parts before it. Part A changes the shell and the brand. Part B turns `Panel` into a dialog. Part C adds the shared components (cards, page head, chart frame). Parts D–H change one page each. Part I updates the docs and the end-to-end tests. Pages stay server components. Every figure still comes from `@saldo/core` or from a view in `src/features/`. Only two new rules enter the code: `unbudgetedSpend` in `@saldo/core` and `homeTrend` in `src/features/home/`. Both have tests first.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2, CSS Modules, `@saldo/ui` tokens, `@saldo/i18n`, Vitest, Playwright.

**Design sources (open them before you start a part):**

- Home: `docs/superpowers/mockups/2026-10-11-web-home-polish-variants.html?variant=G2`
- The other pages: `docs/superpowers/mockups/2026-10-11-web-pages-g2-variants.html?variant=K&page=tx|stats|conti|profilo|admin`. Add `&open=1` to see the panel open.

Serve the repository root to open them with the fonts and the logo: `python3 -m http.server 8765` from the repository root, then open `http://localhost:8765/docs/superpowers/mockups/…`.

---

## Why this plan exists

On 2026-10-11 the user approved the Home «G2». Then they chose one part of each variant for the other pages («K · Scelta»). Then they asked for two more changes: the panels must not move the page, and the app needs its logo. These decisions change §17.1.7 of the POC spec. They also change two earlier decisions:

- `docs/superpowers/specs/2026-10-07-web-panel-feel.html` puts the panel **beside** the list.
- `docs/superpowers/plans/2026-10-11-web-navigation-feel.md` says «Do not use dialogs».

Both are replaced by decision D3 below. Task 24 records the decisions in a new HTML spec, so that the next agent does not follow the old ones.

## Decisions (made by the user on 2026-10-11, unless the line says «plan»)

| # | Decision |
| --- | --- |
| D1 | At and above 1024px, a sidebar of 232px replaces the top bar. It holds the logo, the five destinations, «Nuova transazione» and the profile link. Below 1024px, the top bar and the tab bar stay as they are. |
| D2 | The brand mark is Rocky, the app icon, cut to his head and coin. The tile is 32px, `raised`, radius `icon-box`. The cut edge is on purpose (the mascot peeks from an edge, D26). |
| D3 | A detail panel is a **dialog over the page**, with the scrim under it. The page does not move or change its layout. The dialog is 420px (`--layout-panel-width`), full height with 16px of margin, at the trailing edge. It closes with ✕, a click on the scrim or Esc. This applies to every panel: Transazioni, Statistiche, Conti, Profilo and Admin. Below 1024px, nothing changes (full screen, or a bottom sheet for a form). |
| D4 | Home is «G2»: head (period with the stepper beside the title, «Rimasto da spendere» at 56px, Entrate and Uscite under it, «Andamento del periodo» on the right), then three sections in a column: Transazioni (Ultime 7/12 and In arrivo 5/12), Budget (cards, 3 per row), Obiettivi (cards). |
| D5 | The big figure of a budget card is **what is left**, not what is spent. The line under it says what is spent of the limit. This is the web only. The phone keeps §5.13 as it is. |
| D6 | Home shows a «Non a budget» card after the budgets: the spend of the period in categories that no budget covers. `@saldo/core` computes it (`unbudgetedSpend`). |
| D7 | Transazioni: three cards at the top (Uscite with the pace bar, Entrate, In arrivo with the next rows), then the search, the chips and the days. |
| D8 | Statistiche: the head of Home (Uscite at 56px, Entrate, Netto, Proiezione, «Andamento del periodo» on the right), then Flussi across the page, then Ripartizione as cards. A category card opens a panel with the category: its figure, its last periods and its transactions. Then Tag. |
| D9 | Conti: the head of Home (Patrimonio complessivo at 56px, Totale spendibile, a sparkline of the net worth on the right), then the accounts and the goals as cards. A card opens the panel of the account or of the goal. «Nuovo conto» is the last card. |
| D10 | Profilo and Admin: at and above 1024px, their sub-navigation **takes the place of the sidebar**, with «‹ Saldo» at the top to go back. There is never a second sidebar. Below 1024px, the sub-navigation stays a row of links. |
| D11 | Polish from the G2 review (better-ui): press `scale(0.96)` in 120ms on cards, open rows and nav links; hover of a nav link = `raised` at 60%, current = `raised` at 100%; the hover of a card adds a shadow and keeps the border; the focus ring follows the element's own radius; legends under a bar are 13px. |
| D12 | (plan) Transazioni keeps the «In arrivo» disclosure in the list (§5.12, and `ListKeys` walks it). The In arrivo card shows the count, the total and the next three rows. The mockup had no disclosure, but it had only two upcoming rows. |
| D13 | (plan) The panel is `role="dialog"` with `aria-modal="true"`. The focus goes into it when it opens and Tab stays inside it. The end-to-end tests that look for `complementary` change to `dialog`. |

## Rules for every task

- **Gates.** Read the output, not the exit code (AGENTS.md «Reading the results»). Run `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck` and `rtk proxy pnpm test`. A clean lint has **no** `lint/…` lines and no `× Some errors were emitted while running checks.`
- To test one package, run `rtk proxy pnpm --filter web test <pattern>` or `rtk proxy pnpm --filter @saldo/core test <pattern>`.
- Before each commit, fix the format: `pnpm exec biome check --write <files>`.
- Port 3000 belongs to another project. Start Saldo on port 3100: `PUBLIC_URL=http://localhost:3100 pnpm --filter web build`, then `cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next start -p 3100`. For a quick look, `cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next dev -p 3100` is enough.
- **No hard-coded strings, colours, radii or font sizes.** Every new string goes into `packages/i18n/src/locales/it.ts` **and** `en.ts` (Task 2). Every colour, radius and size is a token.
- Work on the branch `phase/web-g2-redesign`. Commit after each task with the message that the task gives.
- When you finish a part, open the page at 1440×900 in both themes and compare it with the mockup. Write what is different in the commit body.

## Files

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/ui/src/tokens.ts` | modify | `layout.sidebarWidth = 232` |
| `packages/core/src/budgets.ts`, `budgets.test.ts` | modify | `unbudgetedSpend` (D6) |
| `packages/i18n/src/locales/it.ts`, `en.ts` | modify | the new strings |
| `apps/web/public/brand/rocky-mark.png` | create | the brand mark (D2) |
| `apps/web/src/ui/Brand.tsx`, `Brand.module.css` | modify | Rocky in the tile |
| `apps/web/src/ui/SideBar.tsx`, `SideBar.module.css` | create | the sidebar (D1) |
| `apps/web/src/ui/ProfileLink.tsx`, `ProfileLink.module.css` | create | avatar + name, current on `/profile` |
| `apps/web/src/ui/NavLink.module.css` | modify | D11 states; full width in a sidebar |
| `apps/web/src/ui/TopBar.module.css` | modify | hidden at and above 1024px |
| `apps/web/app/(app)/layout.tsx`, `shell.module.css` | modify | sidebar + main column |
| `apps/web/src/ui/Panel.tsx`, `Panel.module.css` | modify | the dialog (D3, D13) |
| `apps/web/src/ui/PanelSwitch.module.css`, `SubnavLayout.tsx`, `SubnavLayout.module.css` | modify | no panel column; the section sidebar (D10) |
| `apps/web/app/(app)/transactions/transactions.module.css`, `TransactionsPanels.tsx` | modify | no panel column |
| `apps/web/app/(app)/accounts/accounts.module.css` | modify | no panel column |
| `apps/web/src/ui/Card.tsx`, `Card.module.css` | create | the §5.13 card and its grid |
| `apps/web/src/ui/PageHead.tsx`, `PageHead.module.css` | create | the 7/5 head of Home, Statistiche and Conti |
| `apps/web/src/ui/charts/ChartFrame.tsx`, `ChartFrame.module.css` | create | a chart's title row, figure and foot |
| `apps/web/src/ui/charts/TrendChart.tsx`, `Sparkline.tsx` | modify | a `height` prop |
| `apps/web/src/ui/PeriodHeader.tsx`, `PeriodHeader.module.css` | modify | the stepper beside the title |
| `apps/web/src/ui/ListRow.module.css` | modify | press scale on open rows (D11) |
| `apps/web/src/features/home/trend.ts`, `trend.test.ts` | create | `homeTrend` |
| `apps/web/src/features/home/homeView.ts` | modify | `trend`, `unbudgeted`, budget advice per item |
| `apps/web/app/(app)/home/page.tsx`, `home.module.css` | modify | Home G2 (D4–D6) |
| `apps/web/app/(app)/transactions/page.tsx` | modify | D7, D12 |
| `apps/web/src/features/stats/statsView.ts`, `statsView.test.ts` | modify | `SplitRow.history` |
| `apps/web/app/(app)/stats/page.tsx`, `stats.module.css` | modify | D8 |
| `apps/web/app/(app)/accounts/page.tsx` | modify | D9 |
| `apps/web/src/ui/HeroBand.tsx`, `HeroBand.module.css` | modify | keep `HeroFigure`, delete `HeroBand` |
| `apps/web/app/(app)/profile/layout.tsx`, `profile.module.css`, `admin/layout.tsx`, `admin.module.css` | modify | D10 |
| `apps/web/e2e/*.spec.ts` | modify | `complementary` → `dialog`; the layout assertion |
| `docs/superpowers/specs/2026-10-11-web-g2-layout.html` | create | the record of D1–D13 |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | modify | §17.1.7 points to the new spec |
| `docs/superpowers/plans/README.md` | modify | the roadmap entry |

---

# Part A — Shell and brand

### Task 1: The sidebar width token

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `layout` object, after `subnavWidth`)

- [x] **Step 1: Add the token**

In `packages/ui/src/tokens.ts`, after the line `subnavWidth: 200,` add:

```ts
  /** Web: the sidebar that replaces the top bar at and above `wideBreakpoint` (G2, 2026-10-11). */
  sidebarWidth: 232,
```

`tokensCss()` emits it as `--layout-sidebar-width`.

- [x] **Step 2: Check that the variable is emitted**

Run: `cd packages/ui && node --input-type=module -e "import('./src/css.ts').then(m=>console.log(m.tokensCss().includes('--layout-sidebar-width: 232px')))"`

If Node cannot load TypeScript directly, run `rtk proxy pnpm --filter @saldo/ui test` instead and then `grep -rn "sidebar-width" apps/web/.next 2>/dev/null | head -1` after the next build. Expected: `true`, or one match.

- [x] **Step 3: Commit**

```bash
git add packages/ui/src/tokens.ts
git commit -m "feat(ui): sidebar width token for the web shell"
```

### Task 2: The new strings

**Files:**
- Modify: `packages/i18n/src/locales/it.ts`, `packages/i18n/src/locales/en.ts`

Add every key below to **both** files, in the namespace that the key names. Keep the order of the keys around them. The parity test fails if one file misses a key.

- [x] **Step 1: Add the Italian strings**

In `it.ts`:

```ts
// web.shell (after `nextPeriod`)
      back: 'Saldo',
      backLabel: 'Torna a Saldo',

// home (after `vsUsualBelow`)
    latest: 'Ultime',
    upcomingUntil: 'In arrivo · entro il {{date}}',
    upcomingSummary_one: '{{count}} in arrivo · {{amount}}',
    upcomingSummary_other: '{{count}} in arrivo · {{amount}}',
    unbudgeted: 'Non a budget',
    unbudgetedNote: 'spesi in categorie senza budget',

// targets (after `itemLabel`)
    leftDetail: 'rimasti · {{spent}} spesi di {{limit}}',

// stats (after `belowMedian`)
    vsUsual: '{{delta}} sul solito',
    lastPeriods_one: 'Ultimo periodo',
    lastPeriods_other: 'Ultimi {{count}} periodi',

// accounts (after `toRepay`)
    periodDelta: '{{amount}} in questo periodo',
    netWorthTrend_one: 'Patrimonio · ultimo mese',
    netWorthTrend_other: 'Patrimonio · ultimi {{count}} mesi',
    newAccountBody: 'Un conto corrente, una carta, un deposito o i contanti.',
```

- [x] **Step 2: Add the English strings**

In `en.ts`, in the same places:

```ts
// web.shell
      back: 'Saldo',
      backLabel: 'Back to Saldo',

// home
    latest: 'Latest',
    upcomingUntil: 'Coming up · by {{date}}',
    upcomingSummary_one: '{{count}} coming up · {{amount}}',
    upcomingSummary_other: '{{count}} coming up · {{amount}}',
    unbudgeted: 'Not budgeted',
    unbudgetedNote: 'spent in categories with no budget',

// targets
    leftDetail: 'left · {{spent}} spent of {{limit}}',

// stats
    vsUsual: '{{delta}} vs usual',
    lastPeriods_one: 'Last period',
    lastPeriods_other: 'Last {{count}} periods',

// accounts
    periodDelta: '{{amount}} this period',
    netWorthTrend_one: 'Net worth · last month',
    netWorthTrend_other: 'Net worth · last {{count}} months',
    newAccountBody: 'A current account, a card, a deposit or cash.',
```

The comments above only say where each block goes. Do not paste them.

- [x] **Step 3: Run the i18n tests**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS (the parity test included).

- [x] **Step 4: Commit**

```bash
git add packages/i18n/src/locales/it.ts packages/i18n/src/locales/en.ts
git commit -m "feat(i18n): strings for the G2 web pages"
```

### Task 3: Rocky as the brand mark

**Files:**
- Create: `apps/web/public/brand/rocky-mark.png`
- Modify: `apps/web/src/ui/Brand.tsx`, `apps/web/src/ui/Brand.module.css`

- [x] **Step 1: Cut the mark from the app icon**

The source is `apps/mobile/assets/ios-icon-dark.png` (1024×1024, transparent). The box below is the one the mockup shows in its 32px tile. Run from the repository root:

```bash
mkdir -p apps/web/public/brand
python3 -I - <<'EOF'
from PIL import Image
src = Image.open('apps/mobile/assets/ios-icon-dark.png').convert('RGBA')
# The mockup: background-size 72px, position -20px -9px, in a 32px tile.
scale = 72 / 1024
box = (round(20 / scale), round(9 / scale), round(52 / scale), round(41 / scale))
src.crop(box).resize((64, 64), Image.LANCZOS).save('apps/web/public/brand/rocky-mark.png', optimize=True)
print(box)
EOF
```

Expected output: `(284, 128, 740, 583)`. The file is 64×64 (2× for a 32px tile) and smaller than 10 KB. If Pillow is not installed, run `python3 -m pip install --user pillow` first.

- [x] **Step 2: Look at it**

Open `apps/web/public/brand/rocky-mark.png`. Expected: Rocky's ears, coin, mask and muzzle; the bottom edge cuts his body; no part of the tail shows.

- [x] **Step 3: Use it in `Brand`**

In `apps/web/src/ui/Brand.tsx`, replace `<span className={styles.mark}>S</span>` with:

```tsx
      {/* Rocky, cut to his head (D2): a 64px PNG drawn at 32px. Decorative: «Saldo» follows. */}
      <span className={styles.mark} aria-hidden="true" />
```

In `apps/web/src/ui/Brand.module.css`, replace the whole `.mark` rule with:

```css
/* The app icon's Rocky on transparent, over `raised`: it reads in both themes (D2). */
.mark {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-icon-box);
  background: url("/brand/rocky-mark.png") center / 100% 100% no-repeat, var(--color-raised);
}
```

- [x] **Step 4: Check the sign-in page**

`Brand` is also on `/login`. Start the dev server (see «Rules») and open `http://localhost:3100/login`. Expected: Rocky in a 32px tile, then «Saldo». The 96px Rocky above it stays.

- [x] **Step 5: Commit**

```bash
git add apps/web/public/brand/rocky-mark.png apps/web/src/ui/Brand.tsx apps/web/src/ui/Brand.module.css
git commit -m "feat(web): Rocky is the brand mark"
```

### Task 4: `ProfileLink` and the nav link states

**Files:**
- Create: `apps/web/src/ui/ProfileLink.tsx`, `apps/web/src/ui/ProfileLink.module.css`
- Modify: `apps/web/src/ui/NavLink.module.css`

- [x] **Step 1: Write `ProfileLink`**

`apps/web/src/ui/ProfileLink.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { isCurrent } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { initials } from './initials';
import styles from './ProfileLink.module.css';

/**
 * The sidebar's foot (D1): the person's initials and name, a link to Profilo. Current while
 * Profilo is the page, as a nav link is. A client component for `usePathname()`, as `Avatar` is.
 */
export function ProfileLink({ name, label }: { name: string; label: string }) {
  const current = isCurrent('/profile', usePathname());
  return (
    <Link
      className={styles.link}
      href="/profile"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
    >
      <span className={styles.avatar} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={styles.name} aria-hidden="true">
        {name}
      </span>
    </Link>
  );
}
```

`apps/web/src/ui/ProfileLink.module.css`:

```css
.link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: var(--radius-input);
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  text-decoration: none;
  transition-property: scale, background-color, color;
  transition-duration: var(--motion-press);
  transition-timing-function: var(--motion-easing);
}

.link:hover:not([aria-current]) {
  background: color-mix(in srgb, var(--color-raised) 60%, transparent);
  color: var(--color-text);
}

.link[aria-current="page"] {
  background: var(--color-raised);
  color: var(--color-text);
}

.link:active {
  scale: 0.96;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  color: var(--color-text);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

/* On the current page the link is `raised`: the avatar steps back to the page colour. */
.link[aria-current="page"] .avatar {
  background: var(--color-bg);
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .link:active {
    scale: 1;
  }
}
```

- [x] **Step 2: Give `NavLink` the G2 states (D11)**

In `apps/web/src/ui/NavLink.module.css`, replace the `.link`, `.link:hover` and `.link[aria-current="page"]` rules with:

```css
.link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--layout-nav-item-height);
  padding: 0 12px;
  border-radius: var(--radius-input);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--font-size-body);
  letter-spacing: var(--tracking-tight);
  transition-property: scale, background-color, color;
  transition-duration: var(--motion-press);
  transition-timing-function: var(--motion-easing);
}

.link:hover {
  color: var(--color-text);
}

/* Hover ≠ current: the same surface at 60%, so the two states are one family at two strengths. */
.link:hover:not([aria-current]) {
  background: color-mix(in srgb, var(--color-raised) 60%, transparent);
}

.link[aria-current="page"] {
  color: var(--color-text);
  background: var(--color-raised);
}

.link:active {
  scale: 0.96;
}

@media (prefers-reduced-motion: reduce) {
  .link:active {
    scale: 1;
  }
}
```

Keep `.icon` and `.count`. Change the colour of `.count` from `--color-text-faint` to `--color-text-muted` (a 13px faint label does not pass AA).

- [x] **Step 3: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/ui/ProfileLink.tsx apps/web/src/ui/ProfileLink.module.css apps/web/src/ui/NavLink.module.css
git commit -m "feat(web): profile link and the G2 states of a nav link"
```

### Task 5: The sidebar

**Files:**
- Create: `apps/web/src/ui/SideBar.tsx`, `apps/web/src/ui/SideBar.module.css`

- [x] **Step 1: Write the component**

`apps/web/src/ui/SideBar.tsx`:

```tsx
import type { IconName } from '@saldo/ui';
import type { NavItem } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { NavLink } from './NavLink';
import { NewTransactionLink } from './NewTransactionLink';
import { ProfileLink } from './ProfileLink';
import styles from './SideBar.module.css';

interface Props {
  items: (NavItem & { label: string })[];
  user: { name: string };
  strings: {
    /** The same name as the top bar's landmark: only one of the two shows at a width. */
    label: string;
    newTransaction: string;
    profile: string;
  };
}

/**
 * D1: the wide screen's navigation. The brand, the five destinations in one column, and at the
 * foot «Nuova transazione» and the person. `data-sidebar` lets Profilo and Admin hide it while
 * their own sub-navigation takes its place (D10).
 */
export function SideBar({ items, user, strings }: Props) {
  return (
    <div className={styles.bar} data-sidebar="">
      <Link className={styles.brand} href="/home">
        <Brand />
      </Link>
      <nav aria-label={strings.label}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key}>
              <NavLink href={item.href} icon={item.icon as IconName} label={item.label} />
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.foot}>
        {/* Decision 8: the form on Transazioni, from any page; `N` does the same (`Shortcuts`). */}
        <NewTransactionLink className={styles.new} aria-keyshortcuts="n">
          <Icon name="plus" size={16} />
          {strings.newTransaction}
          <span aria-hidden="true">
            <kbd className={styles.kbd}>N</kbd>
          </span>
        </NewTransactionLink>
        <ProfileLink name={user.name} label={strings.profile} />
      </div>
    </div>
  );
}
```

`apps/web/src/ui/SideBar.module.css`:

```css
/* Narrow first: below the breakpoint the top bar and the tab bar navigate, so the sidebar is not there. */
.bar {
  display: none;
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .bar {
    position: sticky;
    top: 0;
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 24px;
    inline-size: var(--layout-sidebar-width);
    block-size: 100dvh;
    padding: 20px 16px;
    border-inline-end: 1px solid var(--color-border);
    background: var(--color-surface);
  }
}

.brand {
  padding: 6px 10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A nav link fills the column, so its hover and current surfaces are the column's width. */
.list a {
  display: flex;
  width: 100%;
  padding: 0 10px;
}

.foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: var(--radius-button);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  text-decoration: none;
  transition: scale var(--motion-press) var(--motion-easing);
}

.new:active {
  scale: 0.96;
}

/* The ring follows the button's radius: 12px, plus the 2px offset outside it. */
.new:focus-visible {
  border-radius: var(--radius-button);
}

.kbd {
  font: inherit;
  font-size: var(--font-size-caption);
  border: 1px solid currentColor;
  border-radius: var(--radius-icon-box);
  padding: 0 5px;
  opacity: 0.55;
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .new:active {
    scale: 1;
  }
}
```

- [x] **Step 2: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add apps/web/src/ui/SideBar.tsx apps/web/src/ui/SideBar.module.css
git commit -m "feat(web): the sidebar of the wide screen"
```

### Task 6: The shell uses the sidebar

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/shell.module.css`, `apps/web/src/ui/TopBar.module.css`

- [x] **Step 1: Render the sidebar beside the content**

In `apps/web/app/(app)/layout.tsx`, import `SideBar` (`import { SideBar } from '../../src/ui/SideBar';`). Replace the JSX inside `<div className={styles.shell}>` with:

```tsx
        <a className={styles.skip} href="#content">
          {t('web.shell.skipToContent')}
        </a>
        <SideBar
          items={items}
          user={{ name: user.displayName }}
          strings={{
            label: t('web.shell.mainNav'),
            newTransaction: t('web.shell.newTransaction'),
            profile: t('profile.title'),
          }}
        />
        <div className={styles.column}>
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
        </div>
        <TabBar
          items={items.filter((item) => item.trailing !== true)}
          label={t('web.shell.sectionNav')}
          newTransaction={t('web.shell.newTransaction')}
        />
        <Shortcuts />
```

Change the doc comment of `AppLayout` to: `§17.1.7 and D1 (2026-10-11): a sidebar on wide screens; the top bar and the phone's tab bar on narrow ones. All are rendered; CSS picks.`

- [x] **Step 2: Lay out the shell**

Replace the whole `apps/web/app/(app)/shell.module.css` with:

```css
.shell {
  min-height: 100dvh;
  background: var(--color-bg);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
}

.column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  width: 100%;
  max-width: calc(var(--layout-content-wide) + 2 * var(--layout-page-padding-web));
  margin: 0 auto;
  padding: 24px var(--layout-screen-padding-x) calc(var(--layout-tab-bar-height) + 24px);
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .shell {
    flex-direction: row;
  }

  /* Beside the sidebar the content starts at its edge, as in the mockup: not centred in the rest. */
  .content {
    margin: 0;
    padding: 40px var(--layout-page-padding-web) 64px;
  }

  /*
   * D10: Profilo and Admin put their own sub-navigation where the sidebar is. The sidebar keeps its
   * width (so the content does not move) and leaves the accessibility tree (`visibility`).
   */
  .shell:has([data-section-nav]) :global([data-sidebar]) {
    visibility: hidden;
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

- [x] **Step 3: Hide the top bar on wide screens**

In `apps/web/src/ui/TopBar.module.css`, replace the whole `@media (min-width: 1024px)` block at the end with:

```css
/* `--layout-wide-breakpoint` (1024): the sidebar navigates there (D1), so the bar is not drawn. */
@media (min-width: 1024px) {
  .bar {
    display: none;
  }
}
```

Then delete the rules that only the wide screen used: `.sections`, `.new`, `.new:active` and `.kbd`. In `TopBar.tsx`, delete the `<ul className={styles.sections}>…</ul>` block and the `<NewTransactionLink …>…</NewTransactionLink>` block, and the imports that are no longer used (`Icon`, `NewTransactionLink`). Change the comment of `TopBar` to: `Narrow screens only (D1): the brand, Admin as an icon and the avatar. The tab bar carries the sections and the FAB.`

- [x] **Step 4: Run the gates**

Run: `rtk proxy pnpm --filter web typecheck` and `rtk proxy pnpm lint`
Expected: no errors; no `lint/…` lines.

- [x] **Step 5: Look at it**

Start the dev server. Open `/home` at 1440×900 and at 390×844, in both themes. Expected at 1440: the sidebar on the left (Rocky, «Saldo», five links, the button, the person), no top bar. Expected at 390: the top bar and the tab bar as before, no sidebar.

- [x] **Step 6: Commit**

```bash
git add "apps/web/app/(app)/layout.tsx" "apps/web/app/(app)/shell.module.css" apps/web/src/ui/TopBar.tsx apps/web/src/ui/TopBar.module.css
git commit -m "feat(web): the sidebar replaces the top bar on wide screens"
```

---

# Part B — The panel is a dialog

### Task 7: `Panel` as a modal dialog

**Files:**
- Modify: `apps/web/src/ui/Panel.tsx`, `apps/web/src/ui/Panel.module.css`

- [x] **Step 1: Change the element, the scrim and the focus**

In `apps/web/src/ui/Panel.tsx`:

1. Delete the constant `NARROW` and its comment.
2. Add `const dialog = useRef<HTMLDivElement>(null);` after `const heading = useRef<HTMLHeadingElement>(null);`.
3. Replace the focus effect (the one that starts with `// Full-screen, the panel covers the list…`) with:

```tsx
  // D3: the panel is a modal dialog at every width, so the focus moves into it. Unless something
  // inside already took it: a form that opens on its first field (the form's focus effect, which
  // runs first: child effects precede the parent's).
  useEffect(() => {
    if (dialog.current?.contains(document.activeElement) === true) return;
    heading.current?.focus();
  }, []);

  // D13: Tab and Shift+Tab stay inside the dialog while it is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const root = dialog.current;
      if (event.key !== 'Tab' || root === null) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0,
      );
      const first = items.at(0);
      const last = items.at(-1);
      if (first === undefined || last === undefined) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
```

4. Above `interface Props`, add:

```tsx
/** What Tab can reach inside the dialog. */
const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
```

5. In the returned JSX, render the scrim **always** (D3). Replace `{sheet ? ( <Link className={styles.scrim} … /> ) : null}` with the `<Link className={styles.scrim} … />` element alone, unchanged. Change its comment to: `The scrim closes as the ✕ does; it is not a second control, so it stays out of the tab order.`
6. Replace the `<aside …>` opening tag and its closing `</aside>` with:

```tsx
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        className={styles.panel}
        aria-label={title}
        data-closing={closing ? '' : undefined}
        data-instant={instant ? '' : undefined}
        data-still={enteredInstantly ? '' : undefined}
        data-sheet={sheet ? '' : undefined}
      >
```

and `</div>`.

7. Update the doc comment of `Panel`: replace `420px beside the list on a wide screen, the whole screen on a narrow one` with `a 420px dialog over the page, with a scrim, on a wide screen (D3, 2026-10-11); the whole screen, or a bottom sheet for a form, on a narrow one`.

- [x] **Step 2: Replace the CSS**

Replace the whole `apps/web/src/ui/Panel.module.css` with:

```css
/**
 * Below the breakpoint the panel is the screen (§17.1.7), or a bottom sheet for a form. At and
 * above it, the panel is a dialog over the page with a scrim under it (D3, 2026-10-11): the page
 * does not move. Panel and scrim arrive and leave together; the panel along the trailing edge.
 */
.panel {
  position: fixed;
  inset: 0;
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px var(--layout-screen-padding-x) calc(var(--layout-tab-bar-height) + 24px);
  overflow-y: auto;
  background: var(--color-bg);
  animation: panel-in 200ms cubic-bezier(0.2, 0, 0, 1);
  transition-property: opacity, translate;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}

.panel[data-closing] {
  opacity: 0;
  translate: 0 16px;
}

@keyframes panel-in {
  from {
    opacity: 0;
    translate: 0 16px;
  }
}

@keyframes panel-in-wide {
  from {
    opacity: 0;
    translate: 12px 0;
  }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  min-width: 0;
  overflow-wrap: anywhere;
}

.close {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: var(--layout-header-button);
  block-size: var(--layout-header-button);
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
}

.close:hover {
  background: var(--color-raised);
  color: var(--color-text);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 4px;
}

/* Focus lands here; the heading is not a control, so it draws no ring. */
.title:focus {
  outline: none;
}

/* A panel whose body opens with its own heading: the ✕ alone on the head, no rule under it. */
.bare {
  justify-content: flex-end;
  padding-bottom: 0;
  border-bottom: 0;
}

.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Narrow: a form rises from the bottom over the scrim, the mockup's `.sheet`. */
.panel[data-sheet] {
  inset: auto 0 0;
  max-block-size: 92dvh;
  padding: 8px var(--layout-screen-padding-x) calc(32px + env(safe-area-inset-bottom));
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--color-surface);
  animation: sheet-in var(--motion-sheet) var(--motion-easing);
}

.panel[data-sheet][data-closing] {
  opacity: 1;
  translate: 0 100%;
}

@keyframes sheet-in {
  from {
    translate: 0 100%;
  }
}

.handle {
  flex: none;
  inline-size: var(--layout-sheet-handle-width);
  block-size: var(--layout-sheet-handle-height);
  margin: 0 auto;
  border-radius: var(--radius-pill);
  background: var(--color-border-strong);
}

.scrim {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: var(--color-scrim);
  animation: scrim-in 200ms cubic-bezier(0.2, 0, 0, 1);
  transition: opacity 150ms cubic-bezier(0.23, 1, 0.32, 1);
}

.scrim[data-closing] {
  opacity: 0;
  pointer-events: none;
}

@keyframes scrim-in {
  from {
    opacity: 0;
  }
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .panel,
  .panel[data-sheet] {
    inset: 16px 16px 16px auto;
    inline-size: var(--layout-panel-width);
    max-block-size: none;
    gap: 0;
    padding: 0;
    overflow: hidden;
    border-radius: var(--radius-dialog);
    background: var(--color-surface);
    box-shadow:
      0 0 0 1px var(--color-border-strong) inset,
      0 1px 2px var(--color-shadow),
      0 12px 32px color-mix(in srgb, var(--color-shadow) 60%, transparent);
    animation: panel-in-wide 200ms cubic-bezier(0.2, 0, 0, 1);
  }

  .panel[data-closing],
  .panel[data-sheet][data-closing] {
    opacity: 0;
    translate: 12px 0;
  }

  .head {
    padding: 12px 12px 12px 22px;
  }

  .bare {
    padding-bottom: 12px;
  }

  .title {
    font-size: var(--font-size-headline);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--tracking-tight);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    gap: 24px;
    padding: 24px 22px;
  }

  .handle {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel,
  .panel[data-sheet] {
    animation-name: panel-fade;
    transition-property: opacity;
  }

  .panel[data-closing],
  .panel[data-sheet][data-closing] {
    translate: none;
  }
}

@keyframes panel-fade {
  from {
    opacity: 0;
  }
}

/* Opened from the keyboard: there on the next frame. Latched each time the panel shows. */
.panel[data-still],
.scrim[data-still] {
  animation: none;
}

/* Closed from the keyboard: gone on the next frame. */
.panel[data-instant],
.scrim[data-instant] {
  transition: none;
}
```

- [x] **Step 3: Find other code that looks for the `aside`**

Run: `grep -rn "'aside'\|\"aside\"\|> aside\|aside\[" apps/web/src apps/web/app`
For each match, use `[role="dialog"]` instead of `aside`. Known match: `transactions.module.css` has `.side > aside`. Task 8 deletes that rule.

- [x] **Step 4: Run the unit tests**

Run: `rtk proxy pnpm --filter web test`
Expected: PASS. If `panelView.test.ts` or `panelUrl.test.ts` fails, read the failure: they do not read the element type, so a failure is a real regression.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/ui/Panel.tsx apps/web/src/ui/Panel.module.css
git commit -m "feat(web): the panel is a dialog over the page with a scrim"
```

### Task 8: No page keeps a column for the panel

**Files:**
- Modify: `apps/web/app/(app)/transactions/transactions.module.css`, `apps/web/app/(app)/transactions/TransactionsPanels.tsx`, `apps/web/app/(app)/accounts/accounts.module.css`, `apps/web/src/ui/PanelSwitch.module.css`, `apps/web/src/ui/SubnavLayout.module.css`, `apps/web/app/(app)/stats/stats.module.css`

- [x] **Step 1: Transazioni**

In `transactions.module.css`:

1. Replace the `.layout` rule and the whole first `@media (min-width: 1024px)` block (the one with `grid-template-columns: minmax(0, 1fr) 0`) with:

```css
/* D3: the panel is a dialog over the page, so the list keeps its width whatever is open. */
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--layout-section-gap-web);
}
```

2. Delete the second `@media (min-width: 1024px)` block (the one with `.side { display: flex; … }` and `.side > aside`). Keep `.side { display: contents; }` and change its comment to `The panel is fixed over the page at every width: its wrapper takes no place in the list.`
3. In the tags block at the end, delete the rule `.layout[data-panel] .tags { display: none; }` and change the comment above `.tags` to `Tags as pills on a wide screen (§17.1.7).`

In `TransactionsPanels.tsx`, delete the attributes `data-panel=…` and `data-instant=…` from `<div className={styles.layout}>`. Then delete the now unused `const open = …` line if nothing else reads it.

- [x] **Step 2: Conti**

In `accounts.module.css`, delete the `@media (min-width: 1024px)` block that sets `grid-template-columns: minmax(0, 1fr) auto`. Change `.layout` to:

```css
/* D3: the panel is a dialog over the page; the list is the page. */
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--layout-section-gap-web);
}
```

- [x] **Step 3: `PanelSwitch` and `SubnavLayout`**

In `PanelSwitch.module.css`, delete the whole `@media (min-width: 1024px)` block. Change the comment of `.side` to `The panel's wrapper: the panel is fixed over the page at every width (D3), so it takes no place.`

In `SubnavLayout.module.css`, inside the `@media (min-width: 1024px)` block, change `.layout`'s `grid-template-columns` to `var(--layout-subnav-width) minmax(0, 1fr)`. Task 22 replaces this file for D10. After the block, add:

```css
/* D3: a panel in the slot is fixed over the page, so the slot takes no column at any width. */
.slot {
  display: contents;
}
```

- [x] **Step 4: The sticky offset of Statistiche**

In `stats.module.css`, in the last media block, change `top: calc(var(--layout-topbar-height) + 24px);` to `top: 24px;`. The wide screen has no top bar now (D1).

- [x] **Step 5: Run the gates and look**

Run: `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web test`.
Then open `/transactions`, click a row, and press Esc. Do the same on `/accounts` and `/profile/tags` at 1440×900. Expected: the dialog enters from the right over a scrim; the list does not move; Esc closes it with no motion; a click on the scrim closes it with the exit; Tab stays inside the dialog.

- [x] **Step 6: Commit**

```bash
git add "apps/web/app/(app)/transactions" "apps/web/app/(app)/accounts/accounts.module.css" apps/web/src/ui/PanelSwitch.module.css apps/web/src/ui/SubnavLayout.module.css "apps/web/app/(app)/stats/stats.module.css"
git commit -m "feat(web): no page makes room for the panel"
```

### Task 9: End-to-end tests read the dialog

**Files:**
- Modify: `apps/web/e2e/*.spec.ts`

- [x] **Step 1: Change the role**

Run from `apps/web`:

```bash
sed -i '' "s/getByRole('complementary'/getByRole('dialog'/g" e2e/*.spec.ts
sed -i '' 's/aside\[aria-label=/[role="dialog"][aria-label=/g' e2e/*.spec.ts
grep -n "complementary\|aside\[" e2e/*.spec.ts
```

Expected: the last command prints nothing.

- [x] **Step 2: Fix the test that checks the panel beside the list**

In `e2e/budgets-categories-tags.spec.ts`, find the comment `// At 1440px the panel takes the slot column, to the right of the list.` Replace that comment and the five lines after the `toHaveValue('Vacanze')` line (from `const list = …` to `expect(side.x)…`) with:

```ts
  // D3: at 1440px the panel is a dialog at the trailing edge, over the list.
  const side = await panel.boundingBox();
  if (side === null) throw new Error('the panel has no box');
  expect(side.x + side.width).toBeGreaterThan(1440 - 32);
  await expect(page.locator('[data-panel-switch]')).toBeVisible();
```

Keep the line `await expect(panel.getByLabel(…)).toHaveValue('Vacanze');` above it.

- [x] **Step 3: Check that the confirmation dialogs still resolve**

`ConfirmDialog` is a `dialog` too. Run: `grep -n "getByRole('dialog')" e2e/*.spec.ts`. Every match without a `name` can now match two dialogs. For each match, add the name of the dialog that the test means: `{ name: t('…') }`. Use the title key that the test opened.

- [x] **Step 4: Run the end-to-end suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: PASS. If a test fails because the list moved before (a click on a row hidden by the panel), close the panel first or click the row that the scrim does not cover. Write the reason in the commit body.

- [x] **Step 5: Commit**

```bash
git add apps/web/e2e
git commit -m "test(web): panels are dialogs in the end-to-end tests"
```

---

# Part C — Shared components

### Task 10: The card and its grid

**Files:**
- Create: `apps/web/src/ui/Card.tsx`, `apps/web/src/ui/Card.module.css`

- [ ] **Step 1: Write the component**

`apps/web/src/ui/Card.tsx`:

```tsx
import type { ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import styles from './Card.module.css';
import { Icon } from './Icon';
import { PanelLink } from './PanelNav';

interface CardProps {
  /** A card that opens something. Absent, the card is a box (it may hold links of its own). */
  href?: string;
  /** The card's whole panel key (`a:ID`), for a page whose panel lives in client state. */
  selectId?: string;
  /** No surface: «Non a budget», «Nessun obiettivo», «Nuovo conto». */
  ghost?: boolean;
  children: ReactNode;
}

/**
 * The §5.13 card of G2 (2026-10-11): a surface with a 1px inset border; on hover the border stays
 * and a shadow adds depth; a press scales to 0.96 (D11).
 */
export function Card({ href, selectId, ghost = false, children }: CardProps) {
  const className = `${styles.card} ${ghost ? styles.ghost : ''}`;
  if (href === undefined) return <div className={className}>{children}</div>;
  if (selectId !== undefined) {
    return (
      <PanelLink
        className={className}
        selectedClassName={styles.selected}
        selectId={selectId}
        href={href}
      >
        {children}
      </PanelLink>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

/** Three cards a row on a wide screen, two from 640px, one below. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

/** The card's first row: a ring or an icon box, the name, and a short figure at the end. */
export function CardHead({
  leading,
  name,
  meta,
  attention = false,
}: {
  leading?: ReactNode;
  name: string;
  meta?: string;
  attention?: boolean;
}) {
  return (
    <div className={styles.head}>
      {leading}
      <span className={styles.name}>{name}</span>
      {meta === undefined ? null : (
        <span className={`${styles.meta} ${attention ? styles.attention : ''}`}>{meta}</span>
      )}
    </div>
  );
}

/** A small label above a figure: «Uscite», «Non a budget». */
export function CardLabel({ children }: { children: ReactNode }) {
  return <span className={styles.label}>{children}</span>;
}

/** The line under the card's figure: «rimasti · 485,61 € spesi di 700,00 €». */
export function CardNote({ children }: { children: ReactNode }) {
  return <span className={styles.note}>{children}</span>;
}

/** The sentence at the foot of a target card: what to do. */
export function CardSentence({ children }: { children: ReactNode }) {
  return <p className={styles.sentence}>{children}</p>;
}

/** The action of a ghost card: a word and a chevron, the shape of «Tutte le transazioni». */
export function CardAction({ children }: { children: ReactNode }) {
  return (
    <span className={styles.action}>
      {children}
      <Icon name="chevR" size={16} />
    </span>
  );
}
```

`apps/web/src/ui/Card.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 20px 22px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 0 0 1px var(--color-border) inset;
  color: var(--color-text);
  text-align: start;
  text-decoration: none;
  transition-property: scale, background-color, box-shadow;
  transition-duration: var(--motion-press);
  transition-timing-function: var(--motion-easing);
}

/* Shadows for elevation, borders for structure: the border stays, the shadow adds depth (D11). */
a.card:hover {
  box-shadow:
    0 0 0 1px var(--color-border) inset,
    0 1px 2px var(--color-shadow),
    0 4px 12px color-mix(in srgb, var(--color-shadow) 40%, transparent);
}

a.card:active {
  scale: 0.96;
}

/* The ring follows the card's own radius (14px), 2px outside it. */
a.card:focus-visible {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
  border-radius: var(--radius-card);
}

/* The card whose panel is open. */
.selected {
  background: var(--color-raised);
  box-shadow: 0 0 0 1px var(--color-border-strong) inset;
}

.ghost {
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  flex: none;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.attention {
  color: var(--color-accent);
}

.label {
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.note {
  display: block;
  margin-top: 4px;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.sentence {
  font-size: var(--font-size-footnote);
  line-height: 1.45;
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.sentence b {
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  margin-top: auto;
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

@media (prefers-reduced-motion: reduce) {
  a.card:active {
    scale: 1;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/ui/Card.tsx apps/web/src/ui/Card.module.css
git commit -m "feat(web): the target card of G2 and its grid"
```

### Task 11: The page head, the chart frame and the chart heights

**Files:**
- Create: `apps/web/src/ui/PageHead.tsx`, `apps/web/src/ui/PageHead.module.css`, `apps/web/src/ui/charts/ChartFrame.tsx`, `apps/web/src/ui/charts/ChartFrame.module.css`
- Modify: `apps/web/src/ui/charts/TrendChart.tsx`, `apps/web/src/ui/charts/Sparkline.tsx`

- [ ] **Step 1: `PageHead`**

`apps/web/src/ui/PageHead.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './PageHead.module.css';

interface Props {
  /** The period header, or the page's title row. */
  title: ReactNode;
  /** The 56px figure: `HeroFigure` with an `AmountText size="hero"`. */
  hero: ReactNode;
  /** The smaller figures under the hero. */
  stats?: ReactNode;
  /** The shape on the right: a `ChartFrame`. */
  aside?: ReactNode;
}

/**
 * The head of Home, Statistiche and Conti (G2): title, hero and figures in the 7/12 column, a
 * chart in the 5/12 column, both on the same bottom line. One column below the breakpoint.
 */
export function PageHead({ title, hero, stats, aside }: Props) {
  return (
    <section className={styles.head}>
      <div className={styles.lead}>
        {title}
        {hero}
        {stats === undefined ? null : <div className={styles.stats}>{stats}</div>}
      </div>
      {aside === undefined ? null : <div className={styles.aside}>{aside}</div>}
    </section>
  );
}
```

`apps/web/src/ui/PageHead.module.css`:

```css
.head {
  display: grid;
  gap: 32px;
}

.lead {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* The title row sits 8px further from the hero than the hero from its figures. */
.lead > :first-child {
  margin-bottom: 8px;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 48px;
}

.aside {
  min-width: 0;
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .head {
    grid-template-columns: 7fr 5fr;
    column-gap: var(--layout-column-gap-web);
    align-items: end;
  }
}
```

- [ ] **Step 2: `ChartFrame`**

`apps/web/src/ui/charts/ChartFrame.tsx`:

```tsx
import type { ReactNode } from 'react';
import styles from './ChartFrame.module.css';

/** A chart's title row (name, then its figure), the chart, and its foot. Home's §5.6 frame. */
export function ChartFrame({
  title,
  value,
  foot,
  children,
}: {
  title: string;
  value?: ReactNode;
  foot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.head}>
        <span>{title}</span>
        {value}
      </div>
      {children}
      {foot === undefined ? null : <div className={styles.foot}>{foot}</div>}
    </div>
  );
}
```

`apps/web/src/ui/charts/ChartFrame.module.css`:

```css
.frame {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.head,
.foot {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: A height for `TrendChart` and `Sparkline`**

In `TrendChart.tsx`, add to `Props`:

```ts
  /** The drawn height. 220 on Statistiche's own section; 96 in a page head. */
  height?: number;
```

Change the signature to `export function TrendChart({ current, usual, height = WEB_TREND_HEIGHT }: Props)`. Replace every `WEB_TREND_HEIGHT` inside the function body with `height`. Keep the export of `WEB_TREND_HEIGHT`.

In `Sparkline.tsx`, add `style={{ blockSize: `${height}px` }}` to the `<svg>`. The CSS module's fixed `block-size: 48px` then only applies when no height is given: change `.chart` in `Sparkline.module.css` to `inline-size: 100%;` only, and keep the default `height = 48` in the props.

- [ ] **Step 4: Typecheck and commit**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

```bash
git add apps/web/src/ui/PageHead.tsx apps/web/src/ui/PageHead.module.css apps/web/src/ui/charts
git commit -m "feat(web): page head and chart frame for the G2 pages"
```

### Task 12: The stepper beside the title, and the open rows press

**Files:**
- Modify: `apps/web/src/ui/PeriodHeader.tsx`, `apps/web/src/ui/PeriodHeader.module.css`, `apps/web/src/ui/ListRow.module.css`

- [ ] **Step 1: Move the stepper**

In `PeriodHeader.tsx`, replace the returned JSX with:

```tsx
    <div className={styles.header}>
      {/* G: the ‹ › sit beside the word they change, not at the far edge of the page. */}
      <div className={styles.titleRow}>
        <span className={styles.title}>{title}</span>
        <div className={styles.stepper}>
          <Link className={styles.step} href={steps.previous} aria-label={strings.previous}>
            <Icon name="chevL" size={18} className={styles.chevL} />
          </Link>
          {steps.next === null ? (
            <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
              <Icon name="chevR" size={18} className={styles.chevR} />
            </span>
          ) : (
            <Link className={styles.step} href={steps.next} aria-label={strings.next}>
              <Icon name="chevR" size={18} className={styles.chevR} />
            </Link>
          )}
        </div>
      </div>
      {sub === undefined || sub === '' ? null : <span className={styles.sub}>{sub}</span>}
    </div>
```

Check that `Icon` accepts `className`: run `grep -n "className" apps/web/src/ui/Icon.tsx`. It does (`NavLink` passes one).

- [ ] **Step 2: The CSS**

In `PeriodHeader.module.css`, replace `.header` and `.what` with:

```css
.header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 12px;
}
```

Change `.sub`'s colour to `var(--color-text-muted)` and add `margin-top: 2px;`. Add `flex: none;` to `.stepper`. At the end, add:

```css
/* Optical alignment: a chevron's visual centre is inside its box; nudge it outward by half a pixel. */
.chevL {
  translate: -0.5px 0;
}

.chevR {
  translate: 0.5px 0;
}

/* The stepper clips its children: the ring goes inside, at the inner radius. */
.step:focus-visible {
  outline-offset: -2px;
  border-radius: calc(var(--radius-chip-small) - 1px);
}
```

- [ ] **Step 3: Open rows press**

In `ListRow.module.css`, change `.row` to add:

```css
  transition-property: scale, background-color, box-shadow, color;
  transition-duration: var(--motion-press);
  transition-timing-function: var(--motion-easing);
```

After `a.open:hover`, add:

```css
a.open:active {
  scale: 0.96;
}

@media (prefers-reduced-motion: reduce) {
  a.open:active {
    scale: 1;
  }
}
```

Change `.open .subtitle`'s colour from `--color-text-faint` to `--color-text-muted` (AA at 13px).

- [ ] **Step 4: Look at every page with a period**

Open `/home`, `/transactions` and `/stats`. Expected: «Ottobre» with ‹ › right after it; the range under both.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ui/PeriodHeader.tsx apps/web/src/ui/PeriodHeader.module.css apps/web/src/ui/ListRow.module.css
git commit -m "feat(web): stepper beside the period, open rows press"
```

---

# Part D — Home G2

### Task 13: `unbudgetedSpend` in `@saldo/core` (TDD)

**Files:**
- Modify: `packages/core/src/budgets.ts`, `packages/core/src/budgets.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/budgets.test.ts` (and add `unbudgetedSpend` to its import):

```ts
describe('unbudgetedSpend', () => {
  const spending = new Map([
    ['cat-groceries', 1000],
    // A child of a budgeted parent is budgeted too.
    ['cat-supermarket', 500],
    ['cat-rent', 2000],
    ['cat-transport', 300],
  ]);

  it('adds up the spend in categories that no budget covers', () => {
    const budgets = [{ id: 'b1', categoryIds: ['cat-groceries'] }];
    expect(unbudgetedSpend(budgets, spending, CATEGORIES)).toBe(2300);
  });

  it('is all the spend with no budget', () => {
    expect(unbudgetedSpend([], spending, CATEGORIES)).toBe(3800);
  });

  it('is zero when budgets cover every category spent in', () => {
    const budgets = [
      { id: 'b1', categoryIds: ['cat-groceries', 'cat-home'] },
      { id: 'b2', categoryIds: ['cat-transport'] },
    ];
    expect(unbudgetedSpend(budgets, spending, CATEGORIES)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter @saldo/core test budgets`
Expected: FAIL, `unbudgetedSpend` is not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/budgets.ts`, after `takenCategoryIds`:

```ts
/**
 * D6 (web Home, 2026-10-11): the counted spend in categories that no budget covers — «Non a
 * budget». `spending` is `spendingByCategory` for the period, leaf ids; a child of a budgeted
 * parent is covered. Uncategorised spend is never covered.
 */
export function unbudgetedSpend(
  budgets: readonly BudgetRef[],
  spending: ReadonlyMap<string, number>,
  categories: readonly CategoryRef[],
): number {
  const covered = takenCategoryIds(budgets, categories);
  let total = 0;
  for (const [id, amount] of spending) if (!covered.has(id)) total += amount;
  return total;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter @saldo/core test budgets`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/budgets.ts packages/core/src/budgets.test.ts
git commit -m "feat(core): the spend that no budget covers"
```

### Task 14: `homeTrend` (TDD)

**Files:**
- Create: `apps/web/src/features/home/trend.ts`, `apps/web/src/features/home/trend.test.ts`

The Home chart draws «il solito» across the **whole** period, and the current line up to today. «+136,00 € rispetto al solito» compares the two on the same day. Statistiche keeps its own chart as it is.

- [ ] **Step 1: Write the failing test**

`apps/web/src/features/home/trend.test.ts`:

```ts
import { describePeriod } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { tx } from '../test/fixtures';
import { homeTrend } from './trend';

const DEF = { kind: 'month', startDay: 1 } as const;
const TODAY = '2026-09-15';
const SEPTEMBER = describePeriod({ start: '2026-09-01', end: '2026-09-30' }, TODAY);

describe('homeTrend', () => {
  it('draws «il solito» across the whole period and the current line up to today', () => {
    const trend = homeTrend(
      [
        tx({ id: 'aug', amount: 3000, date: '2026-08-01' }),
        tx({ id: 'sep', amount: 5000, date: '2026-09-02' }),
      ],
      DEF,
      SEPTEMBER,
      TODAY,
    );
    expect(trend.current).toHaveLength(15);
    expect(trend.usual).toHaveLength(30);
  });

  it('compares the two lines on the same day', () => {
    const trend = homeTrend(
      [
        tx({ id: 'aug', amount: 3000, date: '2026-08-01' }),
        tx({ id: 'sep', amount: 5000, date: '2026-09-02' }),
      ],
      DEF,
      SEPTEMBER,
      TODAY,
    );
    // August spent 3000 on its first day, so «il solito» is 3000 on every day; September is 5000.
    expect(trend.delta).toBe(2000);
  });

  it('has no comparison with no period before', () => {
    const trend = homeTrend([tx({ id: 'sep', amount: 5000, date: '2026-09-02' })], DEF, SEPTEMBER, TODAY);
    expect(trend.delta).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter web test trend`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement**

`apps/web/src/features/home/trend.ts`:

```ts
import {
  averageSeries,
  dailyCumulative,
  type LedgerTx,
  type LocalDate,
  type PeriodDef,
  type PeriodView,
  periodHistory,
} from '@saldo/core';

/** §5.6: «il solito» is the average of this many previous periods, as on Statistiche. */
const USUAL_PERIODS = 3;

export interface HomeTrend {
  /** Cumulative counted spend per elapsed day. */
  current: number[];
  /** The average of the previous periods, across the whole period. */
  usual: number[];
  /** `current` minus `usual` on the last elapsed day; `null` with no previous period. */
  delta: number | null;
}

/** Home's «Andamento del periodo» (G2): both lines, and how far today is from the usual. */
export function homeTrend(
  txs: readonly LedgerTx[],
  def: PeriodDef,
  period: PeriodView,
  today: LocalDate,
): HomeTrend {
  const current = dailyCumulative(txs, period.range, today);
  const history = periodHistory(txs, def, period.range, USUAL_PERIODS);
  const usual = averageSeries(
    history.map((entry) => dailyCumulative(entry.txs, entry.period, today)),
    Math.max(1, period.length),
  );
  const last = current.at(-1);
  const usualThen = usual.at(current.length - 1);
  return {
    current,
    usual,
    delta:
      history.length === 0 || last === undefined || usualThen === undefined
        ? null
        : last - usualThen,
  };
}
```

If `LedgerTx` is not exported from `@saldo/core`, use `Transaction` (it is what `statsView` passes).

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter web test trend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/home/trend.ts apps/web/src/features/home/trend.test.ts
git commit -m "feat(web): Home's trend and its distance from the usual"
```

### Task 15: `homeView` gives the trend, «Non a budget» and an advice for each budget

**Files:**
- Modify: `apps/web/src/features/home/homeView.ts`

- [ ] **Step 1: Extend the view**

In `homeView.ts`:

1. Add `spendingByCategory` and `unbudgetedSpend` to the `@saldo/core` import. Add `import { type HomeTrend, homeTrend } from './trend';`.
2. In `HomeBudgets`, add:

```ts
  /** Each budget's own sentence (D4: every budget is a card now), by budget id. */
  adviceById: Record<string, BudgetAdvice>;
  /** D6: the spend of the period in categories no budget covers. */
  unbudgeted: number;
```

3. In `HomeView`, add `trend: HomeTrend;`. In `HomeUpcoming`, add:

```ts
  /** What every upcoming row adds up to, not only the five shown: Transazioni's trailing (D4). */
  total: number;
```
4. In `homeView()`, before `return`, add:

```ts
  // As for the featured budget below: the budget's own range decides whether it is open, and
  // `daysLeft` excludes today while the advice spends today too.
  const adviceById: Record<string, BudgetAdvice> = {};
  for (const view of budgetItems) {
    adviceById[view.budget.id] = budgetAdvice(view, view.pace, view.open, view.daysLeft + 1);
  }
  const unbudgeted = unbudgetedSpend(
    budgetItems.map((view) => view.budget),
    spendingByCategory(txs, period.range, today),
    data.categories,
  );
```

5. In the returned object, add `trend: homeTrend(txs, def, period, today),`; inside `budgets: { … }`, add `adviceById,` and `unbudgeted,`; and change `upcoming` to:

```ts
    upcoming: {
      rows: upcomingAll.slice(0, HOME_ROWS).map(row),
      count: upcomingAll.length,
      total: upcomingAll.reduce((sum, tx) => sum + tx.amount, 0),
    },
```

- [ ] **Step 2: Run the tests**

Run: `rtk proxy pnpm --filter web test homeView`
Expected: PASS (the existing test does not read the new fields).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/home/homeView.ts
git commit -m "feat(web): Home's view gives the trend, the unbudgeted spend and every budget's advice"
```

### Task 16: The Home page

**Files:**
- Modify: `apps/web/app/(app)/home/page.tsx`, `apps/web/app/(app)/home/home.module.css`

Open the mockup at `?variant=G2` beside your editor.

- [ ] **Step 1: Imports and helpers**

In `page.tsx`:

1. Delete the imports of `Columns`, `HeroBand` (keep `HeroFigure`: `import { HeroFigure } from '../../../src/ui/HeroBand';`), `ProgressBar` stays, `VisuallyHidden` stays.
2. Add: `import { Card, CardAction, CardGrid, CardHead, CardLabel, CardNote, CardSentence } from '../../../src/ui/Card';`, `import { PageHead } from '../../../src/ui/PageHead';`, `import { ChartFrame } from '../../../src/ui/charts/ChartFrame';`, `import { TrendChart } from '../../../src/ui/charts/TrendChart';`, and `formatSignedMoney` is not needed: the label uses `home.vsUsualAbove` / `home.vsUsualBelow`.
3. Delete the `Featured` component, `FeaturedProps` and `TODAY_WIDTH`. Add instead:

```tsx
/** Wide enough for «oggi» in every locale, centred on the pace tick. */
const TODAY_WIDTH = 64;

/** The bar of a target card and the three labels under it (§5.13), at 13px (D11). */
function TargetBar({
  ratio,
  pace,
  tone,
  start,
  end,
  today,
}: {
  ratio: number;
  pace: number | null;
  tone: 'normal' | 'over' | 'done';
  start: string;
  end: string;
  today: string;
}) {
  const labels = endLabels(pace);
  return (
    <div aria-hidden="true">
      <ProgressBar thick ratio={ratio} pace={pace} tone={tone} />
      <div className={styles.ends}>
        {labels.start ? <span className={styles.endStart}>{start}</span> : null}
        {labels.today && pace !== null ? (
          <span
            className={styles.endToday}
            style={{
              insetInlineStart: `${pace * 100}%`,
              inlineSize: `${TODAY_WIDTH}px`,
              marginInlineStart: `${-TODAY_WIDTH / 2}px`,
            }}
          >
            {today}
          </span>
        ) : null}
        {labels.end ? <span className={styles.endEnd}>{end}</span> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: The budget and goal cards**

Inside `HomePage`, after `budgetSentence`, add:

```tsx
  const budgetCard = (item: BudgetView) => {
    const advice = view.budgets.adviceById[item.budget.id];
    return (
      <Card key={item.budget.id} href={`/profile/budgets?b=${item.budget.id}`}>
        <VisuallyHidden>{budgets.label(item)}</VisuallyHidden>
        <div aria-hidden="true">
          <CardHead
            leading={
              <TargetRing
                size={32}
                ratio={item.ratio}
                pace={budgets.pace(item)}
                tone={budgets.tone(item)}
                icon={item.budget.icon as IconName}
                colorIndex={budgets.colour(item)}
              />
            }
            name={item.budget.name}
            meta={percent(item.ratio)}
            attention={budgets.tone(item) === 'over'}
          />
        </div>
        <div aria-hidden="true">
          {/* D5: the figure is what is left; the line under it is what is spent of the limit. */}
          <AmountText
            minor={Math.max(0, item.limit - item.spent)}
            currency={currency}
            locale={locale}
            size="large"
          />
          <CardNote>
            {item.overLimit
              ? t('targets.overLimitBy', { amount: money(item.spent - item.limit) })
              : t('targets.leftDetail', { spent: money(item.spent), limit: money(item.limit) })}
          </CardNote>
        </div>
        <TargetBar
          ratio={item.ratio}
          pace={budgets.pace(item)}
          tone={budgets.tone(item)}
          start={formatDayMonth(item.range.start, locale)}
          end={formatDayMonth(item.range.end, locale)}
          today={t('targets.today')}
        />
        {advice === undefined ? null : <CardSentence>{budgetSentence(advice, item)}</CardSentence>}
      </Card>
    );
  };

  const goalCard = (item: GoalView) => (
    <Card key={item.account.id} href={`/accounts?g=${item.account.id}`}>
      <VisuallyHidden>{goalLabel(item, goalDeps)}</VisuallyHidden>
      <div aria-hidden="true">
        <CardHead
          leading={
            <TargetRing
              size={32}
              ratio={item.progress.ratio}
              pace={goalPace(item.progress)}
              tone={goalWebTone(item)}
              icon={item.account.icon as IconName}
              colorIndex={item.account.colorIndex}
            />
          }
          name={item.account.name}
          meta={percent(item.progress.ratio)}
          attention={goalWebTone(item) === 'over'}
        />
      </div>
      <div aria-hidden="true">
        <AmountText minor={item.progress.saved} currency={currency} locale={locale} size="large" />
        <CardNote>{goalOf(item, goalDeps)}</CardNote>
      </div>
      <TargetBar
        ratio={item.progress.ratio}
        pace={goalPace(item.progress)}
        tone={goalWebTone(item)}
        start={goalEnds(item, goalDeps).start}
        end={goalEnds(item, goalDeps).end}
        today={t('targets.today')}
      />
      <CardSentence>{goalSentenceNode(item)}</CardSentence>
    </Card>
  );
```

Delete `goalRow`, `featuredBudget`, `budgetEvents`, `budgetRest`, `featuredGoal`, `goalEvents` and `goalRest`. They are not used now. Keep `budgets = budgetRowFor(…)`: the card uses its `pace`, `tone`, `colour` and `label`.

Check that `Rich` renders `<b>` with `styles.strong`. The card's `.sentence b` rule styles a plain `<b>` too, so both work.

- [ ] **Step 3: The returned JSX**

Replace the whole `return (…)` of `HomePage` with:

```tsx
  const delta = view.trend.delta;

  return (
    <div className={styles.page}>
      <PageHead
        title={
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
        }
        hero={
          <HeroFigure label={period.isCurrent ? t('home.remaining') : t('home.leftover')}>
            <AmountText
              minor={view.summary.remaining}
              currency={currency}
              locale={locale}
              size="hero"
            />
          </HeroFigure>
        }
        stats={
          <>
            <HeroFigure label={t('home.income')}>
              <AmountText
                minor={view.summary.income}
                currency={currency}
                locale={locale}
                size="headline"
                positive
              />
            </HeroFigure>
            <HeroFigure label={t('home.expenses')}>
              <AmountText
                minor={view.summary.spent}
                currency={currency}
                locale={locale}
                size="headline"
              />
            </HeroFigure>
          </>
        }
        aside={
          <ChartFrame
            title={t('stats.cycleTrend')}
            value={
              <AmountText
                minor={view.summary.spent}
                currency={currency}
                locale={locale}
                size="footnote"
              />
            }
            foot={
              <>
                <span>{t('home.dayOf', { elapsed: period.elapsed, length: period.length })}</span>
                {delta === null ? null : (
                  <span className={styles.vsUsual}>
                    {t(delta >= 0 ? 'home.vsUsualAbove' : 'home.vsUsualBelow', {
                      amount: money(Math.abs(delta)),
                    })}
                  </span>
                )}
              </>
            }
          >
            <TrendChart current={view.trend.current} usual={view.trend.usual} height={96} />
          </ChartFrame>
        }
      />

      <Section
        open
        title={t('tabs.transactions')}
        trailing={
          view.upcoming.count === 0
            ? undefined
            : plural(t, locale, 'home.upcomingSummary', view.upcoming.count, {
                amount: money(view.upcoming.total),
              })
        }
        more={
          <Link className={styles.more} href="/transactions">
            <span>{t('home.allTransactions')}</span>
            <Icon name="chevR" size={16} />
          </Link>
        }
      >
        <div className={styles.txCols}>
          <div>
            <span className={styles.groupLabel}>{t('home.latest')}</span>
            {view.recent.length === 0 ? (
              <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />
            ) : (
              view.recent.map((row) => txRow(row, false))
            )}
          </div>
          {view.upcoming.count === 0 ? null : (
            <div>
              <span className={styles.groupLabel}>
                {t('home.upcomingUntil', { date: formatDayMonth(period.range.end, locale) })}
              </span>
              {view.upcoming.rows.map((row) => txRow(row, true))}
            </div>
          )}
        </div>
      </Section>

      <Section
        open
        title={t('home.budget')}
        trailing={budgetStatusLine}
        attention={view.budgets.items.length > 0 && view.budgets.status.kind !== 'withinLimits'}
      >
        <CardGrid>
          {view.budgets.items.map(budgetCard)}
          {/* D6: the last card, and the way to a new budget. */}
          <Card ghost href="/profile/budgets?new">
            <CardLabel>{t('home.unbudgeted')}</CardLabel>
            <AmountText
              minor={view.budgets.unbudgeted}
              currency={currency}
              locale={locale}
              size="headline"
            />
            <CardLabel>
              {view.budgets.items.length === 0 ? t('budgets.emptyBody') : t('home.unbudgetedNote')}
            </CardLabel>
            <CardAction>{t('targets.createBudget')}</CardAction>
          </Card>
        </CardGrid>
      </Section>

      <Section open title={t('goals.title')} trailing={goalStatusLine}>
        <CardGrid>
          {view.goals.items.map(goalCard)}
          {view.goals.items.length > 0 ||
          pocketParentCandidates(page.data.accounts).length === 0 ? null : (
            <Card ghost href={NEW_GOAL_HREF}>
              <CardLabel>{goalStatusLine}</CardLabel>
              <p className={styles.ghostBody}>{t('goals.emptyBody')}</p>
              <CardAction>{t('goals.create')}</CardAction>
            </Card>
          )}
        </CardGrid>
        {view.goals.items.length === 0 &&
        pocketParentCandidates(page.data.accounts).length === 0 ? (
          <p className={styles.emptyNote}>{t('goals.emptyBody')}</p>
        ) : null}
      </Section>
    </div>
  );
```

- [ ] **Step 4: The CSS**

In `home.module.css`:

1. Replace `.page` and its media block with:

```css
/* G2: the head, then three sections in a column, 56px apart (D4). */
.page {
  display: flex;
  flex-direction: column;
  gap: var(--layout-section-gap-web);
}
```

2. Delete `.featured`, `.featuredHead`, `.featuredName`, `.featuredMeta`, `.featuredAmount`, `.featuredOf`, `.featuredBar`, `.sentence`, `.rowStatus`, `.rowPercent`, `.rowStatusMeta`, `.rowOver` and `.rowDone`. Run `grep -n "styles\.\(featured\|rowStatus\|rowPercent\|rowDone\|sentence\)" "apps/web/app/(app)/home/page.tsx"` first: expected no match after Step 2. `budgetRowFor` still receives `styles`; it only reads them in `row`, which Home no longer calls.
3. Change `.ends` to `height: 16px; margin-top: 8px;` and the three `.end*` rules to `font-size: var(--font-size-footnote);`, with `.endStart` and `.endEnd` in `--color-text-muted` (D11).
4. Add:

```css
.txCols {
  display: grid;
  gap: 24px;
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .txCols {
    grid-template-columns: 7fr 5fr;
    column-gap: var(--layout-column-gap-web);
    align-items: start;
  }
}

.groupLabel {
  display: block;
  padding: 6px 0 2px;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  letter-spacing: var(--tracking-tight);
}

.vsUsual {
  color: var(--color-accent);
}

.ghostBody {
  font-size: var(--font-size-footnote);
  line-height: 1.45;
  text-wrap: pretty;
}
```

- [ ] **Step 5: Run the gates**

Run: `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web test`.
Expected: no errors, no `lint/…` lines, PASS. Fix unused imports that lint reports.

- [ ] **Step 6: Compare with the mockup**

Open `/home` at 1440×900 in both themes, beside the mockup at `?variant=G2`. Check: the stepper is beside «Ottobre»; the chart is on the right of the hero; «Transazioni» comes first with two columns; budget cards show what is left in large type; «Non a budget» is the last budget card; with no goals, the «Obiettivi» section shows one ghost card. Write each difference that you keep in the commit body.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(app)/home" apps/web/src/features/home/homeView.ts
git commit -m "feat(web): Home G2 — head with trend, transactions first, budget and goal cards"
```

### Task 17: Home in the end-to-end tests

**Files:**
- Modify: `apps/web/e2e/home-stats.spec.ts`

- [ ] **Step 1: Run the Home tests**

Run: `rtk proxy pnpm --filter web e2e home-stats`
Expected: some tests fail where they looked for the old shape: the section «Ultime transazioni», a budget row, the featured item.

- [ ] **Step 2: Fix each failure for the new shape**

Use these rules:

- «Ultime transazioni» is now the group label `t('home.latest')` inside the section `t('tabs.transactions')`. Find the rows by their link name, as before.
- A budget is a card: a link whose accessible name is `budgets.label(item)` (`targets.itemLabel`). Use `page.getByRole('link', { name: … })`.
- The «Non a budget» card is a link to `/profile/budgets?new`.

Add one test that checks D6 with real data: create a budget on one category, record one expense in that category and one in another category, open `/home`, and expect the «Non a budget» card to show the second amount. Use the helpers that `home-stats.spec.ts` already uses to create budgets and transactions.

- [ ] **Step 3: Run them**

Run: `rtk proxy pnpm --filter web e2e home-stats`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/home-stats.spec.ts
git commit -m "test(web): Home G2 in the end-to-end tests"
```

---

# Part E — Transazioni

### Task 18: Three cards above the list (D7, D12)

**Files:**
- Modify: `apps/web/app/(app)/transactions/page.tsx`, `apps/web/app/(app)/transactions/transactions.module.css`

- [ ] **Step 1: Compute the period summary**

In `page.tsx`, add `summarizePeriod` to the `@saldo/core` import, and the card components to the imports: `import { Card, CardGrid, CardLabel, CardNote } from '../../../src/ui/Card';` and `import { ProgressBar } from '../../../src/ui/ProgressBar';`. After `const view = listView(…)`, add:

```tsx
  // D7: the cards say what the period holds, whatever the filters; the list under them is filtered.
  const summary = summarizePeriod(page.data.transactions, period.range, today);
  const upcomingRows = view.upcomingDays.flatMap((day) => day.rows);
```

- [ ] **Step 2: Render the cards**

In the returned JSX, inside `<div className={styles.head}>`, after `<PeriodHeader … />`, add:

```tsx
          <CardGrid>
            <Card>
              <CardLabel>{t('home.expenses')}</CardLabel>
              <AmountText minor={summary.spent} currency={currency} locale={locale} size="title" />
              <ProgressBar
                thick
                ratio={summary.ratio}
                pace={period.isCurrent ? summary.pace : null}
                tone={summary.overPace ? 'over' : 'normal'}
              />
              <CardNote>
                {period.isCurrent
                  ? t('home.dayOf', { elapsed: period.elapsed, length: period.length })
                  : t('home.closedCycle')}
              </CardNote>
            </Card>
            <Card>
              <CardLabel>{t('home.income')}</CardLabel>
              <AmountText
                minor={summary.income}
                currency={currency}
                locale={locale}
                size="title"
                positive
              />
            </Card>
            <Card>
              <CardLabel>
                {t('home.upcoming')} · {plural(t, locale, 'home.upcomingCount', view.upcoming.count)}
              </CardLabel>
              <AmountText
                minor={view.upcoming.net}
                currency={currency}
                locale={locale}
                size="title"
                sign="always"
              />
              {/* D12: the next three; the disclosure in the list holds them all. */}
              <div className={styles.cardRows}>
                {upcomingRows.slice(0, 3).map((row) => (
                  <ListRow
                    key={row.id}
                    open
                    href={href({ [SELECTION_PARAM]: row.id })}
                    selectId={row.id}
                    title={row.title}
                    subtitle={formatDayMonth(row.date, locale)}
                    trailing={
                      <AmountText
                        minor={row.amount.minor}
                        currency={currency}
                        locale={locale}
                        sign={row.amount.signDisplay}
                        size="footnote"
                        muted
                      />
                    }
                  />
                ))}
              </div>
            </Card>
          </CardGrid>
```

Check the names first:

- `summarizePeriod`'s result: `grep -n "export interface PeriodSummary" -A12 packages/core/src/ledger.ts`. Home reads `summary.ratio`, `summary.pace` and `summary.overPace`, so they exist.
- `AmountText` sizes: `grep -n "size" apps/web/src/ui/AmountText.tsx`. If `title` is not a size, use `large`.
- `view.upcoming.net` is the net of the upcoming rows. If it is zero, the card still shows the count.

The rows in the card are `PanelLink`s (`selectId`). `TransactionsPanels` provides the context, because the head is inside its children. So a click opens the detail dialog in place.

- [ ] **Step 3: The CSS**

In `transactions.module.css`, add:

```css
/* The rows of the In arrivo card: compact, and their hover stays inside the card's padding. */
.cardRows {
  display: flex;
  flex-direction: column;
}

.cardRows > a {
  min-height: 36px;
  padding-block: 6px;
}
```

Change `.head`'s `gap` from `24px` to `32px`.

- [ ] **Step 4: Run the gates and look**

Run: `rtk proxy pnpm --filter web typecheck` and `rtk proxy pnpm lint`.
Open `/transactions` at 1440×900. Compare with the mockup at `?variant=K&page=tx`. Click an In arrivo row in the card: the dialog opens with that row, over a scrim, and the cards do not move.

- [ ] **Step 5: Run the Transazioni end-to-end tests**

Run: `rtk proxy pnpm --filter web e2e transactions`
Expected: PASS. A row name can now match twice (the card and the disclosure). If a test fails with «strict mode violation», scope it to the list: `page.locator('[data-days]')` does not exist yet, so add `data-days=""` to the wrapper of the days in `page.tsx` and use it in the test.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(app)/transactions" apps/web/e2e/transactions.spec.ts
git commit -m "feat(web): Transazioni opens with the period's three cards"
```

---

# Part F — Statistiche

### Task 19: Each category's history in `statsView` (TDD)

**Files:**
- Modify: `apps/web/src/features/stats/statsView.ts`, `apps/web/src/features/stats/statsView.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `statsView.test.ts`:

```ts
  it('gives each category its spend in the previous periods, oldest first, then this one', () => {
    const view = statsView({
      data: dataWith([
        ...HISTORY,
        tx({ id: 'now', amount: 20000, date: '2026-09-03', categoryId: CATEGORY.id }),
      ]),
      def: DEF,
      today: TODAY,
      period: SEPTEMBER,
      direction: 'expense',
    });
    const row = view.split.rows.find((entry) => entry.categoryId === CATEGORY.id);
    // June 40000, July nothing for this category (a used period, so a real zero), August 60000.
    expect(row?.history).toEqual([40000, 0, 60000, 20000]);
  });
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter web test statsView`
Expected: FAIL, `history` is `undefined`.

- [ ] **Step 3: Implement**

In `statsView.ts`, add to `SplitRow`:

```ts
  /**
   * The category's spend in each used previous period, oldest first, then this period's: the
   * sparkline of its panel (D8). A used period with no spend in the category is a real zero.
   */
  history: number[];
```

In the `.map(([categoryId, amount]) => { … })` that builds `rows`, add to the returned object:

```ts
        // `history` is most recent first (`periodHistory`); the chart reads left to right.
        history: [...history.map((cycle) => cycle.get(categoryId) ?? 0).reverse(), amount],
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter web test statsView`
Expected: PASS. (`previousPeriods` walks back from the period, so `periodHistory` is most recent first, and `.reverse()` is needed.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/stats/statsView.ts apps/web/src/features/stats/statsView.test.ts
git commit -m "feat(web): each category's history in Statistiche's view"
```

### Task 20: Statistiche in the K layout, with the category panel (D8)

**Files:**
- Modify: `apps/web/app/(app)/stats/page.tsx`, `apps/web/app/(app)/stats/stats.module.css`

- [ ] **Step 1: Imports and the panel's keys**

In `page.tsx`, add:

```tsx
import { listView } from '../../../src/features/transactions/listView';
import { filtersFromSearch } from '../../../src/features/transactions/listParams';
import { Card, CardGrid, CardHead, CardLabel, CardNote } from '../../../src/ui/Card';
import { ChartFrame } from '../../../src/ui/charts/ChartFrame';
import { Sparkline } from '../../../src/ui/charts/Sparkline';
import { IconBox } from '../../../src/ui/IconBox';
import { PageHead } from '../../../src/ui/PageHead';
import { type PanelSpec, PanelSwitch } from '../../../src/ui/PanelSwitch';
```

After `const DIRECTION_PARAM = 'direction';`, add:

```tsx
/** D8: a category card opens its panel, `?c={categoryId}`; the key is `c:{categoryId}`. */
const PANEL_PARAMS = { flags: [], values: ['c'] } as const;

/** How many of a category's transactions its panel lists. */
const CATEGORY_ROWS = 5;
```

- [ ] **Step 2: The head of a running or closed period**

In the branch for a running or closed period (after `const view = statsView(…)`), replace the returned JSX with the layout below. Keep the helpers `Figure`, `segments`, `ranked`, `spentNote`, `projection`, `median` as they are.

```tsx
  const baseHref = periodHref(PATH, period.range, def, today, keep);
  const categoryHref = (categoryId: string) =>
    periodHref(PATH, period.range, def, today, { ...keep, c: categoryId });

  // Every category's panel, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = {};
  for (const { row, colour } of ranked) {
    const rows = listView({
      data: page.data,
      filters: filtersFromSearch({ category: row.categoryId, direction: direction }),
      today,
      period,
      kindLabel: (kind) => t(`kinds.${kind}`),
    })
      .days.flatMap((day) => day.rows)
      .slice(0, CATEGORY_ROWS);
    panels[`c:${row.categoryId}`] = {
      title: row.category?.name ?? MISSING,
      body: (
        <>
          <Figure
            label={direction === 'income' ? t('stats.income') : t('stats.expenses')}
            note={[
              t('stats.ofTotal', { pct: row.share }),
              row.delta === null ? t('stats.newLabel') : t('stats.vsUsual', { delta: formatSignedPercent(row.delta) }),
            ].join(' · ')}
          >
            <AmountText minor={row.amount} currency={currency} locale={locale} size="large" />
          </Figure>
          <ChartFrame title={plural(t, locale, 'stats.lastPeriods', row.history.length)}>
            <Sparkline series={row.history} height={56} />
          </ChartFrame>
          <Section
            open
            title={t('tabs.transactions')}
            more={
              <a className={styles.more} href={transactionsHref({ category: row.categoryId })}>
                <span>{t('home.allTransactions')}</span>
              </a>
            }
          >
            {rows.length === 0 ? (
              <EmptyState title={t('stats.empty')} />
            ) : (
              rows.map((tx) => (
                <ListRow
                  key={tx.id}
                  open
                  href={`/transactions?t=${tx.id}`}
                  icon={tx.icon as IconName}
                  colorIndex={tx.colorIndex}
                  title={tx.title}
                  subtitle={tx.subtitle}
                  trailing={
                    <AmountText
                      minor={tx.amount.minor}
                      currency={currency}
                      locale={locale}
                      sign={tx.amount.signDisplay}
                    />
                  }
                />
              ))
            )}
          </Section>
          <span className={styles.dot} style={{ background: colour }} aria-hidden="true" />
        </>
      ),
    };
  }
```

Delete the last `<span className={styles.dot} …/>` line of the body if the design review finds the dot without meaning in the panel. It ties the panel to the bar's colour; keep it unless the review says otherwise.

Use `AppLink` instead of `<a>` for the «Tutte le transazioni» link if lint asks for it (`import { AppLink as Link } from '../../../src/ui/AppLink';`). Add `.more` to `stats.module.css` with the same rule as Home's `.more`.

- [ ] **Step 3: The returned JSX**

```tsx
  return (
    <PanelSwitch
      baseHref={baseHref}
      params={PANEL_PARAMS}
      panels={panels}
      closeLabel={t('common.close')}
    >
      <div className={styles.page}>
        <PageHead
          title={header}
          hero={
            <Figure label={t('stats.expenses')} note={spentNote}>
              <AmountText minor={view.figures.spent} currency={currency} locale={locale} size="hero" />
            </Figure>
          }
          stats={
            <>
              <Figure label={t('stats.income')}>
                <AmountText minor={view.figures.income} currency={currency} locale={locale} size="headline" positive />
              </Figure>
              <Figure label={t('stats.net')}>
                <AmountText minor={view.figures.net} currency={currency} locale={locale} size="headline" sign="always" />
              </Figure>
              {projection === null ? null : (
                <Figure label={t('stats.projection')}>
                  <AmountText minor={projection} currency={currency} locale={locale} size="headline" />
                </Figure>
              )}
            </>
          }
          aside={
            <ChartFrame
              title={t('stats.cycleTrend')}
              value={<AmountText minor={view.figures.spent} currency={currency} locale={locale} size="footnote" />}
              foot={<span>{t('stats.trendFooter', { elapsed: period.elapsed, length: period.length })}</span>}
            >
              <TrendChart current={view.trend.current} usual={view.trend.usual} height={96} />
            </ChartFrame>
          }
        />

        {chart}

        <Section
          title={t('stats.split')}
          trailing={
            <span className={styles.chips}>
              <Chip label={t('stats.expenses')} href={directionHref('expense')} active={direction === 'expense'} />
              <Chip label={t('stats.income')} href={directionHref('income')} active={direction === 'income'} />
            </span>
          }
        >
          {view.split.rows.length === 0 ? (
            <EmptyState title={t('stats.empty')} />
          ) : (
            <>
              <SplitBar segments={segments} />
              <CardGrid>
                {ranked.map(({ row, colour }) => (
                  <Card key={row.categoryId} href={categoryHref(row.categoryId)} selectId={`c:${row.categoryId}`}>
                    <CardHead
                      leading={
                        row.category === undefined ? undefined : (
                          <IconBox name={row.category.icon as IconName} colorIndex={row.category.colorIndex} />
                        )
                      }
                      name={row.category?.name ?? MISSING}
                      meta={t('targets.percent', { value: row.share })}
                    />
                    <div>
                      <AmountText minor={row.amount} currency={currency} locale={locale} size="large" />
                      <CardNote>
                        {row.delta === null
                          ? t('stats.newLabel')
                          : t('stats.vsUsual', { delta: formatSignedPercent(row.delta) })}
                      </CardNote>
                    </div>
                    <SplitBar
                      segments={[
                        { key: 'share', amount: row.amount, colour },
                        { key: 'rest', amount: Math.max(0, view.split.total - row.amount), colour: 'var(--color-track)' },
                      ]}
                    />
                  </Card>
                ))}
                {/* Quota impegnata leaves its section for a ghost card at the end of the grid (K). */}
                <Card ghost>
                  <CardLabel>{t('stats.committed')}</CardLabel>
                  <span className={styles.percent}>
                    {t('targets.percent', { value: view.committed.share })}
                  </span>
                  <p className={styles.note}>
                    {t('stats.committedLine', {
                      pct: view.committed.share,
                      amount: formatMoney(view.committed.amount, currency, locale),
                    })}
                  </p>
                </Card>
              </CardGrid>
            </>
          )}
          {view.split.excluded.count === 0 ? null : (
            <p className={styles.note}>
              {plural(t, locale, 'stats.excludedRow', view.split.excluded.count, {
                amount: formatMoney(view.split.excluded.amount, currency, locale),
              })}
            </p>
          )}
        </Section>

        {/* Tag: keep the existing `<Section title={t('stats.tags')} …>…</Section>` here, unchanged. */}
      </div>
    </PanelSwitch>
  );
```

Move the existing Tag section into the place the last comment marks, and delete the comment. Delete the `Columns` import if nothing else uses it (the forecast branch still does: keep it). Delete the old `Quota impegnata` section and the old `Andamento del periodo` section from this branch: both moved.

- [ ] **Step 4: The forecast branch**

In the forecast branch, change the order inside `<div className={styles.top}>` to `{header}`, then `<div className={styles.figures}>…</div>`, then `{chart}`. The head comes first on every page (G).

- [ ] **Step 5: The CSS**

In `stats.module.css`, change the `.page` comment to `The head, Flussi, Ripartizione, Tag — D8.` Add Home's `.more` rule. Delete `.sticky` if no element uses it any longer (`grep -n "styles.sticky" "apps/web/app/(app)/stats/page.tsx"`).

- [ ] **Step 6: Run the gates and look**

Run: `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web test`.
Open `/stats` at 1440×900. Compare with `?variant=K&page=stats`. Click a category card: the dialog shows the category; the URL has `?c=…`; ✕ removes it; the period arrows keep `?c` out.

- [ ] **Step 7: Run the Statistiche end-to-end tests**

Run: `rtk proxy pnpm --filter web e2e home-stats`
Expected: PASS. The Ripartizione rows are cards now: change the locators from rows to `getByRole('link', { name: … })`. Add one test: click a category card, expect the dialog with the category's name, and expect a transaction of that category in it.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(app)/stats" apps/web/e2e/home-stats.spec.ts
git commit -m "feat(web): Statistiche with Home's head and category cards that open a panel"
```

---

# Part G — Conti

### Task 21: Conti in the K layout (D9)

**Files:**
- Modify: `apps/web/app/(app)/accounts/page.tsx`, `apps/web/app/(app)/accounts/accounts.module.css`, `apps/web/src/ui/HeroBand.tsx`, `apps/web/src/ui/HeroBand.module.css`

- [ ] **Step 1: The net worth series**

In `page.tsx`, after `const detailOf = …`, add:

```tsx
  // The head's sparkline: every live account's month-end balances, added up month by month. A
  // pocket is an account with its own balance, so the parent does not count it twice.
  const live = page.data.accounts.filter((account) => account.archivedAt === null);
  const netWorthSeries = live
    .map((account) => detailOf(account.id)?.series ?? [])
    .reduce<number[]>(
      (sum, series) => series.map((value, index) => value + (sum[index] ?? 0)),
      [],
    );
```

Check the claim of the comment before you rely on it. Run `grep -n "netWorth" apps/web/src/features/accounts/accountsView.ts`. If `netWorth` leaves pockets out, leave them out here too (`filter((account) => account.parentAccountId == null)`). Then check that the last point of `netWorthSeries` equals `view.netWorth` for the e2e seed (Step 6).

- [ ] **Step 2: The cards**

Add the imports of `Card`, `CardGrid`, `CardHead`, `CardLabel`, `CardNote`, `CardSentence`, `PageHead`, `ChartFrame` and `ProgressBar`. Replace `accountRow`, `pocketRow` and `group` with:

```tsx
  const accountCard = (row: AccountRowView) => {
    const detail = detailOf(row.account.id);
    const due = detail?.due ?? null;
    const owes = due !== null && due > 0;
    const change = detail === null ? 0 : detail.period.income - detail.period.spent;
    return (
      <Card key={row.account.id} href={`${PATH}?a=${row.account.id}`} selectId={`a:${row.account.id}`}>
        <CardHead
          leading={<IconBox name={row.account.icon as IconName} colorIndex={row.account.colorIndex} />}
          name={row.account.name}
        />
        <div>
          {owes ? <CardLabel>{t('accounts.toRepay')}</CardLabel> : null}
          <AmountText minor={owes ? due : row.balance} currency={currency} locale={locale} size="large" />
          <CardNote>
            {[
              row.account.institution ?? t(`accountTypes.${row.account.type}`),
              t('accounts.periodDelta', { amount: formatMoney(change, currency, locale, 'always') }),
              row.pockets.length === 0 ? null : `${money(row.free)} ${t('goals.free')}`,
            ]
              .filter((part) => part !== null)
              .join(' · ')}
          </CardNote>
        </div>
        {detail === null ? null : <Sparkline series={detail.series} height={40} />}
      </Card>
    );
  };

  const goalCard = (pocket: AccountRowView['pockets'][number]) => {
    const detail = detailOf(pocket.account.id);
    const goal = detail?.goal ?? null;
    if (goal === null) return null;
    const subject: GoalTextSubject = { account: pocket.account, progress: goal };
    const { action } = goalSentence(subject, goalDeps);
    return (
      <Card key={pocket.account.id} href={`${PATH}?g=${pocket.account.id}`} selectId={`g:${pocket.account.id}`}>
        <CardHead
          leading={
            <TargetRing
              size={32}
              ratio={goal.ratio}
              pace={goalPace(goal)}
              tone={goalRingTone(goal)}
              icon={pocket.account.icon as IconName}
              colorIndex={pocket.account.colorIndex}
            />
          }
          name={pocket.account.name}
          meta={t('targets.percent', { value: Math.round(goal.ratio * 100) })}
          attention={goalRingTone(goal) === 'over'}
        />
        <div>
          <AmountText minor={goal.saved} currency={currency} locale={locale} size="large" />
          <CardNote>{goalOf(subject, goalDeps)}</CardNote>
        </div>
        <ProgressBar thick ratio={goal.ratio} pace={goalPace(goal)} tone={goalRingTone(goal)} />
        <CardSentence>
          <Rich text={richText(action, t, locale)} />
        </CardSentence>
      </Card>
    );
  };

  const cards = (rows: AccountRowView[]) =>
    rows.flatMap((row) => [accountCard(row), ...row.pockets.map(goalCard)]);
```

Check `formatMoney`'s fourth argument: `grep -n "export function formatMoney" -A6 packages/i18n/src/*.ts`. The stats page calls `formatMoney(column.net, currency, locale, 'always')`, so the sign display is the fourth argument.

- [ ] **Step 3: The returned list**

Inside `<PanelSwitch …>`, replace the whole `<div className={styles.list}>…</div>` with:

```tsx
            <div className={styles.list}>
              <PageHead
                title={
                  <div className={styles.titleRow}>
                    <h1 className={styles.title}>{t('accounts.title')}</h1>
                    <PanelLink className={styles.newAccount} href={`${PATH}?new`}>
                      <Icon name="plus" size={16} />
                      {t('accounts.newAccount')}
                    </PanelLink>
                  </div>
                }
                hero={
                  <Figure label={t('accounts.netWorth')}>
                    <AmountText minor={view.netWorth} currency={currency} locale={locale} size="hero" />
                  </Figure>
                }
                stats={
                  <Figure label={t('accounts.spendable')} note={t('accounts.spendableNote')}>
                    <AmountText minor={view.spendable} currency={currency} locale={locale} size="headline" />
                  </Figure>
                }
                aside={
                  netWorthSeries.length < 2 ? undefined : (
                    <ChartFrame
                      title={plural(t, locale, 'accounts.netWorthTrend', netWorthSeries.length)}
                      value={<AmountText minor={view.netWorth} currency={currency} locale={locale} size="footnote" />}
                    >
                      <Sparkline series={netWorthSeries} height={96} />
                    </ChartFrame>
                  )
                }
              />

              {empty ? (
                <EmptyState title={t('accounts.empty')} />
              ) : (
                <>
                  <Section
                    open
                    title={t('accounts.spending')}
                    trailing={plural(t, locale, 'accounts.count', view.spending.length)}
                  >
                    <CardGrid>{cards(view.spending)}</CardGrid>
                  </Section>
                  <Section open title={t('accounts.savings')} trailing={t('accounts.outsideSpendable')}>
                    <CardGrid>
                      {cards(view.savings)}
                      <Card ghost href={`${PATH}?new`} selectId="new">
                        <CardLabel>{t('accounts.newAccount')}</CardLabel>
                        <p className={styles.note}>{t('accounts.newAccountBody')}</p>
                      </Card>
                    </CardGrid>
                  </Section>
                </>
              )}

              {/* Keep the existing «Conti archiviati» row or note here, unchanged. */}
            </div>
```

Move the existing `archivedTotal === 0 ? … : …` block into the place the last comment marks, and delete the comment. The «Risparmi» section now shows even with no savings account, because the «Nuovo conto» card lives there. If the review prefers it under «Da spendere» in that case, move the ghost card there when `view.savings.length === 0`.

- [ ] **Step 4: Delete `HeroBand`**

Run: `grep -rn "HeroBand\b" apps/web/app apps/web/src | grep -v "HeroFigure"`. Expected after Steps 2–3: only `HeroBand.tsx` itself. Delete the `HeroBand` function, its doc comment and the CSS rules only it used (`.band`, `.hero`, `.stats`, `.legend` and the `@media` block). Keep `HeroFigure`, `.figure` and `.label`. Change `.label`'s colour to `--color-text-muted` (AA at 13px).

- [ ] **Step 5: The CSS**

In `accounts.module.css`, delete `.pocketRow`. Change `.titleRow`'s `justify-content` to `flex-start`. Change `.note`'s colour to `--color-text-muted`. Give `.newAccount` the press: `transition: scale var(--motion-press) var(--motion-easing);` and `.newAccount:active { scale: 0.96; }`.

- [ ] **Step 6: Run the gates and look**

Run: `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web test`.
Open `/accounts` at 1440×900. Compare with `?variant=K&page=conti&open=1`. Click an account card, then a goal card, then «Nuovo conto»: each opens its dialog; the grid does not move.

- [ ] **Step 7: Run the Conti end-to-end tests**

Run: `rtk proxy pnpm --filter web e2e accounts-goals`
Expected: PASS after you change the row locators to card links (`getByRole('link', { name: … })`). The card's accessible name is all of its text. Use a regular expression that starts with the account name: `{ name: new RegExp(`^${name}`) }`.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/app/(app)/accounts" apps/web/src/ui/HeroBand.tsx apps/web/src/ui/HeroBand.module.css apps/web/e2e/accounts-goals.spec.ts
git commit -m "feat(web): Conti with Home's head, and accounts and goals as cards"
```

---

# Part H — Profilo and Admin

### Task 22: The sub-navigation takes the sidebar's place (D10)

**Files:**
- Modify: `apps/web/src/ui/SubnavLayout.tsx`, `apps/web/src/ui/SubnavLayout.module.css`

- [ ] **Step 1: The component**

Replace the `SubnavLayout` function in `SubnavLayout.tsx` with:

```tsx
export function SubnavLayout({
  navLabel,
  nav,
  title,
  back,
  children,
}: {
  navLabel: string;
  nav: ReactNode;
  /** Who or what the section is about: the person (Profilo), «Admin» and its count. Wide only. */
  title: ReactNode;
  /** «‹ Saldo»: the way back to the app. Wide only (D10). */
  back: { href: string; text: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className={styles.layout}>
      {/* `data-section-nav`: the shell hides its own sidebar while this one takes its place. */}
      <nav className={styles.subnav} aria-label={navLabel} data-section-nav="">
        <Link className={styles.back} href={back.href} aria-label={back.label}>
          <Icon name="chevL" size={16} />
          {back.text}
        </Link>
        <div className={styles.sideTitle}>{title}</div>
        {nav}
      </nav>
      <div className={styles.section}>{children}</div>
      {/* The column beside the section. `PasskeyList` opens its panel here with `createPortal`. */}
      <div id={PANEL_SLOT} className={styles.slot} />
    </div>
  );
}
```

Add the imports: `import { AppLink as Link } from './AppLink';` and `import { Icon } from './Icon';`. Change the doc comment of the function: `A sub-navigation and the section. On a wide screen the sub-navigation is the sidebar itself (D10, 2026-10-11), with «‹ Saldo» and the section's title above the links; on a narrow one it is a row of links above the section.`

- [ ] **Step 2: The CSS**

Replace the whole `SubnavLayout.module.css` with:

```css
.layout {
  display: grid;
  gap: 24px;
}

.subnav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

/* Narrow: the links alone. The way back is the tab bar; the title is the page's own head. */
.back,
.sideTitle {
  display: none;
}

.separator {
  display: none;
  height: 1px;
  margin: 10px 12px;
  border: 0;
  background: var(--color-border);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--layout-section-gap-web);
  min-width: 0;
}

/*
 * A `PanelSwitch` page (`slot`): its list and its panel take the section's place, so the server
 * renders the panel in place of a portal.
 */
.section:has(> [data-panel-switch]) {
  display: contents;
}

/* D3: a panel in the slot is fixed over the page, so the slot takes no place at any width. */
.slot {
  display: contents;
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  /*
   * D10: the sub-navigation is the sidebar. It sits exactly over the shell's sidebar, which the
   * shell hides (`data-section-nav`), so the section does not move when you enter Profilo.
   */
  .subnav {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 11;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 2px;
    inline-size: var(--layout-sidebar-width);
    padding: 20px 16px;
    border-inline-end: 1px solid var(--color-border);
    background: var(--color-surface);
    transition-property: translate, opacity;
    transition-duration: var(--motion-fade);
    transition-timing-function: var(--motion-easing);
  }

  /* A rare change of place: the links arrive 8px from the trailing side, once, on entering. */
  @starting-style {
    .subnav {
      translate: 8px 0;
      opacity: 0;
    }
  }

  .subnav a {
    width: 100%;
  }

  .back {
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--layout-nav-item-height);
    padding: 0 8px;
    border-radius: var(--radius-input);
    color: var(--color-text-muted);
    font-size: var(--font-size-footnote);
    text-decoration: none;
  }

  .back:hover {
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-raised) 60%, transparent);
  }

  .sideTitle {
    display: block;
    margin: 16px 0 14px;
    padding: 0 10px;
  }

  /* «Esci» and what follows the rule sit at the foot of the column. */
  .separator {
    display: block;
    margin-top: auto;
  }
}

@media (min-width: 1024px) and (prefers-reduced-motion: reduce) {
  @starting-style {
    .subnav {
      translate: 0 0;
    }
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: two errors, in `profile/layout.tsx` and `admin/layout.tsx`: `title` and `back` are missing. Task 23 fixes them.

- [ ] **Step 4: Commit with Task 23** (do not commit a failing typecheck).

### Task 23: Profilo and Admin pass their title and the way back

**Files:**
- Modify: `apps/web/app/(app)/profile/layout.tsx`, `apps/web/app/(app)/profile/profile.module.css`, `apps/web/app/(app)/admin/layout.tsx`, `apps/web/app/(app)/admin/admin.module.css`

- [ ] **Step 1: Profilo**

In `profile/layout.tsx`, pass to `<SubnavLayout …>`:

```tsx
        title={
          <span className={styles.sideWho}>
            <span className={styles.sideAvatar} aria-hidden="true">
              {initials(user.displayName)}
            </span>
            {user.displayName}
          </span>
        }
        back={{ href: '/home', text: t('web.shell.back'), label: t('web.shell.backLabel') }}
```

In `profile.module.css`, add:

```css
.sideWho {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: var(--font-size-headline);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-tight);
}

.sideAvatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-pill);
  background: var(--color-raised);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}
```

In the existing `@media (min-width: 1024px)` block of `profile.module.css`, add `.head { display: none; }`. The sidebar now carries the person (D10).

- [ ] **Step 2: Admin**

In `admin/layout.tsx`, pass:

```tsx
        title={
          <span className={styles.sideTitle}>
            <span className={styles.sideName}>{t('admin.title')}</span>
            <span className={styles.headCount}>
              {plural(t, locale, 'admin.headCount', accounts.length, { name: instance.name })}
            </span>
          </span>
        }
        back={{ href: '/home', text: t('web.shell.back'), label: t('web.shell.backLabel') }}
```

`adminContext(user)` returns `t`. Check that `userI18n` is not needed: the admin layout already has `t` from `adminContext`.

In `admin.module.css`, add:

```css
.sideTitle {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sideName {
  font-size: var(--font-size-headline);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-tight);
}
```

In its `@media (min-width: 1024px)` block, add `.head { display: none; }`.

- [ ] **Step 3: Run the gates**

Run: `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web test`.
Expected: no errors.

- [ ] **Step 4: Look at it**

Open `/profile/preferences` and `/admin/accounts` at 1440×900. Compare with `?variant=K&page=profilo` and `&page=admin`. Check: one sidebar only; «‹ Saldo» at its top goes to `/home`; the links slide in once when you enter, and not when you move between sections; «Esci» is at the foot; the section does not move sideways between `/home` and `/profile`. At 390×844 the row of links stays above the section.

- [ ] **Step 5: Run the Profilo and Admin end-to-end tests**

Run: `rtk proxy pnpm --filter web e2e profile admin shell`
Expected: PASS. The navigation landmark of the sections has the same name as before (`navLabel`). A test that clicks a main tab from inside Profilo must first click «‹ Saldo» (`getByRole('link', { name: t('web.shell.backLabel') })`), because the main sidebar is hidden there.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/ui/SubnavLayout.tsx apps/web/src/ui/SubnavLayout.module.css "apps/web/app/(app)/profile" "apps/web/app/(app)/admin" apps/web/e2e
git commit -m "feat(web): Profilo and Admin take the sidebar's place"
```

---

# Part I — Docs and the final check

### Task 24: The spec of the G2 layout

**Files:**
- Create: `docs/superpowers/specs/2026-10-11-web-g2-layout.html`
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (§17.1.7), `docs/superpowers/specs/2026-10-07-web-panel-feel.html` (the head)

- [ ] **Step 1: Write the spec**

Copy `docs/superpowers/templates/spec-template.html` to `docs/superpowers/specs/2026-10-11-web-g2-layout.html`. Follow «Writing docs» in AGENTS.md (STE, SVG figures with `role="img"` and a `<title>`, the real strings of `en.ts`, the `@saldo/ui` palette). Write these sections:

1. **Scope.** The web layout at and above 1024px. Below 1024px, §17.1.7 stays.
2. **The shell (D1, D2, D10).** Figure: the sidebar, 232px, with its parts; and the section sidebar of Profilo with «‹ Saldo».
3. **The panel is a dialog (D3, D13).** Figure: the page, the scrim and the dialog, 420px with 16px of margin. State diagram: closed → opening (200ms) → open → closing (150ms) → closed; Esc goes closed with no motion. Focus: into the heading on open, trapped while open, back to the row on close.
4. **Home (D4–D6).** An HTML illustration of the head and the three sections. Say that D5 is web only.
5. **Transazioni, Statistiche, Conti (D7–D9, D12).** One illustration each.
6. **Polish (D11).** The values, in a table.
7. **What this replaces.** The panel beside the list (2026-10-07) and «Do not use dialogs» (navigation-feel plan).

Open the file at 1440px and 500px in both themes. Make sure that no text clips and that the console shows no errors.

- [ ] **Step 2: Point the older docs at it**

In the POC spec §17.1.7, add one line at the top of the section: `On the wide-screen layout (sidebar, dialog panels, the G2 pages), docs/superpowers/specs/2026-10-11-web-g2-layout.html wins over this section.`
At the top of `2026-10-07-web-panel-feel.html`, under the title, add a note in the template's note style: `Since 2026-10-11 the panel is a dialog over the page (2026-10-11-web-g2-layout.html, D3). The motion values below still apply.`

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs: the G2 web layout spec, and pointers from the older ones"
```

### Task 25: The roadmap entry

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Add the entry**

Under the last web entry of the phase list, add a section in the style of the others:

```markdown
### Web G2 redesign — sidebar, dialog panels, the G2 pages 🚧 in progress

Plan: `2026-10-11-web-g2-redesign.md`. Spec: `specs/2026-10-11-web-g2-layout.html`.
Mockups: `mockups/2026-10-11-web-home-polish-variants.html?variant=G2`,
`mockups/2026-10-11-web-pages-g2-variants.html?variant=K`.

Acceptance:

- At 1440×900, every page matches its mockup in both themes. The commit bodies list each kept difference.
- No panel moves the page. Esc, ✕ and the scrim close it. Tab stays inside it.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and the Playwright suite pass.
- At 390×844, every page works as before (top bar, tab bar, full-screen panels, bottom-sheet forms).
```

Change `🚧 in progress` to `✅ done` in Task 26, when the acceptance is met.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/README.md
git commit -m "docs: roadmap entry for the G2 redesign"
```

### Task 26: Verification before completion

- [ ] **Step 1: The gates**

Run each one and read the output:

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
rtk proxy pnpm --filter web e2e
```

Expected: no `lint/…` lines and no `× Some errors were emitted`; no type errors; every test passes.

- [ ] **Step 2: The screens**

Build and start on port 3100 (see «Rules»). Sign in with the e2e seed user, or with a user that has budgets, goals, upcoming rows and two periods of history. For each of `/home`, `/transactions`, `/stats`, `/accounts`, `/profile/preferences`, `/admin/accounts`:

1. Take a screenshot at 1440×900, dark and light. Put it beside the mockup.
2. Open a panel where the page has one. Check that the page under the scrim did not move.
3. Take a screenshot at 390×844.

Write every difference that you keep, and why, in the roadmap entry.

- [ ] **Step 3: The keyboard**

On `/transactions`: Tab to a row, press Enter, press Tab five times (the focus stays in the dialog), press Esc (the focus returns to the row). Press ↓ with the dialog open: the next row opens in it. Press N: «Nuova transazione» opens as a dialog.

- [ ] **Step 4: Reduced motion**

Turn on «Reduce motion» in the system settings. Open and close a panel: it fades, it does not slide. Enter Profilo: the links do not slide.

- [ ] **Step 5: Request the review**

Use the **requesting-code-review** skill on the branch. Fix the findings. Then set the roadmap entry to `✅ done` and merge `phase/web-g2-redesign` into `main` when the user accepts.

---

## Self-review notes (for the executor)

- `budgetRowFor` still builds `row` for `/profile/budgets`; Home only reads its helpers now. Do not delete `row`.
- `ListKeys` keeps working while a dialog is open: ↑ ↓ move through the rows behind the scrim and refill the dialog. This is wanted (the J variant's «inspector» behaviour).
- `PasskeyList` portals its panel into the slot. The slot is `display: contents` now, and the panel inside is `position: fixed`, so the portal still works. Check `/profile/passkeys` in Task 23 Step 4.
- If a string in this plan is wrong in Italian or English, fix it in both locale files and say so in the commit body.
