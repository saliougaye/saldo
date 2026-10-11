# Web: navigation shows its state at once, and panels open in place everywhere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A click on a tab, a chip, a period arrow or a search shows feedback in the frame of the click. A page shows its shell and a skeleton while the server works. A panel on Conti, Profilo and Admin opens in place, as on Transazioni.

**Architecture:** The plan has three independent parts. Do them in this order. Part A adds feedback: one `AppLink` reports its pending state to a provider in the `(app)` layout, and `loading.tsx` files add Suspense boundaries. Part B makes the chain of queries before a render shorter. Part C moves the in-place panel of `TransactionsPanels` into a shared controller. Then the other pages use it. Pages stay server components, and the server still renders the data. The change is that the browser shows a result before the data is ready.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2, CSS Modules, Better Auth 1.7, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-web-navigation-feel.html`. On this topic, that spec wins over the POC spec and over this plan. The rules for panel motion, focus and Esc stay in `docs/superpowers/specs/2026-10-07-web-panel-feel.html`. This plan adds no new motion. It applies those rules to more pages.

---

## Why this plan exists

`TODO.md` («Web app: a UI pass») lists five open items. The user made these decisions on 2026-10-11:

- The production region (`fra1::iad1`) is **not** in this plan. A loading state hides the wait. It does not make the wait shorter. Keep the region as its own item in `TODO.md`.
- Keep `next/link`. A plain `<a>` loads the whole page again and removes the mounted shell. The cost is the wait for the server, not the prefetch. No page has a `loading.tsx`, so Next.js has almost nothing to prefetch, and a click shows nothing.
- Do not use dialogs. The panel beside the list is decision §17.1.7 of the POC spec. The type of panel does not cause the slow response.
- Do not move data fetching to client components. A client fetch adds a round trip after the JavaScript loads, and it repeats the query. Use streaming: first the shell and a skeleton, then the data.
- Filters, the period and the search stay navigations. They show a pending state. Only the panels change in place.
- Use the in-place panel on every page that has a panel: Conti, every Profilo section and every Admin section.

## Rules for every task

- **Gates.** Read the output, not the exit code (AGENTS.md «Reading the results»). Run `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck` and `rtk proxy pnpm test`. A clean lint has **no** `lint/…` lines and no `× Some errors were emitted while running checks.`
- To test one package, run `rtk proxy pnpm --filter web test <pattern>`. Before each commit, fix the format with `pnpm exec biome check --write <files>`.
- Port 3000 belongs to another project. Start Saldo on port 3100: `PUBLIC_URL=http://localhost:3100 pnpm --filter web build`, then `cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next start -p 3100`.
- The dev database is the `saldo-dev-postgres` container. Start it with `docker-compose -f apps/web/docker/docker-compose.dev.yml up -d postgres` (the `docker compose` plugin is not installed). Colima must run. See `~/.claude-work/projects/-Users-saliougaye-sandbox-saldo/memory/web-manual-run-recipe.md`.
- Every UI string uses i18n keys in `packages/i18n/src/locales/it.ts` **and** `en.ts`. Also add the key to the other locales that the parity test needs. Do not hard-code a colour, a radius or a size. Use the `@saldo/ui` tokens.
- Commit each task with a Conventional Commit. End each message with the `Co-Authored-By:` line that the session gives.
- Work on the branch `fix/web-navigation-feel`, cut from `main`.

## File structure

| Path (under `apps/web/`) | Action | Responsibility |
| --- | --- | --- |
| `src/ui/AppLink.tsx` | Create | `next/link` with a pending report. The only file that imports the `Link` of `next/link`. |
| `src/ui/NavPending.tsx` | Create | `NavPendingProvider`, `LinkPending`, `useNavTransition`. Keeps the count of pending navigations. It imports `useLinkStatus` from `next/link`. |
| `src/ui/NavPending.module.css` | Create | The progress bar. It shows after a short delay. |
| `src/ui/PageSkeleton.tsx`, `PageSkeleton.module.css` | Create | The block shapes for `loading.tsx`. |
| `app/(app)/{home,transactions,stats,accounts,profile,admin}/loading.tsx` | Create | Suspense boundaries for a change of page. |
| `app/(app)/layout.tsx` | Modify | Mount `NavPendingProvider`. Read «admin» from the session. |
| `src/server/auth/session.ts`, `currentUser.ts`, `admin.ts` | Modify | Read `role` and `banned` from the session user. Remove two queries. |
| `src/server/page/context.ts` | Modify | Start the independent awaits together. |
| `src/ui/usePanelController.ts` | Create | The state machine that is now in `TransactionsPanels`, without the parts specific to Transazioni. |
| `src/ui/panelUrl.ts` + `panelUrl.test.ts` | Create | Pure helpers: the panel key from a query, and «only the panel changes». |
| `src/ui/PanelSwitch.tsx` | Create | Shows one of many panels that the server rendered, in place. |
| `app/(app)/transactions/TransactionsPanels.tsx`, `src/features/transactions/panelState.ts` | Modify | Use the controller. The behaviour does not change. |
| `app/(app)/accounts/page.tsx`, `app/(app)/profile/*/page.tsx`, `app/(app)/admin/*/page.tsx` | Modify | Use `PanelSwitch`. |
| `scripts/measure-nav.ts`, `package.json` | Create, modify | Measures the tab, chip and period navigations, before and after. |

---

# Part A — Feedback in the frame of the click

### Task 1: Measure the baseline

**Files:**
- Read: `apps/web/scripts/measure-panel.ts` (it has `signIn`, `onlyUser`, the cookie and the CPU throttle)
- Create: `apps/web/scripts/lib/devSession.ts`, `apps/web/scripts/measure-nav.ts`
- Modify: `apps/web/scripts/measure-panel.ts`, `apps/web/package.json`

- [x] **Step 1: Branch**

The branch already exists: it holds this plan and its spec. Switch to it with `git switch fix/web-navigation-feel`. Use the command below only if you start again from `main`.

```bash
git switch -c fix/web-navigation-feel main
```

- [x] **Step 2: Move the sign-in helpers**

Move `COOKIE`, `LOCAL_HOSTS`, `onlyUser`, `signIn` and the function that deletes the session from `measure-panel.ts` to `scripts/lib/devSession.ts`. Export them. Import them again in `measure-panel.ts`. Do not change their behaviour. Keep the guard that permits only a local host.

- [x] **Step 3: Write `measure-nav.ts`**

The script opens a signed-in page on a production build. It makes the CPU four times slower. Then it runs four inputs, five times each. For each run, it records two times from the click:

- **feedback**: the first change in `document.body` (attributes, childList, subtree) after the first `pointerdown`.
- **settled**: the first moment when the URL differs from the URL before the click, and `main` holds no `[data-skeleton]`. `PageSkeleton` puts `data-skeleton` on its root. Only Conti has a `main h1`, so a new `h1` cannot be the test for the other tabs.

The code is in `apps/web/scripts/measure-nav.ts`. The sign-in helpers are in `apps/web/scripts/lib/devSession.ts`. Read both files: they are the source. Keep these rules when you change them:

- Call `assertLocalOnly(base)` first. The script signs a person in, so it runs against a local server and a local database only. `openSession` deletes the session in `close`, also after an error and after Ctrl-C.
- The chip selector is `main a[href*="direction=expense"]:visible`. The chip links have no `type=` parameter.
- The probe is a string, so that tsx does not add its `__name` helper to it.
- The app has a Content Security Policy without `unsafe-eval`. `waitForFunction` with a string fails. Pass a function.
- Test «settled» in the `MutationObserver` callback, where «feedback» is stamped. Test it again in each frame, because a URL change is not a DOM mutation. Do not test it only in the frame: that adds up to one frame to «settled» only.
- Do not use `waitForLoadState('networkidle')` after the click. It can return before the navigation starts.

- [x] **Step 4: Add the script**

In the `scripts` of `package.json`, add `"measure:nav": "tsx --env-file-if-exists=.env scripts/measure-nav.ts"`.

- [x] **Step 5: Measure and record**

```bash
docker-compose -f apps/web/docker/docker-compose.dev.yml up -d postgres
PUBLIC_URL=http://localhost:3100 pnpm --filter web build
cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next start -p 3100 &
pnpm --filter web measure:nav http://localhost:3100
```

Expected: four lines. «feedback» is equal to «settled», because nothing shows before the server answers. The first change in the page is the new page itself. Paste the four lines in the «Measurements» section at the end of this file, in the «Before» column.

- [x] **Step 6: Commit**

```bash
git add apps/web/scripts apps/web/package.json docs/superpowers/plans/2026-10-11-web-navigation-feel.md
git commit -m "chore(web): measure-nav script for tab, chip and period navigation"
```

### Task 2: `AppLink` and the pending provider

**Files:**
- Create: `apps/web/src/ui/NavPending.tsx`, `apps/web/src/ui/NavPending.module.css`, `apps/web/src/ui/AppLink.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`. Modify `packages/i18n/src/locales/*.ts` only if `common.loading` is missing. It exists today («Loading…»), and the pages use it.

`useLinkStatus` (from `next/link`) works only in a **child** of the `<Link>`. Thus `AppLink` renders a small child that calls it.

- [x] **Step 1: Write `NavPending.tsx`**

```tsx
'use client';

import { useLinkStatus } from 'next/link';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import styles from './NavPending.module.css';
import { VisuallyHidden } from './VisuallyHidden';

/** A navigation that waits for the server, or a `PageSkeleton` on the screen. */
type Kind = 'navigation' | 'skeleton';
type Report = (kind: Kind, delta: 1 | -1) => void;

const NavPendingContext = createContext<Report>(() => {});

/** The same delay as the bar's `animation-delay` in `NavPending.module.css`. */
const ANNOUNCE_DELAY_MS = 150;

/**
 * Counts what waits for the server: the navigations, and the skeletons on the screen.
 *
 * - A navigation shows a thin bar at the top of the page. The bar waits 150 ms (CSS), so a quick
 *   navigation shows nothing.
 * - A skeleton shows no bar: the skeleton is already the visible feedback.
 * - For both, a screen reader hears «Loading…» after the same 150 ms. The status element stays
 *   mounted, because a live region that arrives with its text is often not read.
 */
export function NavPendingProvider({ label, children }: { label: string; children: ReactNode }) {
  const [counts, setCounts] = useState<Record<Kind, number>>({ navigation: 0, skeleton: 0 });
  const report = useCallback<Report>(
    (kind, delta) => setCounts((current) => ({ ...current, [kind]: current[kind] + delta })),
    [],
  );
  const busy = counts.navigation > 0 || counts.skeleton > 0;
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setAnnounced(true), ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setAnnounced(false);
    };
  }, [busy]);
  return (
    <NavPendingContext value={report}>
      {counts.navigation > 0 ? <div className={styles.bar} aria-hidden="true" /> : null}
      <VisuallyHidden>
        <span role="status">{announced ? label : ''}</span>
      </VisuallyHidden>
      {children}
    </NavPendingContext>
  );
}

/** Adds one to the count of `kind` while `pending` is true, and removes it when it ends or on unmount. */
function useReport(kind: Kind, pending: boolean) {
  const report = useContext(NavPendingContext);
  useEffect(() => {
    if (!pending) return;
    report(kind, 1);
    return () => report(kind, -1);
  }, [kind, pending, report]);
}

/** Rendered inside a `<Link>`: tells the provider while that link's navigation is pending. */
export function LinkPending() {
  useReport('navigation', useLinkStatus().pending);
  return null;
}

/**
 * Rendered inside `PageSkeleton`: the link stops being pending when the skeleton shows, and the
 * skeleton is `aria-hidden`. This keeps «Loading…» for a screen reader until the page replaces it.
 */
export function SkeletonPending() {
  useReport('skeleton', true);
  return null;
}

/**
 * For a navigation that starts from code (`router.push` after a search, a key). Wrap the call in
 * the function this returns: the bar shows until the new page has rendered.
 */
export function useNavTransition(): (action: () => void) => void {
  const [pending, start] = useTransition();
  useReport('navigation', pending);
  return start;
}
```

