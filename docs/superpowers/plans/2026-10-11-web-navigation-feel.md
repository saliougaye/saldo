# Web: navigation shows its state at once, and panels open in place everywhere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A click on a tab, a chip, a period arrow or a search shows feedback in the frame of the click. A page shows its shell and a skeleton while the server works. A panel on Conti, Profilo and Admin opens in place, as it does on Transazioni.

**Architecture:** Three independent parts, in this order. Part A adds feedback: one `AppLink` that reports its pending state to a provider in the `(app)` layout, plus `loading.tsx` boundaries. Part B shortens the chain of queries before a page can render. Part C lifts the in-place panel of `TransactionsPanels` into a shared controller, then uses it on the other pages. Pages stay server components. The server still renders the data. The change is that the browser sees something before the data is ready.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2, CSS Modules, Better Auth 1.7, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-web-panel-feel.html` still holds the rules for panel motion, focus and Esc. This plan adds no new motion. It applies those rules to more pages. The decisions below come from the thread of 2026-10-11.

---

## Why this plan exists

`TODO.md` («Web app: a UI pass») lists five open items. The user ruled on 2026-10-11:

- The region is **not** in this plan (`fra1::iad1`). A loading state hides the wait. It does not shorten the wait. Keep the region as its own item in `TODO.md`.
- Keep `next/link`. A plain `<a>` reloads the page and drops the mounted shell. The cost is the wait for the server, not the prefetch. No page has a `loading.tsx`, so Next has little to prefetch and a click shows nothing.
- Do not move to dialogs. The panel beside the list is the decision of §17.1.7. The slowness does not come from the panel type.
- Do not move data fetching to client components. A client fetch adds a round trip after the JavaScript loads, and it duplicates the query. Use streaming: the shell and a skeleton first, then the data.
- Filters, period and search stay navigations. They show a pending state. Only the panels change in place.
- Run the in-place panel on every page that has a panel: Conti, every Profilo section, every Admin section.

## Rules for every task

- **Gates** (AGENTS.md «Reading the results» — read the output, not the exit code): `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm test`. Clean lint means **no** `lint/…` lines and no `× Some errors were emitted while running checks.`
- Single-package loop: `rtk proxy pnpm --filter web test <pattern>`. Fix format with `pnpm exec biome check --write <files>` before each commit.
- Port 3000 belongs to another project. Start Saldo on 3100: `PUBLIC_URL=http://localhost:3100 pnpm --filter web build`, then `cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next start -p 3100`.
- The dev database is the `saldo-dev-postgres` container: `docker compose -f apps/web/docker/docker-compose.dev.yml up -d postgres` (colima must run). See `~/.claude-work/projects/-Users-saliougaye-sandbox-saldo/memory/web-manual-run-recipe.md`.
- Every UI string goes through i18n keys in `packages/i18n/src/locales/it.ts` **and** `en.ts` (and the other locales the parity test needs). Do not hard-code a colour, radius or size: use `@saldo/ui` tokens.
- Commit each task with a Conventional Commit. End each message with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Work on branch `fix/web-navigation-feel`, cut from `main`.

## File structure

| Path (under `apps/web/`) | Action | Responsibility |
| --- | --- | --- |
| `src/ui/AppLink.tsx` | Create | `next/link` plus a pending report. The only place that imports `next/link`. |
| `src/ui/NavPending.tsx` | Create | `NavPendingProvider`, `LinkPending`, `useNavTransition`. Owns the count of pending navigations. |
| `src/ui/NavPending.module.css` | Create | The progress bar. It shows after a short delay. |
| `src/ui/PageSkeleton.tsx`, `PageSkeleton.module.css` | Create | The block shapes of `loading.tsx`. |
| `app/(app)/loading.tsx`, `app/(app)/profile/loading.tsx`, `app/(app)/admin/loading.tsx` | Create | Suspense boundaries for a change of page. |
| `app/(app)/layout.tsx` | Modify | Mount `NavPendingProvider`. Take «admin» from the session. |
| `src/server/auth/session.ts`, `currentUser.ts`, `admin.ts` | Modify | Read `role` and `banned` from the session user. Drop two queries. |
| `src/server/page/context.ts` | Modify | Run the independent awaits together. |
| `src/ui/usePanelController.ts` | Create | The state machine now in `TransactionsPanels`, free of Transazioni. |
| `src/ui/panelUrl.ts` + `panelUrl.test.ts` | Create | Pure helpers: panel key from a query, «only the panel changes». |
| `src/ui/PanelSwitch.tsx` | Create | Renders one of many server-rendered panels, in place. |
| `app/(app)/transactions/TransactionsPanels.tsx`, `src/features/transactions/panelState.ts` | Modify | Use the controller. Behaviour does not change. |
| `app/(app)/accounts/page.tsx`, `app/(app)/profile/*/page.tsx`, `app/(app)/admin/*/page.tsx` | Modify | Use `PanelSwitch`. |
| `scripts/measure-nav.ts`, `package.json` | Create, modify | The measurement of tab, chip and period navigation, before and after. |