The status element stays mounted, and only its text changes. A screen reader often does not read a live region that arrives with its text. The first version of this plan mounted the element with the bar. The review of Tasks 2 to 4 added the 150 ms delay of the text and the count of skeletons (`SkeletonPending`, Task 4).

- [x] **Step 2: Write `NavPending.module.css`**

```css
.bar {
  position: fixed;
  inset: 0 0 auto 0;
  height: 2px;
  z-index: 50;
  background: var(--color-accent);
  transform-origin: left;
  opacity: 0;
  /* Nothing for 150 ms, then a bar that grows slowly and never reaches the end. */
  animation:
    bar-in 0s linear 150ms forwards,
    bar-grow 8s cubic-bezier(0.1, 0.6, 0.3, 1) 150ms forwards;
}

@keyframes bar-in {
  to {
    opacity: 1;
  }
}

@keyframes bar-grow {
  from {
    transform: scaleX(0.05);
  }
  to {
    transform: scaleX(0.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    animation: bar-in 0s linear 150ms forwards;
    transform: scaleX(1);
  }
}
```

`--color-accent` exists. `packages/ui/src/css.ts` writes one `--color-*` property for each value of the palette, and the palette has `accent`. Do not add a colour.

- [x] **Step 3: Write `AppLink.tsx`**

```tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { LinkPending } from './NavPending';

/**
 * `next/link` for every link that navigates. It reports its pending state to the bar in the layout.
 * Import `Link` from here, never from `next/link`, except in this file.
 */
export function AppLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}
```

`LinkPending` renders `null`, so it adds no node and no layout.

- [x] **Step 4: Mount the provider**

In `app/(app)/layout.tsx`, put the shell `div` in the provider:

```tsx
import { NavPendingProvider } from '../../src/ui/NavPending';
// …
    <NavPendingProvider label={t('common.loading')}>
      <div className={styles.shell}>
        {/* unchanged */}
      </div>
    </NavPendingProvider>
```

- [x] **Step 5: Write a guard test**

Create `apps/web/src/ui/appLink.test.ts`. It uses the same `sources()` walk as `clientImports.test.ts`. Copy the 10-line helper. Do not export a helper from one test file to another.

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

/**
 * `AppLink` renders `next/link`. `NavPending` imports `useLinkStatus` from it: that hook must be in a
 * client file, and `AppLink` is not one.
 */
const APP_LINK = '/src/ui/AppLink.tsx';
const NAV_PENDING = '/src/ui/NavPending.tsx';

/** The import clauses of every `import … from 'next/link'` in `text`. */
function nextLinkImports(text: string): string[] {
  return [...text.matchAll(/import\s+([^;]*?)\s+from 'next\/link'/g)].map((match) =>
    (match[1] ?? '').replace(/\s+/g, ' '),
  );
}

/** A link that skips `AppLink` never shows the bar. */
describe('links', () => {
  it('import next/link only in AppLink and NavPending', () => {
    const offenders = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'src'))].filter(
      (path) =>
        !path.endsWith(APP_LINK) &&
        !path.endsWith(NAV_PENDING) &&
        /from 'next\/link'/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('take only useLinkStatus from next/link in NavPending', () => {
    const text = readFileSync(join(ROOT, NAV_PENDING), 'utf8');
    expect(nextLinkImports(text)).toEqual(['{ useLinkStatus }']);
  });
});
```

- [x] **Step 6: Run it and see it fail**

Run: `rtk proxy pnpm --filter web test appLink`
Expected: FAIL. `offenders` lists every file that still imports `next/link` (24 files on 2026-10-11).

- [x] **Step 7: Replace the imports**

To find the files, run `grep -rln "^import Link from 'next/link'" apps/web/app apps/web/src`. In each file except `AppLink.tsx`, replace `import Link from 'next/link';` with `import { AppLink as Link } from '<relative path to src/ui/AppLink>';`. Keep the local name `Link`, so the JSX does not change. The same replacement applies to the files in `src/ui`, for example `PanelNav.tsx`, `Panel.tsx` and `NavLink.tsx`. A file outside `src/ui` imports `../../…/src/ui/AppLink`.

A client file can import `AppLink`. `AppLink` has no `'use client'`, and `LinkPending` is the client part. Thus `NavPending.tsx` must import `useLinkStatus` from `next/link`, and the guard test permits that file too. The first version of the test permitted only `AppLink.tsx`.

- [x] **Step 8: Run all gates**

Run: `rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm --filter web test`
Expected: the guard test passes, there are no `lint/…` lines, and all tests pass.

- [x] **Step 9: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): every link reports its pending state to a bar in the shell"
```

### Task 3: Navigations that start from code use the same bar

**Files:**
- Modify: `apps/web/src/ui/SearchField.tsx:59`, `apps/web/src/ui/Panel.tsx:106,110`, `apps/web/src/ui/ListKeys.tsx:66,88`, `apps/web/src/ui/Shortcuts.tsx:21`, `apps/web/app/(app)/accounts/CloseGoal.tsx:74` (`recordExpense`, added after the review)

- [x] **Step 1: Wrap the `router.push` and `router.replace` calls that change the page**

In each file, add `const startNav = useNavTransition();` next to `useRouter()`. Then change the call:

```tsx
// SearchField.tsx, was: router.push(params === '' ? path : `${path}?${params}`);
startNav(() => router.push(params === '' ? path : `${path}?${params}`));
```

Do the same for the calls in `Panel.tsx` (the two `router.push(closeHref)`), `ListKeys.tsx` (the two calls) and `Shortcuts.tsx`. Add `startNav` to the dependency list of the `useEffect` or `useCallback` that calls it. Do not change the `router.replace(afterSave)` of a form after a save. The form has its own busy state.

- [x] **Step 2: Run the gates, then check by hand**

Run the gates of Task 2 step 8. Then start the build on port 3100. In DevTools, set the network throttle to «Slow 4G», so the server answers slowly. Open `/transactions` and type in the search field. Make sure that the bar shows when the server takes more than 150 ms.

On 2026-10-11 a Playwright script did this check. It used `scripts/lib/devSession.ts` to sign in, and CDP `Network.emulateNetworkConditions` (latency 600 ms, 400 kbit/s). The script is not in the repository. For the search, a chip, `E` (ListKeys), Esc on a Conti panel, `N` and a tab, the bar mounted 40 to 140 ms after the input. It showed 150 to 180 ms later, and it disappeared when the URL changed. The status text was «Loading…». With «reduce motion», the bar had the full width.

- [x] **Step 3: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): search, keys and panel close show the navigation bar"
```

### Task 4: `loading.tsx` for a change of page

**Files:**
- Create: `apps/web/src/ui/PageSkeleton.tsx`, `apps/web/src/ui/PageSkeleton.module.css`, a `loading.tsx` in each of `apps/web/app/(app)/home`, `transactions`, `stats`, `accounts`, `profile` and `admin`
- Modify: `apps/web/e2e/transactions.spec.ts` (the toast locator, see step 5)

`loading.tsx` puts the page in a Suspense boundary. The layout stays mounted, so a change of tab shows the shell and the skeleton at once. A change of query on the **same** page (a chip, the period) does not show the skeleton. For that case, the bar of Task 2 shows.

- [x] **Step 1: Write `PageSkeleton.tsx`**

```tsx
import { SkeletonPending } from './NavPending';
import styles from './PageSkeleton.module.css';

/**
 * The shape of a page while the server works: a title line, then blocks. It says nothing about the content.
 * `data-skeleton` is the marker that `scripts/measure-nav.ts` looks for to tell a skeleton from content.
 * `SkeletonPending` (client, renders nothing) keeps «Loading…» for a screen reader while this shows.
 */
export function PageSkeleton({ blocks = 4 }: { blocks?: number }) {
  return (
    <div className={styles.page} aria-hidden="true" data-skeleton="">
      <div className={`${styles.line} ${styles.title}`} />
      {Array.from({ length: blocks }, (_, index) => (
        // The blocks never change order: the index is the identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={index} className={`${styles.line} ${styles.block}`} />
      ))}
      <SkeletonPending />
    </div>
  );
}
```

- [x] **Step 2: Write `PageSkeleton.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.line {
  border-radius: var(--radius-card);
  background: var(--color-raised);
  animation: pulse 1.4s ease-in-out infinite;
}

.title {
  height: 28px;
  width: 40%;
}

.block {
  height: 64px;
}

@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .line {
    animation: none;
  }
}
```

The token names come from `packages/ui/src/tokens.ts`. `radii.card` gives `--radius-card`, and the palette value `raised` gives `--color-raised`. The first version of this plan used `--radius-md` and `--color-surface-2`. These tokens do not exist. Do not add a value.

- [x] **Step 3: Write the six `loading.tsx` files**

> **Caution:** Do not put a `loading.tsx` in `(app)`. The first version of this plan did. That boundary also wraps `admin/layout.tsx`. The `notFound()` of `requireWebAdmin` then streams after the shell, and `/admin` answers 200 to a member. The e2e test «/admin answers not found» found this. A redirect in a page under a boundary (`readPage` to `/onboarding`, `/profile`, `/admin`) also streams. The browser still follows it, but the status is 200, not 307. Thus `next.config.ts` redirects `/profile` and `/admin` with a 307 before any render (see the spec, section 08).

```tsx
// app/(app)/home/loading.tsx, and the same in transactions, stats and accounts
import { PageSkeleton } from '../../../src/ui/PageSkeleton';

export default function Loading() {
  return <PageSkeleton />;
}
```

`profile/loading.tsx` and `admin/loading.tsx` render `<PageSkeleton blocks={3} />`. The sub-navigation of these two layouts stays on the screen, because the layout is above the boundary.

- [x] **Step 4: Check by hand**

Build and start on port 3100. Set the throttle to «Slow 4G». Click Home → Conti. Make sure that the shell and the skeleton show at once, and then the page. In the Network tab, make sure that the prefetch of a tab link is small (no user data).

On 2026-10-11 a Playwright script did this check, with the same throttle as Task 3 step 2. The script is not in the repository. Home → Conti, Home → Profilo, `N`, Profilo → Tag and Admin → Inviti showed the skeleton 70 to 115 ms after the click, and the URL changed at the same time. The page came 0.6 to 4.8 s later. The sub-navigation stayed. The bar did not show, because the navigation ends when the skeleton shows. A chip, a period arrow, the search and `E` showed no skeleton, only the bar. With «reduce motion», the blocks did not pulse. A tab prefetch was 320 to 1,870 bytes and had no account name in it. In headless Chromium, the browser aborted the prefetch requests. Thus the script read the prefetch responses with `fetch` and the same headers.

- [x] **Step 5: Run the gates and commit**

Also run `rtk proxy pnpm --filter web e2e shell transactions`. The shell has an empty `role="status"` element now (Task 2). Thus `getByRole('status')` alone finds two elements. In `transactions.spec.ts`, find the toast with `.filter({ hasText })`, as `e2e/support/auth.ts` does.

```bash
git add -A apps/web
git commit -m "feat(web): loading boundaries show a skeleton while a page loads"
```

### Task 5: Measure Part A

- [x] **Step 1: On a new production build, run `pnpm --filter web measure:nav http://localhost:3100`**

Expected: for the two tab inputs, «feedback» is less than about 50 ms. For the chip and the period inputs, «feedback» is about 150 ms (the bar delay) if «settled» is longer. When «settled» is shorter, «feedback» is about equal to «settled». Paste the lines in the «After A» column.

On 2026-10-11 the numbers are in the «Measurements» section. They are for commit `ce1e8f5d` with the `data-skeleton` marker of commit `2036793c`, and for the two parts together in the «After B» column (commit `e05a4503`).

- [x] **Step 2: Commit the numbers**

```bash
git add docs/superpowers/plans/2026-10-11-web-navigation-feel.md
git commit -m "docs: measurements after part A"
```

---

# Part B — A shorter chain before a page renders

Today a page waits for four steps, one after the other:

1. the session (Better Auth);
2. `isRevoked`, a second read of the user row;
3. `loadUserData`, all the rows of the user;
4. in the layout, `isAdmin`, a third read of the user row.

The layout and the page run in parallel, but each one starts after the session. The admin plugin of Better Auth already puts `role` and `banned` on `session.user`. `getSession` reads the database on each call, because the app sets no cookie cache. Thus the two extra reads give no fresher answer.

### Task 6: Read `role` and `banned` from the session

**Files:**
- Modify: `apps/web/src/server/auth/session.ts`, `apps/web/src/server/auth/auth.ts`, `apps/web/app/api/me/route.ts`, `apps/web/src/server/auth/admin.ts`, `apps/web/src/server/page/context.ts`, `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/profile/layout.tsx`, `apps/web/app/(app)/profile/connectors/page.tsx`
- Test: `apps/web/src/server/auth/session.test.ts` (new). The tests that existed revoke with `revokeUser`. That function also deletes the session rows, so these tests pass without a ban check in `authenticate`.

- [x] **Step 1: Count the queries now (a temporary patch: do not commit it)**

In `src/server/db/client.ts`, in `getDb`, add these lines after `pool = new Pool(...)`:

```ts
const original = pool.query.bind(pool);
let n = 0;
// biome-ignore lint/suspicious/noExplicitAny: throwaway counter
(pool as any).query = (...args: any[]) => {
  console.log(`[q${++n}]`, String(typeof args[0] === 'string' ? args[0] : args[0]?.text).slice(0, 60));
  return (original as any)(...args);
};
```

Run `next start` and load `/transactions` one time. Count the lines. Write the count and the statements in «Queries per request on `/transactions`: before». Then run `git checkout apps/web/src/server/db/client.ts`.

Task 1 measured this on the code of commit `1d008060` (the count is the same in two runs). A request after the first one runs five queries:

- the session row;
- the user row of the session;
- `select "banned"` (`isRevoked`);
- the `sync_rows` of the user (`loadUserData`);
- `select "role", "banned"` (`isAdmin`, in the layout).

The first request after a start runs two more: an OAuth client read and the update of the session. Count a request after the first one. Tick this box when you have measured it on the code before step 3.

- [x] **Step 2: Write the failing test**

Find the test file for `authenticate` with a banned user: `grep -rn "banned" apps/web --include=*.test.ts -l`. It can be `adminPlugin.test.ts` or another file. In it, add a test: the session of a banned user reads as signed out **without** a call to `isRevoked`. If the file mocks the database, assert on the result only: `authenticate(headersOfBannedUser)` returns `null`. A test of this type can exist already. It must stay green after step 3. If no such test exists, add this test:

```ts
it('reads a banned account as signed out (§10)', async () => {
  const { headers, userId } = await signedInHeaders();
  await banUser(userId);
  expect(await authenticate(headers)).toBeNull();
});
```

Use the helpers for «signed in» and «ban» that the file already has.

On 2026-10-11 no such test existed. `src/server/auth/session.test.ts` has three tests. Two set `banned` on the user row and keep the session rows, then call `authenticate` with the bearer and with the cookie. Both must return `null`. The third test checks that `authenticate` gives `role`. It failed before step 3. When the ban check was removed for a test run, the two ban tests failed. These tests send no `session_data` cookie, so they do not prove that there is no cookie cache. After the review, a fourth test checks the settings: `buildAuthOptions()` has no `session.cookieCache` and no `secondaryStorage`, and the `$context` of the instance has no enabled cookie cache. With `cookieCache: { enabled: true }` in `auth.ts` for one run, it failed.

- [x] **Step 3: Change `authenticate`**

```ts
export interface AuthenticatedUser {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  /** `ADMIN_ROLE` or the member role, from the same read as the session. */
  role: string | null;
}

export async function authenticate(headers: Headers): Promise<AuthenticatedUser | null> {
  const session = await auth().api.getSession({ headers });
  if (session === null) return null;
  // `banned` and `role` come from the admin plugin, in the same read as the session: no second query.
  if (session.user.banned === true) return null;
  return {
    id: session.user.id,
    displayName: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    role: session.user.role ?? null,
  };
}
```

Remove the `isRevoked` and `getDb` imports from `session.ts` if no other code in the file uses them. `tsc` can say that `banned` or `role` does not exist on `session.user`. In that case, use the inferred type of the admin plugin (`auth().$Infer.Session.user`). Do not use `any`.

On 2026-10-11 `tsc` said this, and `auth().$Infer.Session.user` also had no `role`. The cause is in `auth.ts`: `buildAuthOptions` returns the plugins as an array of their union. `betterAuth` infers the fields of the plugins only from a tuple. The fix is a helper in `auth.ts`:

```ts
function pluginTuple<const T extends BetterAuthPlugin[]>(...plugins: T): T {
  return plugins;
}
// in buildAuthOptions: plugins: pluginTuple(passkey(…), …, nextCookies()),
```

`getSession` reads the database on every call. `auth.ts` sets no `session.cookieCache` and no `secondaryStorage`. In better-auth 1.7.7, `getSession` uses the cookie cache only when `cookieCache.enabled === true`. The query count of step 6 shows the session row and the user row on each request.

- [x] **Step 4: Add `isAdminUser` and use it in the layout**

In `src/server/auth/admin.ts`, keep `isAdmin(db, userId)`. Server Actions and `requireWebAdmin` call it, and a mutation must not trust an old read. Add:

```ts
/** For a page render: the role was read with the session. */
export function isAdminUser(user: { role: string | null }): boolean {
  return user.role === ADMIN_ROLE;
}
```

In `app/(app)/layout.tsx`, replace `Promise.all([isAdmin(getDb(), user.id), userI18n(user.id)])` with:

```tsx
const admin = isAdminUser(user);
const { t } = await userI18n(user.id);
```

Do the same in `app/(app)/profile/layout.tsx`. There the call is `Promise.all([userI18n(user.id), isAdmin(getDb(), user.id)])`.

`app/api/me/route.ts` sent the whole `AuthenticatedUser`. It now names its four fields, so that the response to the phone does not get `role`. `app/api/me/route.test.ts` found this.

`profile/connectors/page.tsx` also called `isAdmin(getDb(), user.id)` in its render, for a notice. It now calls `isAdminUser(user)`. For this, `readPage` gives `role` in `PageContext.user`.

- [x] **Step 5: Run the tests**

Run: `rtk proxy pnpm --filter web test auth`
Expected: PASS. This includes the revocation test and every `requireWebAdmin` test.

- [x] **Step 6: Count again, then commit**

Do step 1 again. Expected: two statements fewer. Write the count in «Queries per request on `/transactions`: after». Remove the temporary patch.

```bash
git add -A apps/web
git commit -m "perf(web): read role and banned with the session, not in two more queries"
```

### Task 7: Start independent work together

**Files:**
- Modify: `apps/web/src/server/page/context.ts`, `apps/web/app/(app)/transactions/page.tsx:125`

- [x] **Step 1: Change `readPage`**

`searchParams` does not depend on the user. Start it together with the session. Keep the order only where one result is the input of the next:

```ts
export async function readPage(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<PageContext> {
  const [user, rawParams] = await Promise.all([requireWebUser(), searchParams]);
  const [data, i18n] = await Promise.all([loadUserData(user.id), userI18n(user.id)]);
  if (data.settings === null) redirect('/onboarding');
  const params = narrowParams(rawParams);
  return {
    ...pageState({ data, now: new Date(), fallbackTimeZone: env().defaultTimeZone, params }),
    ...i18n,
    user: { id: user.id, displayName: user.displayName, email: user.email },
    data,
    params,
  };
}
```

`userI18n` awaits the same cached `loadUserData`, so it adds no query. `Promise.all` for these two only removes a microtask gap.

- [x] **Step 2: Start the extra read of the page earlier**

In `transactions/page.tsx`, `loadRow` for `?deleted=` waits for all of `readPage`. It needs only the user id. Read the page file near line 125. If the function awaits another read, start `loadRow` together with it in a `Promise.all`, as soon as `page.user.id` is known. On 2026-10-11 the function has no other await after `readPage`. In that case, keep the code: one await after `readPage` is correct. This plan does not invent a change.

On 2026-10-11 this was still true: `loadRow` is the only await after `readPage`, and it needs `?deleted=` from the narrowed query. `transactions/page.tsx` did not change.

- [x] **Step 3: Run the gates, measure, commit**

Run the gates. Run `measure:nav` and paste the lines in the «After B» column.

On 2026-10-11 the commit of this task did not include the «After B» column. The measurement runs with Task 5, on one build for Part A and Part B. The e2e specs `auth`, `shell` and `transactions` passed after this step.

```bash
git add -A apps/web
git commit -m "perf(web): readPage starts the session and the query together"
```

---

# Part C — The panel opens in place on every page