---

# Part A — Feedback in the frame of the click

### Task 1: Measure the baseline

**Files:**
- Read: `apps/web/scripts/measure-panel.ts` (it has `signIn`, `onlyUser`, the cookie and the CPU throttle)
- Create: `apps/web/scripts/lib/devSession.ts`, `apps/web/scripts/measure-nav.ts`
- Modify: `apps/web/scripts/measure-panel.ts`, `apps/web/package.json`

- [ ] **Step 1: Branch**

```bash
git switch -c fix/web-navigation-feel main
```

- [ ] **Step 2: Move the sign-in helpers**

Move `COOKIE`, `LOCAL_HOSTS`, `onlyUser`, `signIn` and the function that deletes the session out of `measure-panel.ts` into `scripts/lib/devSession.ts`, with `export`. Import them back in `measure-panel.ts`. Do not change what they do. Keep the local-only guard.

- [ ] **Step 3: Write `measure-nav.ts`**

The script opens a signed-in page on a production build, throttles the CPU 4×, then runs four inputs. For each input it records two times, from the click:

- **feedback**: the first frame in which something on the page changed. A `MutationObserver` on `document.body` (attributes, childList, subtree) notes `performance.now()` at the first mutation after the click.
- **settled**: the first frame in which the new content shows. For a tab, that is the new `<h1>` text or the new `pathname`. For a chip, the `aria-current="true"` moves.

```ts
import { chromium } from '@playwright/test';
import { onlyUser, openSession } from './lib/devSession';

const base = process.argv[2] ?? 'http://localhost:3100';

const INPUTS = [
  { label: 'tab Conti → Stats', from: '/accounts', act: 'nav a[href="/stats"]:visible' },
  { label: 'tab Home → Transazioni', from: '/home', act: 'nav a[href="/transactions"]:visible' },
  { label: 'chip on Transazioni', from: '/transactions', act: 'main a[href*="type="]:visible' },
  { label: 'period ‹ on Transazioni', from: '/transactions', act: 'main a[aria-label]:visible' },
];

const PROBE = `(() => {
  window.__marks = { feedback: null };
  new MutationObserver(() => {
    if (window.__marks.feedback === null) window.__marks.feedback = performance.now();
  }).observe(document.body, { attributes: true, childList: true, subtree: true });
})()`;

async function main() {
  const userId = await onlyUser(process.argv[3]);
  const session = await openSession(userId);
  const browser = await chromium.launch();
  try {
    for (const input of INPUTS) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addCookies([session.cookie(base)]);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(base + input.from);
      await page.waitForLoadState('networkidle');
      await page.evaluate(PROBE);
      const started = await page.evaluate(() => performance.now());
      await page.locator(input.act).first().click();
      await page.waitForLoadState('networkidle');
      const settled = await page.evaluate(() => performance.now());
      const feedback = await page.evaluate(() => window.__marks.feedback);
      console.log(
        `${input.label.padEnd(28)} feedback ${Math.round((feedback ?? settled) - started)} ms · settled ${Math.round(settled - started)} ms`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    await session.close();
  }
}

void main();
```

`openSession` is `signIn` plus the cookie and cleanup that `measure-panel.ts` already does. Export it from `devSession.ts` in step 2 with the shape `{ cookie(base): Cookie; close(): Promise<void> }`. Add a global type for `window.__marks` at the top of the file with `declare global { interface Window { __marks: { feedback: number | null } } }`.

- [ ] **Step 4: Add the script**

In `package.json` scripts add `"measure:nav": "tsx --env-file-if-exists=.env scripts/measure-nav.ts"`.

- [ ] **Step 5: Measure and record**

```bash
docker compose -f apps/web/docker/docker-compose.dev.yml up -d postgres
PUBLIC_URL=http://localhost:3100 pnpm --filter web build
cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next start -p 3100 &
pnpm --filter web measure:nav http://localhost:3100
```

Expected: four lines. «feedback» is about equal to «settled» (nothing shows before the server answers). Paste the four lines into the «Measurements» section at the end of this file, as «Before».

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts apps/web/package.json docs/superpowers/plans/2026-10-11-web-navigation-feel.md
git commit -m "chore(web): measure-nav script for tab, chip and period navigation"
```

### Task 2: `AppLink` and the pending provider

**Files:**
- Create: `apps/web/src/ui/NavPending.tsx`, `apps/web/src/ui/NavPending.module.css`, `apps/web/src/ui/AppLink.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`, `packages/i18n/src/locales/*.ts` only if `common.loading` is missing (it exists: the pages use it)

`useLinkStatus` (from `next/link`) must run in a **descendant** of the `<Link>`, so `AppLink` renders a small child that calls it.

- [ ] **Step 1: Write `NavPending.tsx`**

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
import { VisuallyHidden } from './VisuallyHidden';
import styles from './NavPending.module.css';

type Report = (delta: 1 | -1) => void;

const NavPendingContext = createContext<Report>(() => {});

/**
 * Counts the navigations that wait for the server. While the count is above zero it shows a thin bar
 * at the top of the page and tells a screen reader. The bar waits 150 ms (CSS), so a quick
 * navigation shows nothing.
 */