`TransactionsPanels` holds a state machine that is not specific to transactions. It keeps the URL as the state through `history.pushState`. It keeps the list of the URLs that it wrote. It plays the exit for 150 ms. It moves the focus back to the opener. Part C moves this state machine into a hook. Then a page gives a **map of panels**. Each page renders the body of every panel on the server, as Transazioni does with `details`. A click only selects the panel to show.

**Out of scope:** a form that needs data that only the server can calculate for one row. An example is the edit form of a transaction, which needs the balances of the row. It stays a navigation, as `edit` does in `TransactionsPanels` today. The edit form of an account gets the same rule if `accountFormView()` needs the balances. Step 2 of Task 13 tells how to decide.

### Task 8: Pure helpers for a panel key

**Files:**
- Create: `apps/web/src/ui/panelUrl.ts`, `apps/web/src/ui/panelUrl.test.ts`

A **panel key** is the string that names what the URL opens: `new`, `tag:ID`, `account:ID`, `archived`. A page declares which parameters carry the key.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { panelHrefFor, panelKeyFromSearch, panelOnlyChange } from './panelUrl';

const TAGS = { flags: ['new'], values: ['tag'] } as const;

describe('panelKeyFromSearch', () => {
  it('reads a flag, then a value, flag first', () => {
    expect(panelKeyFromSearch(new URLSearchParams('new'), TAGS)).toBe('new');
    expect(panelKeyFromSearch(new URLSearchParams('tag=abc'), TAGS)).toBe('tag:abc');
    expect(panelKeyFromSearch(new URLSearchParams('tag=abc&new'), TAGS)).toBe('new');
    expect(panelKeyFromSearch(new URLSearchParams(''), TAGS)).toBeNull();
    expect(panelKeyFromSearch(new URLSearchParams('tag='), TAGS)).toBeNull();
  });
});

describe('panelOnlyChange', () => {
  const here = { pathname: '/profile/tags', search: new URLSearchParams('') };
  it('opens in place when only the panel parameters change', () => {
    expect(panelOnlyChange(here, '/profile/tags?tag=abc', TAGS)).toEqual({ key: 'tag:abc' });
    expect(panelOnlyChange(here, '/profile/tags', TAGS)).toEqual({ key: null });
  });
  it('is a navigation for another path, another filter or a fragment', () => {
    expect(panelOnlyChange(here, '/profile/budgets?new', TAGS)).toBeNull();
    expect(panelOnlyChange(here, '/profile/tags?q=x&tag=abc', TAGS)).toBeNull();
    expect(panelOnlyChange(here, '/profile/tags#x', TAGS)).toBeNull();
    expect(panelOnlyChange(here, 'https://example.com/profile/tags', TAGS)).toBeNull();
  });
});

describe('panelHrefFor', () => {
  it('writes a key back as a URL on the base', () => {
    expect(panelHrefFor('/profile/tags', 'tag:a b', TAGS)).toBe('/profile/tags?tag=a+b');
    expect(panelHrefFor('/profile/tags', 'new', TAGS)).toBe('/profile/tags?new=');
    expect(panelHrefFor('/profile/tags?q=x', null, TAGS)).toBe('/profile/tags?q=x');
  });
});
```

- [x] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter web test panelUrl`
Expected: FAIL, because `panelUrl` does not exist.

- [x] **Step 3: Write `panelUrl.ts`**

```ts
/** Which query parameters choose a panel: a flag (`?new`) or a value (`?tag=ID`). Flags win. */
export interface PanelParams {
  readonly flags: readonly string[];
  readonly values: readonly string[];
}

const ORIGIN = 'http://panel.invalid';

/** What the query opens: `new`, `tag:ID`, or null for no panel. */
export function panelKeyFromSearch(search: URLSearchParams, params: PanelParams): string | null {
  for (const flag of params.flags) if (search.has(flag)) return flag;
  for (const name of params.values) {
    const value = search.get(name);
    if (value !== null && value !== '') return `${name}:${value}`;
  }
  return null;
}

const panelNames = (params: PanelParams) => new Set([...params.flags, ...params.values]);

/** Every parameter that is not the panel's, in an order that does not depend on the URL's. */
function listKey(search: URLSearchParams, params: PanelParams): string {
  const own = panelNames(params);
  return [...search]
    .filter(([name]) => !own.has(name))
    .map((pair) => JSON.stringify(pair))
    .sort()
    .join(',');
}

/**
 * The panel `href` opens when going there changes nothing but the panel: the same path, the same
 * filters. `null` for anything else, which is a navigation.
 */
export function panelOnlyChange(
  current: { pathname: string; search: URLSearchParams },
  href: string,
  params: PanelParams,
): { key: string | null } | null {
  const target = new URL(href, ORIGIN);
  if (target.origin !== ORIGIN || target.hash !== '') return null;
  if (target.pathname !== current.pathname) return null;
  if (listKey(target.searchParams, params) !== listKey(current.search, params)) return null;
  return { key: panelKeyFromSearch(target.searchParams, params) };
}

/** `base` with the panel `key` open. A key of `null` gives the base with no panel parameter. */
export function panelHrefFor(base: string, key: string | null, params: PanelParams): string {
  const url = new URL(base, ORIGIN);
  for (const name of panelNames(params)) url.searchParams.delete(name);
  if (key !== null) {
    const split = key.indexOf(':');
    if (split === -1) url.searchParams.set(key, '');
    else url.searchParams.set(key.slice(0, split), key.slice(split + 1));
  }
  const query = url.searchParams.toString();
  return query === '' ? url.pathname : `${url.pathname}?${query}`;
}
```

On 2026-10-11 the code got one more field: `PanelParams.order`. Conti and Categories let a value win over the flag `archived`. A fixed rule «flags first» cannot keep that meaning. `order` lists the names, first the one that wins. Names that `order` does not list come after it, flags first. The test file has one more test for `order`, with the parameters of Conti. Each page gives `order` only when its own precedence is not «flags first». The code in `apps/web/src/ui/panelUrl.ts` is the reference.

- [x] **Step 4: Run the tests, then commit**

Run: `rtk proxy pnpm --filter web test panelUrl`
Expected: PASS.

```bash
git add apps/web/src/ui/panelUrl.ts apps/web/src/ui/panelUrl.test.ts
git commit -m "feat(web): pure helpers that name a panel from the query"
```

### Task 9: Move the controller out of `TransactionsPanels`

**Files:**
- Create: `apps/web/src/ui/usePanelController.ts`
- Modify: `apps/web/app/(app)/transactions/TransactionsPanels.tsx`
- Test: `apps/web/e2e/transactions.spec.ts` (must stay green), `apps/web/src/features/transactions/panelState.test.ts`

This task changes no behaviour. It only moves code.

- [x] **Step 1: Run the end-to-end suite of Transazioni first**

Run: `rtk proxy pnpm --filter web e2e transactions`
Expected: PASS. If it fails on `main` already, stop and report. The move needs a green baseline.

On 2026-10-11 the run `e2e transactions shell` on commit `46213201` gave 16 passed: the setup, 8 `shell` tests and 7 `transactions` tests.

- [x] **Step 2: Create `usePanelController.ts`**

Give it a generic `S` (the panel state) and this input:

```ts
export interface PanelConfig<S> {
  /** What a query opens. */
  parse: (search: URLSearchParams) => S;
  same: (a: S, b: S) => boolean;
  isNone: (state: S) => boolean;
  none: S;
  /** The state `href` opens when only the panel changes, or null for a navigation (and for a form the page cannot show in place). */
  onlyChange: (current: { pathname: string; search: URLSearchParams }, href: string) => S | null;
  exitMs?: number;
}
```

Move these parts into the hook. Do **not** change them, with these exceptions: `panelFromSearch` → `config.parse`, `samePanel` → `config.same`, `panelOnlyChange` → `config.onlyChange`, `NONE` → `config.none`, and `next.kind === 'none'` → `config.isNone(next)`.

- `View`, without `draft`. `draft` stays in `TransactionsPanels`. It gets it from the `onChange` callback of the controller (see below).
- `searchOf`, `locationQuery`.
- The refs `seen`, `written`, `opener`, `returnTo`, `side`.
- `track`, `follow`, the `useLayoutEffect` on `search`, the `popstate` effect, `go`.
- The effect that plays the exit (`EXIT_MS`).
- The effect that moves the focus back.

The hook returns `{ view, go, shown, side, closeToList }`, where `shown = view.closing ? config.none : view.panel`.

For `draft`, accept an optional `onChange?: (previous: S, next: S) => void` in the config. `TransactionsPanels` uses it to increase its counter when `previous.kind === 'new'` and `next.kind !== 'new'`. The hook calls it from the places where `draftAfter` runs today: `follow`, `go` and the exit effect.

On 2026-10-11 the code differs from this step in these points:

- The config has no `onChange`. It has `spends?: (previous: S, next: S) => boolean`, and the view has an `epoch` counter. The three updaters (`follow`, `go` and the exit timer) add 1 to `epoch` when `spends(current.panel, next)` is true. `TransactionsPanels` uses `view.epoch` as the key of the new form, and has no `draft` state of its own.
- The first version called `onChange` before `setView`, with `previous` from the committed view. That is not equivalent. Example: a pointer close of «Nuova» plays its exit, and N comes 1 ms before the 150 ms timer. The timer then reads a committed view that is still closing, and starts a new draft in a form that is open again (decision 7). In the updaters, the decision reads the latest state.
- `onlyChange` returns `{ state: S } | null`. `null` is a navigation, and a close is `{ state: none }`. With `S | null`, the close of `PanelSwitch` (`S = string | null`) was a navigation.
- The hook returns `{ view, viewRef, go, shown, side }`. `closeToList` stays in `TransactionsPanels`, because it needs `baseHref`, which the config does not have. `viewRef` is the committed view: the `NEW_TRANSACTION_EVENT` handler reads it.
- The hook keeps the config in a ref, so `go` and `follow` keep their identity when a page gives a new config on each render.

- [x] **Step 3: Write `TransactionsPanels` again on top of the hook**

Keep these parts: the `Activity` for the new form, `ListKeys`, the `NEW_TRANSACTION_EVENT` effect, `PanelNavContext`, and the `content` and `editing` branches. Replace all the code that step 2 moved with `const controller = usePanelController<PanelState>({ parse: panelFromSearch, same: samePanel, isNone: (s) => s.kind === 'none', none: NONE, onlyChange: (cur, href) => { const next = panelOnlyChange(cur, href); return next === null || next.kind === 'edit' ? null : next; }, onChange: … })`. The `edit` exception moves into `onlyChange`.

- [x] **Step 4: Run the gates and the end-to-end suite**

Run: `rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm --filter web test && rtk proxy pnpm --filter web e2e transactions`
Expected: all pass, with the same numbers as step 1. `TransactionsPanels.tsx` is about 150 lines shorter.

On 2026-10-11 `e2e transactions shell` gave 16 passed again. `TransactionsPanels.tsx` went from 378 to 216 lines. No e2e test covers the draft of the new form. A temporary spec checked it on both builds, with the same result: a close by ✕ or Esc starts a new draft, an opening during the exit keeps the draft, Esc gives the focus back to «Nuova», and Back closes the form.