export function NavPendingProvider({ label, children }: { label: string; children: ReactNode }) {
  const [count, setCount] = useState(0);
  const report = useCallback<Report>((delta) => setCount((current) => current + delta), []);
  return (
    <NavPendingContext value={report}>
      {count > 0 ? (
        <>
          <div className={styles.bar} aria-hidden="true" />
          <VisuallyHidden>
            <span role="status">{label}</span>
          </VisuallyHidden>
        </>
      ) : null}
      {children}
    </NavPendingContext>
  );
}

/** Rendered inside a `<Link>`: tells the provider while that link's navigation is pending. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  const report = useContext(NavPendingContext);
  useEffect(() => {
    if (!pending) return;
    report(1);
    return () => report(-1);
  }, [pending, report]);
  return null;
}

/**
 * For a navigation that starts from code (`router.push` after a search, a key). Wrap the call in
 * `start`: the bar shows until the new page has rendered.
 */
export function useNavTransition(): (action: () => void) => void {
  const [pending, start] = useTransition();
  const report = useContext(NavPendingContext);
  useEffect(() => {
    if (!pending) return;
    report(1);
    return () => report(-1);
  }, [pending, report]);
  return start;
}
```

- [ ] **Step 2: Write `NavPending.module.css`**

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

Check that `--color-accent` exists in `@saldo/ui` tokens (`grep -rn "color-accent" packages/ui/src apps/web/src/styles`). If the token has another name, use that name. Do not add a colour.

- [ ] **Step 3: Write `AppLink.tsx`**

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

- [ ] **Step 4: Mount the provider**

In `app/(app)/layout.tsx` wrap the shell `div`:

```tsx
import { NavPendingProvider } from '../../src/ui/NavPending';
// …
    <NavPendingProvider label={t('common.loading')}>
      <div className={styles.shell}>
        {/* unchanged */}
      </div>
    </NavPendingProvider>
```

- [ ] **Step 5: Write a guard test**

Create `apps/web/src/ui/appLink.test.ts`. It reuses the `sources()` walk of `clientImports.test.ts` (copy the 10-line helper; do not export across test files).

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

/** A link that skips `AppLink` never shows the bar. */
describe('links', () => {
  it('import next/link only in AppLink', () => {
    const offenders = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'src'))].filter(
      (path) =>
        !path.endsWith('/src/ui/AppLink.tsx') &&
        /from 'next\/link'/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 6: Run it and see it fail**

Run: `rtk proxy pnpm --filter web test appLink`
Expected: FAIL. `offenders` lists every file that still imports `next/link` (about 30).

- [ ] **Step 7: Replace the imports**

Find them: `grep -rln "from 'next/link'" apps/web/app apps/web/src`. In each file except `AppLink.tsx`, replace `import Link from 'next/link';` with `import { AppLink as Link } from '<relative path to src/ui/AppLink>';`. Keep the local name `Link` so the JSX does not change. **Exception:** `src/ui/PanelNav.tsx`, `src/ui/Panel.tsx` and `src/ui/NavLink.tsx` also use `Link` — the same replacement applies. Files outside `src/ui` import `../../…/src/ui/AppLink`.

A client file that imports `AppLink` is fine: `AppLink` has no `'use client'`, and `LinkPending` is the client part.

- [ ] **Step 8: Run all gates**

Run: `rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm --filter web test`
Expected: the guard passes, no `lint/…` lines, tests green.

- [ ] **Step 9: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): every link reports its pending state to a bar in the shell"
```

### Task 3: Code-started navigations use the same bar

**Files:**
- Modify: `apps/web/src/ui/SearchField.tsx:59`, `apps/web/src/ui/Panel.tsx:106,110`, `apps/web/src/ui/ListKeys.tsx:66,88`, `apps/web/src/ui/Shortcuts.tsx:21`

- [ ] **Step 1: Wrap `router.push` / `router.replace` that change the page**

In each file add `const startNav = useNavTransition();` next to `useRouter()`, and change the call:

```tsx
// SearchField.tsx, was: router.push(params === '' ? path : `${path}?${params}`);
startNav(() => router.push(params === '' ? path : `${path}?${params}`));
```

Do the same for the calls in `Panel.tsx` (both `router.push(closeHref)`), `ListKeys.tsx` (both) and `Shortcuts.tsx`. A form's `router.replace(afterSave)` after a save stays as it is: the form has its own busy state.

- [ ] **Step 2: Gates, then check by hand**

Run the gates of Task 2 step 8. Then start the build on port 3100, open `/transactions`, type in the search box, and see the bar appear when the server takes more than 150 ms. To force a slow answer, set the DevTools network throttle to «Slow 4G».

- [ ] **Step 3: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): search, keys and panel close show the navigation bar"
```

### Task 4: `loading.tsx` for a change of page

**Files:**
- Create: `apps/web/src/ui/PageSkeleton.tsx`, `apps/web/src/ui/PageSkeleton.module.css`, `apps/web/app/(app)/loading.tsx`, `apps/web/app/(app)/profile/loading.tsx`, `apps/web/app/(app)/admin/loading.tsx`

`loading.tsx` wraps the page in a Suspense boundary. The layout stays mounted, so a tab change shows the shell and the skeleton at once. A change of query on the **same** page (a chip, the period) does not show it: that case uses the bar of Task 2.

- [ ] **Step 1: Write `PageSkeleton.tsx`**

```tsx
import styles from './PageSkeleton.module.css';