- [x] **Step 5: Commit**

```bash
git add -A apps/web
git commit -m "refactor(web): the in-place panel state machine is a hook, not part of Transazioni"
```

### Task 10: `PanelSwitch`

**Files:**
- Create: `apps/web/src/ui/PanelSwitch.tsx`
- Modify: `apps/web/src/ui/SlotPanel.tsx`

`PanelSwitch` is the shared client component. A page gives it the bodies of all its panels, which the server rendered.

- [x] **Step 1: Write `PanelSwitch.tsx`**

```tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode } from 'react';
import { type CloseFrom, Panel } from './Panel';
import { PanelNavContext } from './PanelNav';
import { type PanelParams, panelHrefFor, panelKeyFromSearch, panelOnlyChange } from './panelUrl';
import { usePanelController } from './usePanelController';
import { SlotPortal } from './SlotPanel';

export interface PanelSpec {
  title: string;
  body: ReactNode;
  /** Below the breakpoint, a bottom sheet (a form) and not the whole screen. */
  sheet?: boolean;
  /** The body carries its own heading. */
  bare?: boolean;
  /** Where ✕ and Esc go from this panel, as a key. Default: no panel. */
  closeTo?: string | null;
}

interface Props {
  /** The page's URL with no panel: its own path and filters. */
  baseHref: string;
  params: PanelParams;
  /** Every panel the page can show, by key. A key with no entry opens nothing. */
  panels: Record<string, PanelSpec>;
  closeLabel: string;
  /** The page's list: the rows' links are `PanelLink`s, which read the controller. */
  children?: ReactNode;
  /** `slot`: render into the `#profile-panel` slot of a `SubnavLayout`. Otherwise render in place. */
  slot?: boolean;
}

/**
 * One panel at a time, chosen by the query, changed in the frame of the click. A key that is in
 * the URL on the first render opens with the page. Rows must be `PanelLink`s with a `selectId` equal
 * to the key's value.
 */
export function PanelSwitch({ baseHref, params, panels, closeLabel, children, slot = false }: Props) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const controller = usePanelController<string | null>({
    parse: (query) => panelKeyFromSearch(query, params),
    same: (a, b) => a === b,
    isNone: (key) => key === null,
    none: null,
    onlyChange: (current, href) => {
      const next = panelOnlyChange(current, href, params);
      return next === null || (next.key !== null && panels[next.key] === undefined) ? null : next.key;
    },
  });
  void pathname;
  void search;

  const key = controller.view.panel;
  const spec = key === null ? undefined : panels[key];
  const selectedKey = controller.view.closing ? null : key;
  const selectedId = selectedKey?.includes(':') ? selectedKey.slice(selectedKey.indexOf(':') + 1) : null;
  const closeHref = panelHrefFor(baseHref, spec?.closeTo ?? null, params);
  const onClose = (from: CloseFrom) =>
    controller.go(closeHref, { instant: from === 'key' });

  const panel =
    spec === undefined ? null : (
      <Panel
        key={key ?? 'none'}
        title={spec.title}
        sheet={spec.sheet}
        bare={spec.bare}
        closeHref={closeHref}
        closeLabel={closeLabel}
        onClose={onClose}
        closing={controller.view.closing}
        instant={controller.view.instant}
      >
        {spec.body}
      </Panel>
    );

  return (
    <PanelNavContext value={{ selectedId, go: controller.go }}>
      {children}
      {slot ? <SlotPortal>{panel}</SlotPortal> : panel}
    </PanelNavContext>
  );
}
```

After Task 9, `usePanelController` calls `usePathname` and `useSearchParams` itself, because `follow` needs them. Thus delete the two `void` lines and the unused `pathname` and `search` reads. The sketch shows them only to show the dependency. Do not keep unused variables (Biome `noUnusedVariables`).

On 2026-10-11 the code differs from the sketch in these points. The code in `apps/web/src/ui/PanelSwitch.tsx` is the reference.

- `parse` reads a key with no entry in `panels` as no panel. Thus a URL with an unknown id opens nothing. `onlyChange` returns null for such a key, so its link navigates.
- The render reads the key through `panels` again. A refresh can remove the open key from `panels` (a deleted row) while the URL keeps it. Then no panel shows and no row is selected.
- `selectedId` is the whole key of `shown` (`tag:ID`), so no row is selected while the exit plays, as on Transazioni. A row gives its whole key as `selectId`. Thus `a:ID` and `g:ID` on Conti do not select the same row.
- The `PanelNav` value is in `useMemo`, and `onClose` is in `useCallback`. `Panel` subscribes Esc through `onClose`, so it must keep its identity.
- The `key` of `Panel` is its shape: `'form'` for a sheet, `'detail'` for the other panels. The panel key is the `key` of a `Fragment` around the body. Thus the panel stays put while the selection moves between rows, as the 2026-10-07 spec says, and the body of each row is a new form. The sketch above puts the panel key on `Panel`. That replays the entrance at each click on a row.

- [x] **Step 2: Split `SlotPanel` so that other components can use the portal**

In `SlotPanel.tsx`, export a `SlotPortal({ children })` that does the `useState`/`useEffect`/`createPortal` part. Make `SlotPanel` render `<SlotPortal><Panel {...props} /></SlotPortal>`. The behaviour does not change for the sections that still use `ProfilePanel`.

On 2026-10-11 the review found a problem with the portal in `PanelSwitch`. A portal renders nothing on the server and on the hydration render. Thus a load of `?tag=ID` painted the page without the panel, then the column appeared, and the panel slid in. With JavaScript off the panel never showed. `PanelSwitch` with `slot` does not use `SlotPortal` now:

- It renders `<div data-panel-switch>` with the list and `<div>` with the panel. In `PanelSwitch.module.css` they use `composes` on `.section` and `.slot` of `SubnavLayout.module.css`.
- In `SubnavLayout.module.css`, `.section:has(> [data-panel-switch])` is `display: contents`. Thus the two elements take the section column and the slot column of the layout grid, and the server renders the panel.
- `PanelSwitch` must be the only child of the section. Only providers that render no element can be above it. A development build writes a `console.error` when the section has another child or is not `display: contents`.
- A browser without `:has` (Firefox before 121) gets `display: contents` on the section from a layout effect. The effect removes it when the page unmounts, because the section belongs to the layout.
- At 1024px and more, the panel's column has `align-self: stretch`, as on Transazioni. Thus the panel stays sticky beside a long list. Below 1024px the column is `display: contents`, so it adds no row to the grid. The column is an element also without `slot`, because the controller reads it to give the focus back.
- `Panel.module.css` gave a sheet `inset: auto` at 1024px and more, and that removed its `top`. Thus no form was sticky, also on Transazioni. The rule now sets `top` again.
- When a refresh removes the open key from `panels` and the URL keeps it, an effect replaces the URL with the URL of the close.
- The pages that still use `SlotPanel` keep the portal. Nothing matches the new rule on these pages, so they do not change. After Task 14 no page uses `SlotPanel`, and it is deleted.

- [x] **Step 3: Run the gates and commit**

Run the gates. No page uses `PanelSwitch` yet, so only the types and the lint check it.

On 2026-10-11 the e2e specs `profile` and `budgets-categories-tags` passed after the split of `SlotPanel` (15 passed).

```bash
git add -A apps/web
git commit -m "feat(web): PanelSwitch shows one server-rendered panel in place, chosen by the query"
```

### Task 11: Profilo → Tag, the worked example

**Files:**
- Modify: `apps/web/app/(app)/profile/tags/page.tsx`
- Test: `apps/web/e2e/budgets-categories-tags.spec.ts`

The server renders one form for each tag, and one form for «Nuovo tag». A click selects one.

- [x] **Step 1: Run the e2e flows of the tags first (baseline)**

Run: `rtk proxy pnpm --filter web e2e budgets-categories-tags`
Expected: PASS.

- [x] **Step 2: Change the page**

Replace the `creating`/`editing`/`open` block and the `ProfilePanel` with a map. The links of the rows become `PanelLink`s, so a plain click goes to the controller. The props that all the forms share go once to a provider above `PanelSwitch` (see «The size of the response» in Task 12). A body gets only the props of its own row. The code in `apps/web/app/(app)/profile/tags/page.tsx` and `TagForm.tsx` is the reference:

```tsx
// TagForm.tsx: the props that every form shares, given once.
export interface TagFormSharedValue {
  tags: readonly { id: string; name: string }[];
  locale: AppLocale;
  messages: TagMessages;
  closeHref: string;
  afterSave: string;
}
const shared = sharedProps<TagFormSharedValue>('TagForm');
export const TagFormShared = shared.Provider;
// TagForm({ tag, transactionsHref }) reads the rest with `shared.useShared()`.
```

```tsx
// page.tsx
import { PanelLink } from '../../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../../src/ui/PanelSwitch';
import { TagForm, TagFormShared, type TagFormSharedValue } from './TagForm';

const PANEL_PARAMS = { flags: ['new'], values: ['tag'] } as const;
// … inside ProfileTagsPage, after `const rows = tagsView(page.data);`
const shared: TagFormSharedValue = {
  tags: rows.map((row) => ({ id: row.id, name: row.name })),
  locale,
  messages: tagMessages(catalogs[locale]),
  closeHref: PATH,
  afterSave: PATH,
};
const panels: Record<string, PanelSpec> = {
  new: {
    title: t('tags.newTag'),
    sheet: true,
    body: <TagForm tag={null} transactionsHref={null} />,
  },
  ...Object.fromEntries(
    rows.map((row): [string, PanelSpec] => [
      `tag:${row.id}`,
      {
        title: t('tags.editTag'),
        sheet: true,
        body: (
          <TagForm
            tag={row}
            transactionsHref={`/transactions?tag=${encodeURIComponent(row.id)}`}
          />
        ),
      },
    ]),
  ),
};

return (
  <TagFormShared value={shared}>
    <PanelSwitch baseHref={PATH} params={PANEL_PARAMS} panels={panels} closeLabel={t('common.close')} slot>
      <Section /* unchanged, but: */>
        {/* the «Nuovo tag» link and each row's link use PanelLink, with selectId={`tag:${row.id}`} on the rows */}
      </Section>
    </PanelSwitch>
  </TagFormShared>
);
```

The provider renders no element, so `PanelSwitch` stays the only child of the section.

`ListRow` already takes `href` and `selected`, and it renders a `PanelLink` (`src/ui/ListRow.tsx` imports it). The rows give `selectId` through the `PanelNavContext`, as the rows of Transazioni do. Read `ListRow.tsx`. Pass the whole key of the row: `selectId={`tag:${row.id}`}`. `PanelSwitch` compares `selectId` with the whole key, not with the id only. For the «Nuovo tag» link, use `<PanelLink href={`${PATH}?new`} className={styles.newTag}>`.

`afterSave` and `closeHref` stay `PATH`. A save is still a navigation (`router.replace(afterSave)`), so the list shows the new name. This is the rule «a save is a navigation».

On 2026-10-11 the work found these points. Tasks 12 to 14 use the same rules.

- «Annulla» of `FormFoot` was a plain link, so it closed the panel with a request to the server. `FormFoot` now renders `PanelLink`. In a `PanelSwitch`, «Annulla» closes in place. Outside a panel in client state, `PanelLink` is the same link as before.
- The `TagForm` elements have no `key`. `PanelSwitch` puts the panel key on the body, so each tag already gets a new form.
- `MergeTag` and `DeleteTag` stay navigations: `router.push(afterHref)` and `router.refresh()`, with `afterHref` equal to `PATH`. The URL then has no panel parameter, so the controller closes the panel. The e2e tests of merge and delete pass from the panel in place.
- The page does not read `params` now. `PanelSwitch` reads the query.
- A `PanelLink` in a `PanelNavContext` gives `prefetch={false}` to its link. The controller opens it in place, so a prefetch loads a page that nobody asks for. Next.js prefetches each visible link again after each `router.refresh`. On 2026-10-11 a production build gave these counts of `next-router-prefetch` requests: after a save on `/profile/tags` (3 tags), 18 before and 14 after; on a load of `/profile/categories`, 32 before and 28 after. The other prefetches are the links of the top bar and the subnav. A click on a row of Transazioni still opens in place, and «Modifica» still navigates.

- [x] **Step 3: Run the e2e suite and check by hand**

Run: `rtk proxy pnpm --filter web e2e budgets-categories-tags`
Expected: PASS.

Then open `/profile/tags` and click a tag. Make sure that:

- the form shows in the frame of the click;
- the URL changes to `?tag=ID`;
- Back closes the form;
- a reload with `?tag=ID` opens the page with the panel;
- the Network tab shows no request for the click.

On 2026-10-11 a temporary Playwright spec on a production build (port 3100, 1440px) gave these results:

- A click on a tag shows the panel in the next frame. The URL is `?tag=ID`, and the browser sends no RSC request. The row has `aria-current="true"`.
- A click on a second tag keeps the same `aside` element, with no running animation. The form shows the name of the second tag.
- ✕, Esc and «Annulla» close with no RSC request. After ✕ and Esc the focus is on the row that opened the panel. Back closes the panel.
- «Nuovo tag» opens `?new` with no RSC request, and the focus is in the name field. A click with ⌘ opens the tag in a new tab.
- A load of `?tag=ID` opens the page with the panel. A save goes to `/profile/tags`, and the list shows the new name.
- The screenshots of `/profile/tags`, `/profile/tags?tag=ID` and `/profile/budgets` are the same, pixel for pixel, before and after the change (1440px and 500px, light and dark).
- With JavaScript off, the HTML of `?tag=ID` holds the panel and its form. But the browser shows the skeleton of `profile/loading.tsx` (Task 4): Next streams the page into a hidden element, and only a script shows it. This is true for every page with a `loading.tsx`, not only for the panel.

- [x] **Step 4: Run the gates and commit**

```bash
git add -A apps/web
git commit -m "feat(web): Profilo → Tag opens its panel in place"
```

### Task 12: The other Profilo sections

**Files:** one `page.tsx` for each row. Each row is Task 11 with these parameters. Do one section in each commit. Run the e2e flow of the section before and after the change.

The table gives the parameters that each page reads on 2026-10-11.

| Page | `flags` | `values` | Panels (key → body) | Stays a navigation |
| --- | --- | --- | --- | --- |
| `profile/categories/page.tsx` | `new`, `archived` | `c` | `new` → `CategoryForm` (new), `c:ID` → `CategoryForm` (edit), `archived` → the list of archived categories with «Ripristina» | save, reorder, archive, restore |
| `profile/budgets/page.tsx` | `new` | `b` | `new` → `BudgetForm` (new), `b:ID` → `BudgetForm` (edit) | save, delete |
| `profile/goals/page.tsx` | `new` | `g` | `new` → `GoalForm` (new), only when `canCreate` is true; `g:ID` → `GoalForm` (edit), one for each open goal | save (`afterSave` is `${PATH}?g=__ID__`); the `web.accounts.openInAccounts` link (`goalAccountsHref`, another path) |
| `profile/connectors/page.tsx` | none | `connector` (`CONNECTOR_PARAM`) | `connector:CLIENT_ID` → the facts of the connector and `RevokeConnector`, one for each row | revoke (`RevokeConnector`) |
| `profile/preferences/page.tsx` | none | `edit` | `edit:cycle` → `CyclePanel`, `edit:currency` → `CurrencyPanel`, `edit:language` → `LanguagePanel`, `edit:theme` → `ThemePanel` (the keys are `PREFERENCE_KEYS`) | `edit:timeZone` → `TimeZonePanel`; each save (`useSaveSetting`) |

The first version of this plan named the values of Categories and Budgets `category` and `budget`. The pages read `c` and `b`.

On Categories, the page lets `?new` win over `?c=`, and `?c=` win over `?archived`. Give `order: ['new', 'c', 'archived']` in `PANEL_PARAMS` to keep this precedence. Without `order`, `panelKeyFromSearch` lets every flag win over a value.

Each row gives its whole key as `selectId` (for example `c:${id}`), as in Task 11.

On 2026-10-11 every Profilo section with a panel uses `PanelSwitch`: Tags, Categories, Budgets, Goals, Connectors and Preferences. `ProfilePanel` is deleted. Task 12 is complete.

- [x] **Step 1: For each page, read how it uses `searchParams`** (`params.new`, `params.<name>`). Write the `PANEL_PARAMS` constant from it. Use exactly the names that the page reads. A link that a person bookmarked must keep working.
- [x] **Step 2: Make the `panels` map** as Task 11 does. A panel can need costly data that exists only for one selected row, for example a long list. Keep that panel a navigation: do not put its key in `panels`. Then `panelOnlyChange` gives `null`, and the link navigates. Write the reason in the commit message.
- [x] **Step 3: Run `rtk proxy pnpm --filter web e2e profile` and `budgets-categories-tags`** before and after the change. Both must pass.
- [x] **Step 4: Commit** with `feat(web): Profilo → <section> opens its panel in place`.

**The size of the response.** The page renders one form for each row, and the RSC response carries the props of every form. Give a body only the props that are its own. Give the props that all the forms share once, through a provider at the root of the page. `sharedProps` in `src/ui/sharedProps.tsx` makes the provider and the hook. The provider renders no element, so `PanelSwitch` stays the root of the section. Examples of shared props: the messages, the money format, and lists of options such as the categories or the parent accounts. When each form needs a list that differs only a little, give the shared rows once. Then let the form call core on them, for example `categoryParentCandidates`.

Do not trust React's deduplication. React writes an object that repeats as a reference only if it can name the path of the first copy. A key with a colon, such as `c:ID`, stops the path. Thus a list that starts under a row's key goes into the response once for each row.

On 2026-10-11 a temporary spec measured `/profile/categories` with 50 more categories. Each category has its own budget and one transaction. The RSC response was 148 KB before the change. The approach of Task 11 gave 1124 KB, because each form had its own lists of parents. With the shared props it was 227 KB.

On 2026-10-11 the work on Categories found these points:

- `CategoryFormView` has no `parents` now. `CategoryForm` calls `categoryParentOptions` on the shared categories.
- `ArchiveCategory` calls `archiveMoveTargets` on the shared categories. It gets its strings from the shared props. A body gives only `id`, `updatedAt`, `uses` and the body text with the count.
- The archived list is the panel `archived`. Its row has `selectId="archived"`. «Ripristina» stays a navigation.
- A URL with `?c=` and an id that is not a live category opens nothing, also with `?archived`. Before, `?archived` then opened the archived list. `PanelSwitch` reads the first name of `order` that the URL has.
- The goals flows are in `accounts-goals`, not in `budgets-categories-tags`. Step 3 runs the spec of the section.

On 2026-10-11 the review of the Categories commit found these problems. Commit `fix(web): review findings on the Profilo categories, budgets and goals panels` fixes them:

- The archive dialog showed «Sposta le transazioni in» for each category in use. Thus the only income category with transactions showed a select with only «Nessuna». `archiveMoveTargets` now gives null when nothing uses the category or no category can take its transactions. Then the dialog shows no select. `archiveView.test.ts` has the regression test.
- The page made a `c:ID` panel only for the rows of the list. Thus `?c=` with a live child of an archived parent opened nothing. A link from MCP can give such an id. Now every live category has its form.
- The page called `archiveCategoryView` for each row. That read every transaction for each category. Now the dialog gets its count from `categoriesView` (`usage`) and its version from the form view. `archiveCategoryView` is deleted.
- `CategoryFormSharedValue.categories` stays `Category[]`. Core's `categoryParentCandidates`, `topLevelCategories` and `movableTargets` take `readonly Category[]`. A smaller row needs these three functions to be generic. It would save only `createdAt`, `updatedAt` and `deletedAt`.

On 2026-10-11 the work on Budgets found these points:

- `budgetFormView` gives only what is the budget's own, with `heldIds`. `budgetFormShared` gives the lists that are the same for every form: the categories, the budgets, the history and `categoryRefs`. `BudgetForm` gets its tiles from `budgetCategoryTiles`, which calls core's `takenCategoryIds`.
- `budgetRowFor` takes `selectId`, so the rows are `PanelLink`s. Home does not give it.
- With 50 more budgets the RSC response was 159 KB before, 916 KB with the approach of Task 11, and 218 KB with the shared props.

On 2026-10-11 the work on Goals found these points:

- `GoalFormView` has no `parents` now. `goalParentOptions` gives them once, through `GoalFormProvider`, with the messages and the money format. `GoalForm` is used only on this page.
- A save goes to `?g=ID`. The panel of the saved goal stays open, and the list shows the new figures.
- A URL with `?new` and `?g=` opens nothing when no account can hold a goal: `?new` wins, and it has no panel then. Before, `?g=` then opened the goal.
- With 50 more goals the RSC response was 147 KB before, 228 KB with the approach of Task 11, and 204 KB with the shared props. The approach of Task 11 sent the messages only once on this page. React could name the path of the first copy, under the key `new`, which has no colon.

On 2026-10-11 the review of Task 11 found the same luck on Tags. The page sent the messages and the tag list once only because the first copy was under `new`. Tags now uses the shared props too:

- `TagFormShared` gives the tag list, the locale, the messages, `closeHref` and `afterSave` once. A body gives only `tag` and `transactionsHref`.
- With 50 more tags the RSC response was 131 KB before and 123 KB after. A message of the form is in the response once, before and after. The string `"/profile/tags"` was in it 110 times before and 4 times after.

On 2026-10-11 the work on Connectors found these points:

- A panel shows the facts of the user's own consent: the name, the scopes, the host that the client returns to, the dates and the count of calls. The list row already shows most of them. No panel holds a token, a secret or a whole redirect URI. Thus the page renders a panel for each row. Before, the page rendered only the panel of the selected row.
- `RevokeConnectorShared` gives the strings of «Revoca accesso» and `closeHref` once. A body gives only `clientId` and the title with the name. «Revoca accesso» stays a navigation: `router.replace(closeHref)`.
- `connectorRows` has no `selectedId` and no `selected` now. The rows are `PanelLink`s with `selectId={`connector:${clientId}`}`.
- `ConnectPanel` is the «Collega» block above the list, not a panel. It does not change.
- With 10 connectors the RSC response was 48 KB before and 85 KB after (6.7 KB and 8.0 KB with gzip).

On 2026-10-11 the work on Preferences found these points:

- A save calls `router.refresh()`. The page renders again with the new settings, and the panel stays open. A change of language renders the whole page in the new language. The URL does not change.
- `edit:timeZone` stays a navigation. Its list has about 400 zones, with the hour in each zone at the time of the render. The list is 40 KB, and its hours are right only at the render. The page puts `edit:timeZone` in `panels` only when the URL has `?edit=timeZone`. Thus a load or a navigation to it opens the panel, and from there the other four open in place.
- `SettingErrorsShared` gives the error strings once. `useSaveSetting` reads them, so the five panels have no `errors` prop.
- `SummaryRow` takes `selectId`, as `ListRow` does. Admin → Settings can use it in Task 14.
- `editPanel` is deleted. `PanelSwitch` reads `?edit=`.
- The RSC response of `/profile/preferences` was 27 KB before. It was 79 KB with all five panels, and it is 41 KB with the time zone as a navigation (5.3 KB, 15.7 KB and 8.9 KB with gzip).

On 2026-10-11 a temporary Playwright spec on a production build (port 3100) gave these results on Connectors (10 rows) and Preferences:

- A click on a row shows the panel in the next frame, with the parameter in the URL and no RSC request. A click on a second row keeps the same `aside` element, and the row has `aria-current="true"`.
- ✕ and Esc close with no RSC request, and the focus goes back to the row. Back closes the panel.
- A load with the parameter opens the page with the panel. The server HTML holds the `aside`, also with JavaScript off.
- On Connectors, «Revoca accesso» goes to `/profile/connectors` with no panel, and the list has one row less.
- On Preferences, the row of the time zone sends one RSC request and opens its panel. A save of the theme, the language or the zone keeps the panel open, and the row shows the new value.
- The screenshots of the two lists and of `?edit=theme` are the same, pixel for pixel, before and after (1440px and 500px, light and dark). So is `?connector=ID` at 1440px. At 500px the page under the full-screen panel of a connector is 24px shorter: the empty slot of the layout has no row in the grid now. The pixels above that are the same.

`profile/passkeys` has no panel of its own: `PasskeyList` uses client state. `profile/account` and `profile/data` have no panel. Do not change these three pages.

### Task 13: Conti

**Files:**
- Modify: `apps/web/app/(app)/accounts/page.tsx` (panels near lines 355, 381, 448 and 541)
- Test: `apps/web/e2e/accounts-goals.spec.ts`

Conti has four panels: the account form (`?new`, `?a=ID&edit`), the archived list (`?archived`), the account detail (`?a=ID`) and the goal detail (`?g=ID`). Conti has no goal form. The goal form is on `/profile/goals`.

On 2026-10-11 Conti uses `PanelSwitch`. Task 13 is complete.

- [x] **Step 1: Run the e2e flow first**, `rtk proxy pnpm --filter web e2e accounts-goals`. Expected: PASS.

  On 2026-10-11 the run `e2e accounts-goals home-stats profile` gave 18 passed.

- [x] **Step 2: Decide what is in place.** Read `accountDetail` and the form views at the top of the page. A **detail** needs `accountDetail({ data, today, def, id })` for each account. Render it for each listed account (there are few). An **edit form** that needs the balances of one account stays a navigation, as for a transaction. `edit` is not a panel parameter. Thus `?a=ID&edit` and `?a=ID` differ in the other parameters, and the link navigates. «Nuovo conto» needs no row, so it is in place.
- [x] **Step 3: Move the panels into a `panels` map** with these keys: `new` (account form), `archived`, `a:ID` (account detail) and `g:ID` (goal detail). Use `PANEL_PARAMS = { flags: ['new', 'archived'], values: ['g', 'a'], order: ['new', 'g', 'a', 'archived'] }`. These are the names that the page reads: `params.new`, `params.archived`, `params.a`, `params.g`. The `order` is the precedence of the page: `?new` wins, then `?g=` over `?a=`, and a detail wins over `?archived`. The first version of this plan had a `newGoal` flag. The page reads no such parameter.

  > **Caution:** `panelKeyFromSearch` reads `?a=ID&edit` as `a:ID`. For that URL, make sure that the page shows the edit form, not the detail.

- [x] **Step 4: Replace `Panel` with `PanelSwitch`.** Do not set `slot`: Conti has no `SubnavLayout`. The rows of the page become `PanelLink`s through `ListRow`. An account row gives `selectId={`a:${id}`}`, and a goal row gives `selectId={`g:${id}`}`.
- [x] **Step 5: Run the e2e flow, check by hand, and commit** with `feat(web): Conti opens its panels in place`.

On 2026-10-11 the work on Conti found these points. The code in `apps/web/app/(app)/accounts/page.tsx` is the reference.

- `?a=ID&edit` stays a navigation, and `PanelSwitch` does not change. `edit` is not a panel parameter, so a link to it changes more than the panel. For a URL with `?a=ID&edit`, the server puts the edit form under the key `a:ID`, in place of the detail. The form has `closeTo: 'a:ID'`. The current URL has `edit`, so ✕, Esc and «Annulla» also navigate, to `?a=ID`. Thus the caution of step 3 is met. Only the account in the URL gets an edit form, because the form needs the balance of that account.
- While the URL has `edit`, every row link also navigates, as before the change.
- The page renders `a:ID` for each listed account and `g:ID` for each listed goal. The panel of a transaction links to the account of each side with `?a=ID`. That account can be a pocket or an archived account, which the list does not show. An MCP link can also name any account or goal. Thus the page also renders the panel of the id in `?a=` or `?g=` when the list does not show it, as Preferences does for the time zone.
- `ArchiveAccountShared` and `CloseGoalShared` give the strings and `afterHref` once. A body gives only the id, the version, and the strings with the name or the amount.
- `PanelSwitch` without `slot` renders its panel column after the list, in the grid of the page (`minmax(0, 1fr) auto`). With no panel the column is empty and takes no cell (`.slot:empty`). The screenshots of the list, `?a=ID`, `?g=ID`, `?archived`, `?new` and `?a=ID&edit` are the same, pixel for pixel, before and after (1440px and 500px, light and dark).
- A temporary Playwright spec on a production build (port 3100) gave these results. A click on an account shows the panel in the next frame, with `?a=ID` and no RSC request for `/accounts`. A click on a second account keeps the same `aside` element, with no running animation. A goal row, the archived row and «Nuovo conto» open in place. The goal row is selected and the account row that holds it is not. ✕ and Esc close with no RSC request, and the focus goes back to the row. Back closes. «Modifica» sends one RSC request and shows the form with the name of the account. ✕, Esc and «Annulla» of the edit form go to `?a=ID`. A save of the edit form and of «Nuovo conto» goes to `?a=ID`. A load of each panel URL has the `aside` in the server HTML, also with JavaScript off.
- The size of the response. With the seed (3 accounts, 2 goals) the RSC response of `/accounts` was 35 KB before and 86 KB after (6.3 KB and 12.6 KB with gzip). With 17 more accounts, each with 3 transactions, it was 67 KB before and 248 KB after (7.5 KB and 18.9 KB with gzip). An account panel is about 8 KB. Most of it is the list of the last 6 movements: each row has an inline SVG icon and an amount in parts.
- The e2e test of the archive in `accounts-goals.spec.ts` now also opens «Modifica» and closes it back to the detail.
- After the change, `e2e accounts-goals home-stats profile transactions shell` gave 33 passed.

These URLs open something else now:

- `?g=ID` with an id that is not a goal opens nothing, also with `?a=` or `?archived`. Before, `?g=ACCOUNT&a=X` showed the detail of the account in `?g=`, and `?g=X&archived` opened the archived list.
- `?g=&a=ID` (an empty `g`) opens the account. Before it opened nothing.
- `?edit&archived` with no `?a=` opens the archived list, as before. `?a=ID&edit` for a pocket or an archived account shows the detail, as before.

### Task 14: Admin

**Files:**
- Modify: `apps/web/app/(app)/admin/accounts/page.tsx`, `admin/invites/page.tsx`, `admin/settings/page.tsx`
- Test: `apps/web/e2e/admin.spec.ts`

Admin uses `SlotPanel` in a `SubnavLayout`, as Profilo does. Thus set `slot`. The Admin pages do not use `readPage`. Each page awaits `searchParams` in its own `Promise.all`.

On 2026-10-11 every Admin section with a panel uses `PanelSwitch`. Task 14 is complete.

- [x] **Step 1: Run `rtk proxy pnpm --filter web e2e admin` first.** Expected: PASS. The `fixme` test stays.

  On 2026-10-11 the run `e2e admin shell profile` on commit `70c3cc2c` gave 34 passed and 1 skipped (the `fixme`).

- [x] **Step 2: For each of the three pages**, do Task 11 again with the parameters of the page. Each row gives its whole key as `selectId` (for example `u:${id}`):
  - `admin/accounts`: no flags, values `u`. The detail comes from `accountDetail(db, id)`, one database read for each account. Render all the details only if this is cheap. If it is not cheap, keep the detail a navigation.
  - `admin/invites`: flags `new`, values `i` (see `invitePanel`).
  - `admin/settings`: no flags, values `edit`. The keys are `edit:name`, `edit:registration` and `edit:smtp` (see `settingsPanel`).

  A panel can confirm a destructive action, for example «delete an account» or «revoke an invite». That panel is in place only if its body needs nothing from the server except the row. The `settings` panels (`NamePanel`, `RegistrationPanel`, `SmtpPanel`) have client forms that call `router.push(closeHref)` on save. A save stays a navigation.
- [x] **Step 3: Run the e2e flow and commit** one page at a time: `feat(web): Admin → <page> opens its panel in place`.

The parameter names of step 2 are correct. The pages read `params.u`, `params.new` and `params.i` (`?new` wins), and `params.edit`. The pages do not read `searchParams` now. `PanelSwitch` reads the query.

**Security.** A page now sends the panel of every row in each response, also the rows that the admin does not open. Thus a panel can hold only what an admin can read about every row. The work checked each panel:

- An account panel holds the row of the list, the state of the email, the reason of a ban, the dates of creation and of the last sign-in, the counts of passkeys and of synced rows, and the label of the invite. It holds no token, no session id and no IP address. The delete dialog compares the typed text with the address (or the name, for a synthetic address). The row already shows the address.
- An invite panel holds the label, the dates, the status and the address of the person who used it. No response of the page holds an invite code. The database keeps only the hash, and `listInvites` does not read it. The code exists only in the answer of `mintInviteAction`, in the state of `MintInvite`. Thus `?new` is in place too. «Fatto» stays a navigation (`router.replace`).
- The SMTP panel gets the result of `smtpView` only: host, port, user, sender, and whether a password is set and still reads. A locked SMTP panel names the variables and shows no value. Thus the three settings panels are in place.
- No shared provider holds a secret. The providers hold strings and `afterHref`.
- `requireWebAdmin` in the layout and in each page, and the check in each Server Action, did not change.

`admin.spec.ts` has three new SECURITY GUARD tests:

- A member who asks for `/admin/accounts?u=ID`, as a document or as an RSC request, gets the not-found page. The body has no fact of the panel. Next.js answers the RSC request of a `notFound()` with status 200 and `NEXT_HTTP_ERROR_FALLBACK;404` in the body. The test reads the body, not the status, for that request.
- The list, an invite panel and `?new` hold no invite code, as documents and as RSC requests, also after a mint.
- After a save of the mail with a password, the list and `?edit=smtp` do not hold the password.

These tests fetch from the page (`fetchIn`). `context.request` sends no `Accept-Language`, so the page renders in English, and a check of an Italian string passes for the wrong reason.

On 2026-10-11 the work found these points:

- `accountDetails(db)` reads the details of every account in five queries: the users, the newest session of each user, the passkeys, the synced rows and the used invites. The page uses it in place of `listAccounts` and `accountDetail`. `admin.test.ts` proves that it gives every account what `accountDetail` gives it. `accountDetail` stays for `deleteAccount`.
- `AccountActionsShared`, `DeleteAccountShared` and `RevokeInviteShared` give the strings and `afterHref` once. A body gives only the id and the strings with the name or the label.
- A revoke or a restore of an account calls `router.refresh()`, and the panel stays open with the new state. A delete goes to `/admin/accounts`, and the controller closes the panel.
- The plan said that every settings panel goes to the list on save. `SmtpPanel` does not: a save of the mail calls `router.refresh()`, and the panel stays open. This did not change.
- The first version of the Invites commit called `router.refresh()` in `MintInvite` after a mint. A ✕ or an Esc just after the mint closed the panel with `history.pushState`, and then the refresh was lost: the list did not show the new invite. The e2e guard failed once in this way. Commit `fix(web): the mint of an invite brings the new list in its own answer` moves the refresh into the action: `mintInviteAction` calls `revalidatePath('/admin', 'layout')`, as the settings actions do. The answer brings the list with the code. Before the change, ✕ was a navigation, so the list was new after it.
- `invitePanel` and `settingsPanel` are deleted. `inviteStatusKey` gives the word of a status to the row and to the panel.
- No page uses `SlotPanel` now. Commit `refactor(web): delete SlotPanel, which no page uses now` deletes it. `PasskeyList` still uses a portal into the slot, so the slot stays.
- `admin/instance` and `admin/mcp` have no panel. They do not change.

These URLs behave as before: `?u=`, `?i=` and `?edit=` with a value that names nothing open nothing, and `?new&i=ID` opens «Nuovo invito».

On 2026-10-11 a temporary Playwright spec on a production build (port 3100) gave these results on the three pages, with 20 accounts and 25 invites (19 used, 6 active):

- A click on a row shows the panel in the next frame, with the parameter in the URL and no RSC request. A click on a second row keeps the same `aside` element, with no running animation, and the row has `aria-current="true"`.
- ✕ and Esc close with no RSC request, and the focus goes back to the row. On a settings panel the first Esc leaves the field and the second Esc closes, as before. Back closes the panel.
- A load with the parameter has the `aside` and its body in the server HTML, also with JavaScript off.
- «Nuovo invito» opens in place, and the focus is in the label field. After a mint the code stays on the screen, and ✕ closes with no RSC request. The list then has the new invite. The only requests after the mint are prefetches of the links that the revalidation cleared.
- A save of the instance name goes to `/admin/settings`, and the row shows the new name. A revoke and a restore in an account panel keep the panel open, and it shows the new state.
- The screenshots of the three lists and of `?edit=name` and `?edit=smtp` are the same, pixel for pixel, before and after (1440px and 500px, light and dark). So are `?u=ID`, `?i=ID` and `?new` at 1440px. At 500px the page under the full-screen panel is 24px shorter, as on Connectors. The pixels above that are the same.
- The size of the RSC response: `/admin/accounts` was 40 KB before and 92 KB after (6.2 KB and 9.2 KB with gzip). `/admin/invites` was 55 KB and 99 KB (6.8 KB and 9.5 KB). `/admin/settings` was 27 KB and 32 KB (5.5 KB and 6.7 KB).
- After the change, `e2e admin shell profile` gave 37 passed and 1 skipped: the 34 of step 1 and the three guard tests.

### Task 15: Close the work

- [ ] **Step 1: Run every gate and the whole web e2e suite**

Run: `rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm test && rtk proxy pnpm --filter web e2e`
Expected: all pass. Read the output, not the exit code.

- [ ] **Step 2: Measure** with `measure:nav` and `measure:panel`. Paste the lines in the «After C» column. Make sure that the `measure:panel` numbers are not worse than the table of 2026-10-07. Copy the values of the «Measurements» section into section 07 of the spec.

- [ ] **Step 3: Update `TODO.md`.** In «Web app: a UI pass», delete the items that this plan closes. These items are the four queries, `loading.tsx` and `useLinkStatus`, and the same pattern on Conti and Profilo. Keep the production region and the motion that the phone has. Write the name of this plan next to the plan of 2026-10-07.

- [ ] **Step 4: Request a code review** (`requesting-code-review`). Then merge to `main`.

- [ ] **Step 5: Commit**

Also stage the spec, because step 2 changed it: `git add docs/superpowers/specs/2026-10-11-web-navigation-feel.html`.

```bash
git add TODO.md docs/superpowers/plans/2026-10-11-web-navigation-feel.md
git commit -m "docs: record the web navigation work and what stays open"
```

---

## Measurements

| Input (1440px, CPU 4×) | Before | After A | After B | After C |
| --- | --- | --- | --- | --- |
| Tab Conti → Stats, feedback / settled | 93 / 93 ms | 19 / 119 ms | 19 / 119 ms | |
| Tab Home → Transazioni, feedback / settled | 156 / 156 ms | 19 / 397 ms | 19 / 202 ms | |
| Chip on Transazioni, feedback / settled | 109 / 109 ms | 62 / 118 ms | 60 / 118 ms | |
| Period ‹ on Transazioni, feedback / settled | 107 / 107 ms | 20 / 146 ms | 20 / 145 ms | |

Each cell is the median of five runs. In the After columns it is the median of three such medians. Times are in ms from the click.

- The runs used a production build, a local server and a local database. The CPU was four times slower.
- The Before runs were on 2026-10-11, on the code of commit `1d008060`. This is the code before Part A.
- A second run of the same script gave 102, 178, 122 and 135 ms. Expect a difference of about 20 ms between runs.
- The After A runs used commit `ce1e8f5d` in a temporary worktree. They used the scripts of commit `e05a4503` and one more change: `data-skeleton=""` on `PageSkeleton`, as in commit `2036793c`. Without this marker `measure-nav` cannot see a skeleton. Then «settled» is the time of the skeleton, not of the content.
- After A: the script ran 3 times (5 runs each) on one build. Each cell is the median of the 3 medians. «settled» for Home → Transazioni was 397, 396 and 397 ms. For Conti → Stats it was 114, 123 and 119 ms.
- After B: the script ran 3 times (5 runs each) on one build of commit `e05a4503` in the main checkout. Each cell is the median of the 3 medians. A fourth run, and a build of the same commit in a worktree, gave the same values within 20 ms.
- Both builds used the same machine, the same development database (161 rows) and port 3100. One server ran at a time.
- A control build of commit `1d008060` ran on the same day. It gave 95 / 95, 91 / 91 and 92 / 92 ms for Conti → Stats, and 157 to 166 ms for Home → Transazioni. This matches the Before column. The machine state is the same.
- «settled» is the time when the real page replaces the skeleton. With a `loading.tsx`, «settled» can be longer than Before while «feedback» is much shorter. This is the case here.
- «feedback» went from 93 and 156 ms to about 19 ms for the two tabs. It went from 109 to 60 ms for the chip, and from 107 to 20 ms for the period arrow.
- «settled» is worse than Before in every row. After B it is longer by 26 ms (Conti → Stats), 46 ms (Home → Transazioni), 9 ms (chip) and 38 ms (period arrow).
- After A, Home → Transazioni settled in 397 ms. This is 241 ms longer than Before. Part B removed 195 ms of it. It did not go back to 156 ms.
- Task 5 expected «feedback» of about 150 ms for the chip and the period arrow. The real values are 60 ms and 20 ms. The bar shows earlier than expected.
- After C is empty. Part C fills it.

Queries per request on `/transactions`: before 5, after A not measured, after B 3 (measured in Task 6). The list of the five queries is in Task 6 step 1. After Task 6, the three queries are the session row, the user row and the `sync_rows` of the user. `/profile/tags` also runs three. `/admin/accounts` runs nine: `requireWebAdmin` reads `role, banned` in the layout and in the page, and `listAccounts` runs two times. After Task 14 the page runs the five queries of `accountDetails` in place of `listAccounts`, and an open panel adds no query.

## Risks

- **`useLinkStatus` and prefetch.** `useLinkStatus` can stay `false` when Next.js prefetched the link and the navigation is quick. This is correct: nothing waits.
- **`banned` on `session.user`.** The types come from the admin plugin. `betterAuth` infers them only when the plugins are a tuple, so `auth.ts` uses `pluginTuple` (Task 6 step 3). If `getSession` gets a cookie cache, `banned` can be late. A comment at the `getSession` call says this. In `session.test.ts`, the test of the settings fails when `auth.ts` gets a `cookieCache` or a `secondaryStorage`. The ban tests with live session rows prove the ban check itself.
- **The size of the response.** Part C renders every panel of a page in one response. Transazioni sends a detail for each row (47 KB for 12 rows). A Profilo page sends a form for each row, and a form has more props than a detail. Thus a body gets only the props of its row, and the props that all the forms share go once through `sharedProps` (Task 12). With 50 more rows, the RSC response was 227 KB on Categories, 218 KB on Budgets and 204 KB on Goals. With the panels as navigations it was 148 KB, 159 KB and 147 KB. Connectors with 10 rows went from 48 KB to 85 KB. Preferences went from 27 KB to 41 KB, with the time zone as a navigation. Conti with 20 accounts went from 67 KB to 248 KB (7.5 KB to 18.9 KB with gzip). Admin → Account with 20 accounts went from 40 KB to 92 KB, and Admin → Inviti with 25 invites from 55 KB to 99 KB. If a page becomes too large, keep that panel a navigation (Task 12 step 2).
- **A form with state in a hidden panel.** `PanelSwitch` mounts only the open panel. The new form of Transazioni is different: it uses `<Activity>`. A change from one key to another key starts a new form, because the panel key is the `key` of the body. The `key` of `Panel` is only its shape, so the panel does not play its entrance again.