/** The shape of a page while the server works: a title line, then blocks. It says nothing about the content. */
export function PageSkeleton({ blocks = 4 }: { blocks?: number }) {
  return (
    <div className={styles.page} aria-hidden="true">
      <div className={`${styles.line} ${styles.title}`} />
      {Array.from({ length: blocks }, (_, index) => (
        // The blocks never change order: the index is the identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={index} className={`${styles.line} ${styles.block}`} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `PageSkeleton.module.css`**

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.line {
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
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

Check that `--radius-md` and `--color-surface-2` exist (`grep -rn "radius-md\|color-surface" packages/ui/src apps/web/src/styles`). Use the real token names. Do not add a value.

- [ ] **Step 3: Write the three `loading.tsx` files**

```tsx
// app/(app)/loading.tsx
import { PageSkeleton } from '../../src/ui/PageSkeleton';

export default function Loading() {
  return <PageSkeleton />;
}
```

`profile/loading.tsx` and `admin/loading.tsx` render `<PageSkeleton blocks={3} />`. The sub-navigation of those two layouts stays on screen, because the layout is above the boundary.

- [ ] **Step 4: Check by hand**

Build and start on 3100, throttle «Slow 4G», click Home → Conti. See the shell and the skeleton at once, then the page. In the Network tab, the prefetch of a tab link is small (no user data).

- [ ] **Step 5: Gates and commit**

```bash
git add -A apps/web
git commit -m "feat(web): loading boundaries show a skeleton while a page loads"
```

### Task 5: Measure Part A

- [ ] **Step 1: Run `pnpm --filter web measure:nav http://localhost:3100`** on a fresh production build.

Expected: «feedback» for the two tab inputs is under about 50 ms. The chip and period inputs show «feedback» at about 150 ms (the bar delay) when «settled» is longer than that, and about equal to «settled» when it is shorter. Paste the lines under «After Part A».

- [ ] **Step 2: Commit the numbers**

```bash
git add docs/superpowers/plans/2026-10-11-web-navigation-feel.md
git commit -m "docs: measurements after part A"
```

---

# Part B — A shorter chain before a page renders

Today a page waits for four things, one after the other: the session (Better Auth), `isRevoked` (a second read of the user row), `loadUserData` (all rows of the user), and in the layout `isAdmin` (a third read of the user row). The layout and the page run side by side, but each starts after the session. The admin plugin of Better Auth already puts `role` and `banned` on `session.user`, and `getSession` reads the database on every call (no cookie cache is set). So the two extra reads give no fresher answer.

### Task 6: Read `role` and `banned` from the session

**Files:**
- Modify: `apps/web/src/server/auth/session.ts`, `apps/web/src/server/auth/currentUser.ts`, `apps/web/app/(app)/layout.tsx`
- Test: the existing revocation tests (`apps/web/app/api/auth/adminPlugin.test.ts`)

- [ ] **Step 1: Count the queries now (throwaway patch, not committed)**

In `src/server/db/client.ts`, inside `getDb`, after `pool = new Pool(...)` add:

```ts
const original = pool.query.bind(pool);
let n = 0;
// biome-ignore lint/suspicious/noExplicitAny: throwaway counter
(pool as any).query = (...args: any[]) => {
  console.log(`[q${++n}]`, String(typeof args[0] === 'string' ? args[0] : args[0]?.text).slice(0, 60));
  return (original as any)(...args);
};
```

Run `next start`, load `/transactions` once, and count the lines. Write the count and the statements under «Queries per request, before». Then `git checkout apps/web/src/server/db/client.ts`.

- [ ] **Step 2: Write the failing test**

In `adminPlugin.test.ts` (or the file that already tests `authenticate` for a banned user — find it with `grep -rn "banned" apps/web --include=*.test.ts -l`), add a test that a banned user's session reads as signed out **without** a call to `isRevoked`. If the file mocks the database, assert on the result only: `authenticate(headersOfBannedUser)` returns `null`. The test exists in some form; it must stay green after step 3. If it does not exist, add:

```ts
it('reads a banned account as signed out (§10)', async () => {
  const { headers, userId } = await signedInHeaders();
  await banUser(userId);
  expect(await authenticate(headers)).toBeNull();
});
```

using the helpers that file already has for «signed in» and «ban».

- [ ] **Step 3: Change `authenticate`**

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

Remove the `isRevoked` and `getDb` imports from `session.ts` if nothing else uses them. If `tsc` says `banned` or `role` does not exist on `session.user`, use the inferred type of the admin plugin (`auth().$Infer.Session.user`). Do not use `any`.

- [ ] **Step 4: Add `isAdminUser` and use it in the layout**

In `src/server/auth/admin.ts` keep `isAdmin(db, userId)` (Server Actions and `requireWebAdmin` call it, and a mutation must not trust a stale read). Add:

```ts
/** For a page render: the role was read with the session. */
export function isAdminUser(user: { role: string | null }): boolean {
  return user.role === ADMIN_ROLE;
}
```

In `app/(app)/layout.tsx` replace the `Promise.all([isAdmin(getDb(), user.id), userI18n(user.id)])` with:

```tsx
const admin = isAdminUser(user);
const { t } = await userI18n(user.id);
```

Do the same in `app/(app)/profile/layout.tsx`.

- [ ] **Step 5: Run the tests**

Run: `rtk proxy pnpm --filter web test auth`
Expected: PASS, including the revocation test and every `requireWebAdmin` test.

- [ ] **Step 6: Count again, then commit**

Repeat step 1. Expected: two fewer statements. Write the count under «Queries per request, after». Revert the throwaway patch.

```bash
git add -A apps/web
git commit -m "perf(web): read role and banned with the session, not in two more queries"
```

### Task 7: Start independent work together

**Files:**
- Modify: `apps/web/src/server/page/context.ts`, `apps/web/app/(app)/transactions/page.tsx:125`

- [ ] **Step 1: Change `readPage`**

`searchParams` does not depend on the user. Start it with the session, and keep the order only where one result feeds the next:

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

`userI18n` awaits the same cached `loadUserData`, so it adds no query. Running both with `Promise.all` only removes a microtask gap.

- [ ] **Step 2: Parallelise the page's own extra read**

In `transactions/page.tsx` the `loadRow` for `?deleted=` waits for the whole `readPage`. It needs only the user id. Read the page file around line 125 and start `loadRow` as soon as `page.user.id` is known, with `Promise.all` together with any other awaited read in that function. If there is nothing else to await beside it, leave it: one await after `readPage` is correct, and the plan does not invent a change.

- [ ] **Step 3: Gates, measure, commit**

Run the gates. Run `measure:nav` and paste the lines under «After Part B».

```bash
git add -A apps/web
git commit -m "perf(web): readPage starts the session and the query together"
```

---

# Part C — The panel opens in place on every page

`TransactionsPanels` holds a state machine that is not specific to transactions: the URL as state through `history.pushState`, the list of URLs it wrote itself, the exit that plays for 150 ms, the focus that goes back to where it came from. Part C moves that into a hook, then lets a page give a **map of panels**. Each page renders the body of every panel on the server (as Transazioni does with `details`), so a click only chooses which one shows.

**Out of scope here:** a form that needs data only the server can compute for one row (the edit form of a transaction, which needs the row's balances). It stays a navigation, as `TransactionsPanels` already does for `edit`. The plan treats the edit form of an account the same way if `accountForm()` needs the balances. Step 1 of Task 10 says how to decide.

### Task 8: Pure helpers for a panel key

**Files:**
- Create: `apps/web/src/ui/panelUrl.ts`, `apps/web/src/ui/panelUrl.test.ts`

A **panel key** is the string that names what the URL opens: `new`, `tag:ID`, `account:ID`, `archived`. A page declares which parameters carry it.

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter web test panelUrl`
Expected: FAIL, `panelUrl` does not exist.

- [ ] **Step 3: Write `panelUrl.ts`**

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

- [ ] **Step 4: Run the tests, then commit**

Run: `rtk proxy pnpm --filter web test panelUrl`
Expected: PASS.

```bash
git add apps/web/src/ui/panelUrl.ts apps/web/src/ui/panelUrl.test.ts
git commit -m "feat(web): pure helpers that name a panel from the query"
```

### Task 9: Lift the controller out of `TransactionsPanels`

**Files:**
- Create: `apps/web/src/ui/usePanelController.ts`
- Modify: `apps/web/app/(app)/transactions/TransactionsPanels.tsx`
- Test: `apps/web/e2e/transactions.spec.ts` (must stay green), `apps/web/src/features/transactions/panelState.test.ts`

This task changes no behaviour. It is a move.

- [ ] **Step 1: Run the transactions end-to-end suite first**

Run: `rtk proxy pnpm --filter web e2e transactions`
Expected: PASS. If it fails on `main` already, stop and report: the move needs a green baseline.

- [ ] **Step 2: Create `usePanelController.ts`**

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

Move into the hook, **unchanged** apart from `panelFromSearch` → `config.parse`, `samePanel` → `config.same`, `panelOnlyChange` → `config.onlyChange`, `NONE` → `config.none`, and `next.kind === 'none'` → `config.isNone(next)`:

- `View` (without `draft`; add `extra: number` is not needed: `draft` stays in `TransactionsPanels`, which derives it from the controller's `onLeave` callback — see step 3),
- `searchOf`, `locationQuery`,
- the refs `seen`, `written`, `opener`, `returnTo`, `side`,
- `track`, `follow`, the `useLayoutEffect` on `search`, the `popstate` effect, `go`,
- the effect that plays the exit (`EXIT_MS`),
- the focus-return effect.

It returns `{ view, go, shown, side, closeToList }` where `shown = view.closing ? config.none : view.panel`.

For `draft`, accept an optional `onChange?: (previous: S, next: S) => void` in the config. `TransactionsPanels` uses it to bump its counter when `previous.kind === 'new'` and `next.kind !== 'new'`. It calls it from the same places that `draftAfter` runs today (`follow`, `go`, and the exit effect).

- [ ] **Step 3: Rewrite `TransactionsPanels` on top of the hook**

Keep: the `Activity` for the new form, `ListKeys`, the `NEW_TRANSACTION_EVENT` effect, `PanelNavContext`, the `content` and `editing` branches. Replace everything moved in step 2 with `const controller = usePanelController<PanelState>({ parse: panelFromSearch, same: samePanel, isNone: (s) => s.kind === 'none', none: NONE, onlyChange: (cur, href) => { const next = panelOnlyChange(cur, href); return next === null || next.kind === 'edit' ? null : next; }, onChange: … })`. The `edit` exception moves into `onlyChange`.

- [ ] **Step 4: Run the gates and the end-to-end suite**

Run: `rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm --filter web test && rtk proxy pnpm --filter web e2e transactions`
Expected: all green, same numbers as step 1. `TransactionsPanels.tsx` is about 150 lines shorter.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web
git commit -m "refactor(web): the in-place panel state machine is a hook, not part of Transazioni"
```

### Task 10: `PanelSwitch`

**Files:**
- Create: `apps/web/src/ui/PanelSwitch.tsx`
- Modify: `apps/web/src/ui/SlotPanel.tsx`

`PanelSwitch` is the shared client component. A page gives it the bodies of all its panels, rendered on the server.

- [ ] **Step 1: Write `PanelSwitch.tsx`**

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

Delete the two `void` lines and the unused `pathname`/`search` reads if `usePanelController` already calls `usePathname` and `useSearchParams` itself (it does after Task 9: it needs them for `follow`). They are in this sketch only to show the dependency; do not keep unused variables (Biome `noUnusedVariables`).

- [ ] **Step 2: Split `SlotPanel` so the portal can be reused**

In `SlotPanel.tsx` export a `SlotPortal({ children })` that does the `useState`/`useEffect`/`createPortal` part, and make `SlotPanel` render `<SlotPortal><Panel {...props} /></SlotPortal>`. No behaviour change for the sections that still use `ProfilePanel`.

- [ ] **Step 3: Gates and commit**

Run the gates. No page uses `PanelSwitch` yet, so only types and lint are checked.

```bash
git add -A apps/web
git commit -m "feat(web): PanelSwitch shows one server-rendered panel in place, chosen by the query"
```

### Task 11: Profilo → Tag, the worked example

**Files:**
- Modify: `apps/web/app/(app)/profile/tags/page.tsx`
- Test: `apps/web/e2e/budgets-categories-tags.spec.ts`

The server renders one form per tag, and one for «Nuovo tag». A click picks one.

- [ ] **Step 1: Run the tags e2e flows first (baseline)**

Run: `rtk proxy pnpm --filter web e2e budgets-categories-tags`
Expected: PASS.

- [ ] **Step 2: Change the page**

Replace the `creating`/`editing`/`open` block and the `ProfilePanel` with a map. The rows' links become `PanelLink`s so a plain click goes through the controller:

```tsx
import { PanelLink } from '../../../../src/ui/PanelNav';
import { PanelSwitch, type PanelSpec } from '../../../../src/ui/PanelSwitch';

const PANEL_PARAMS = { flags: ['new'], values: ['tag'] } as const;
// … inside ProfileTagsPage, after `const rows = tagsView(page.data);`
const tagList = rows.map((row) => ({ id: row.id, name: row.name }));
const messages = tagMessages(catalogs[locale]);
const panels: Record<string, PanelSpec> = {
  new: {
    title: t('tags.newTag'),
    sheet: true,
    body: (
      <TagForm
        key="new"
        tag={null}
        tags={tagList}
        locale={locale}
        messages={messages}
        closeHref={PATH}
        afterSave={PATH}
        transactionsHref={null}
      />
    ),
  },
  ...Object.fromEntries(
    rows.map((row): [string, PanelSpec] => [
      `tag:${row.id}`,
      {
        title: t('tags.editTag'),
        sheet: true,
        body: (
          <TagForm
            key={row.id}
            tag={row}
            tags={tagList}
            locale={locale}
            messages={messages}
            closeHref={PATH}
            afterSave={PATH}
            transactionsHref={`/transactions?tag=${encodeURIComponent(row.id)}`}
          />
        ),
      },
    ]),
  ),
};

return (
  <PanelSwitch baseHref={PATH} params={PANEL_PARAMS} panels={panels} closeLabel={t('common.close')} slot>
    <Section /* unchanged, but: */>
      {/* the «Nuovo tag» link and each row's link use PanelLink, with selectId={row.id} on the rows */}
    </Section>
  </PanelSwitch>
);
```

`ListRow` already takes `href` and `selected`. Check how `ListRow` renders its link (`src/ui/ListRow.tsx` imports `PanelLink`): rows pass `selectId` through the `PanelNavContext`, as the rows of Transazioni do. Read `ListRow.tsx` and pass `selectId={row.id}` the same way `transactions/page.tsx` does. For the «Nuovo tag» link, use `<PanelLink href={`${PATH}?new`} className={styles.newTag}>`.

`afterSave` and `closeHref` stay `PATH`: a save is still a navigation (`router.replace(afterSave)`), so the list shows the new name. That is the rule «a save is a navigation».

- [ ] **Step 3: Check by hand and run the e2e suite**

Run: `rtk proxy pnpm --filter web e2e budgets-categories-tags`
Expected: PASS. By hand: open `/profile/tags`, click a tag. The form shows in the frame of the click, the URL becomes `?tag=ID`, Back closes it, a reload with `?tag=ID` opens with the panel. No request in the Network tab on the click.

- [ ] **Step 4: Gates and commit**

```bash
git add -A apps/web
git commit -m "feat(web): Profilo → Tag opens its panel in place"
```

### Task 12: The other Profilo sections

**Files:** one `page.tsx` per row. Each task is Task 11 with these parameters. Do one section per commit, running the section's e2e flow before and after.

| Page | `flags` | `values` | Panels (key → body) | Stays a navigation |
| --- | --- | --- | --- | --- |
| `profile/categories/page.tsx` | `new` | `category` | `new` → `CategoryForm` (new), `category:ID` → `CategoryForm` (edit) | reorder, archive, restore |
| `profile/budgets/page.tsx` | `new` | `budget` | `new` → `BudgetForm`, `budget:ID` → `BudgetForm` | delete |
| `profile/goals/page.tsx` | read the page: it lists the parameters it reads at the top | read | read | read |
| `profile/connectors/page.tsx` | read | read | read | revoke |
| `profile/preferences/page.tsx` | read | read | `CurrencyPanel`, `CyclePanel`, `LanguagePanel`, `ThemePanel`, `TimeZonePanel` by key | save (`useSaveSetting`) |

- [ ] **Step 1: For each page, read its `searchParams` use** (`params.new`, `params.<name>`) and write the `PANEL_PARAMS` constant from it. Use exactly the names the page already reads: a link that a person bookmarked must keep working.
- [ ] **Step 2: Build the `panels` map** the way Task 11 does. Where a panel needs data that only exists for one selected row and is costly (a long list), say so in the commit and keep that panel a navigation: leave `panelOnlyChange` unable to open it by omitting its key from `panels`. The controller then answers `null` and the link navigates.
- [ ] **Step 3: Run `rtk proxy pnpm --filter web e2e profile` and `budgets-categories-tags`** before and after. Both must pass.
- [ ] **Step 4: Commit** with `feat(web): Profilo → <section> opens its panel in place`.

`profile/passkeys` has no panel of its own (it uses `PasskeyList` with client state). `profile/account` and `profile/data` have no panel. Do not touch them.

### Task 13: Conti

**Files:**
- Modify: `apps/web/app/(app)/accounts/page.tsx` (panels at lines about 355, 381, 448, 541)
- Test: `apps/web/e2e/accounts-goals.spec.ts`

Conti has four panels: the account form (`?new`, `?a=ID&edit`), the goal form (`?g=…`), the archived list (`?archived`), the account detail (`?a=ID`), and the goal detail.

- [ ] **Step 1: Run the e2e flow first**, `rtk proxy pnpm --filter web e2e accounts-goals`. Expected: PASS.
- [ ] **Step 2: Decide what is in place.** Read `accountDetail` and the form views at the top of the page. A **detail** needs `accountDetail({ data, today, def, id })` per account: render it for every listed account (there are few). An **edit form** that needs the balances of one account stays a navigation, as the edit form of a transaction does: leave `a:ID&edit` out of `panels`. «Nuovo conto» and «Nuovo obiettivo» need no row, so they are in place.
- [ ] **Step 3: Move the panels into a `panels` map** with these keys: `new` (account form), `newGoal`, `archived`, `a:ID` (detail), `g:ID` (goal detail). `PANEL_PARAMS = { flags: ['new', 'newGoal', 'archived'], values: ['a', 'g'] }`. Check the real parameter names in the page (`readPage` `params.*`) and use them.
- [ ] **Step 4: Replace `Panel` with `PanelSwitch`** (no `slot`: Conti has no `SubnavLayout`). The page's rows become `PanelLink`s via `ListRow`.
- [ ] **Step 5: Run the e2e flow, check by hand, commit** `feat(web): Conti opens its panels in place`.

### Task 14: Admin

**Files:**
- Modify: `apps/web/app/(app)/admin/accounts/page.tsx`, `admin/invites/page.tsx`, `admin/settings/page.tsx`
- Test: `apps/web/e2e/admin.spec.ts`

Admin uses `SlotPanel` in a `SubnavLayout`, like Profilo, so `slot` is on.

- [ ] **Step 1: Run `rtk proxy pnpm --filter web e2e admin` first.** Expected: PASS (the `fixme` stays).
- [ ] **Step 2: For each of the three pages**, repeat Task 11 with the page's own parameters. Panels that confirm a destructive action (delete an account, revoke an invite) are in place only if the body needs nothing from the server beyond the row. `settings` panels (`NamePanel`, `RegistrationPanel`, `SmtpPanel`) have client forms that call `router.push(closeHref)` on save: a save stays a navigation.
- [ ] **Step 3: Run the e2e flow and commit** one page at a time: `feat(web): Admin → <page> opens its panel in place`.

### Task 15: Close the work

- [ ] **Step 1: Run every gate and the whole web e2e suite**

Run: `rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm test && rtk proxy pnpm --filter web e2e`
Expected: green. Read the output, not the exit code.

- [ ] **Step 2: Measure** with `measure:nav` and `measure:panel`. Paste the lines under «After Part C». Check that the numbers of `measure:panel` did not get worse than the 2026-10-07 table.

- [ ] **Step 3: Update `TODO.md`.** In «Web app: a UI pass», delete the items this plan closes (the four queries, `loading.tsx` and `useLinkStatus`, the same pattern on Conti and Profilo). Keep the production region and the motion the phone has. Name this plan next to the 2026-10-07 one.

- [ ] **Step 4: Request code review** (`requesting-code-review`), then merge to `main`.

- [ ] **Step 5: Commit**

```bash
git add TODO.md docs/superpowers/plans/2026-10-11-web-navigation-feel.md
git commit -m "docs: record the web navigation work and what stays open"
```

---

## Measurements

| Input (1440px, CPU 4×) | Before | After A | After B | After C |
| --- | --- | --- | --- | --- |
| Tab Conti → Stats, feedback | | | | |
| Tab Home → Transazioni, feedback | | | | |
| Chip on Transazioni, feedback | | | | |
| Period ‹ on Transazioni, feedback | | | | |

Queries per request on `/transactions`: before ___, after ___.

## Risks

- **`useLinkStatus` and prefetch.** `useLinkStatus` can stay `false` when a link was prefetched and the navigation is quick. That is correct: nothing waits.
- **`banned` on `session.user`.** The types depend on the admin plugin. If the field is missing from the inferred type, Task 6 step 3 says what to do. If `getSession` ever gets a cookie cache, `banned` can lag. Add a comment at the `getSession` call that says so, and put a test next to it.
- **The size of the response.** Part C renders every panel of a page in one response. Transazioni does this already (47 KB for 12 rows). Conti and the Profilo lists are shorter. If a page grows past this, leave that panel a navigation (Task 12 step 2).
- **A form with state in a hidden panel.** `PanelSwitch` mounts only the open panel (unlike the new form of Transazioni, which uses `<Activity>`). A switch between two keys is a new form: the `key` on `Panel` makes that so.
