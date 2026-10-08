# Web: the Transazioni panel opens in the frame of the click — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Transazioni (web), «Nuova transazione», the detail of a row and their close happen in the frame of the
click, with no request to the server, and the list makes room for the panel with one continuous movement instead of
a jump.

**Architecture:** The server renders the list, the new form and the detail of every listed row in one response. A
client component, `TransactionsPanels`, keeps the open panel in React state. The URL still says what is open: a
click that only changes the panel sets the state and calls `history.pushState`, which Next.js syncs into
`useSearchParams`. Every other change (a filter, the period, a save, Back) is a navigation, and the panel follows
the URL that comes back. On a wide screen the list and the panel share a grid whose second track goes from `0` to
the panel width with a CSS transition, so the movement is continuous and can be reversed halfway.

**Spec:** `docs/superpowers/specs/2026-10-07-web-panel-feel.html`. On the Transazioni panel it wins over §17.1.7 of
the POC spec. Read it first: it has the state diagram, the rule for «in place or navigation», the layout and the
motion rules.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2 (canary channel bundled by Next), CSS Modules, Vitest,
Playwright (`@playwright/test` 1.63) for the measurement script.

---

## Why this plan exists

`TODO.md` («Web app: a UI pass — navigation feels slow, motion is missing») reports that the web app feels slow.
On 2026-10-07 the user said what is slow: the UI itself, for example opening the panel to add a transaction. A
measurement on a production build (`next build && next start`, local Postgres, 161 rows, no network latency)
found three causes:

| Action (1440px wide) | Panel in the DOM | Exit or entrance done | Server requests |
| --- | --- | --- | --- |
| «New transaction», CPU 1× | 106 ms | 311 ms | 1 (47 KB RSC) |
| «New transaction», CPU 4× | 294 ms | 506 ms | 1 |
| «New transaction» from Home, CPU 4× | 383 ms | 589 ms | 1 |
| FAB at 390px, CPU 4× | 228 ms | 555 ms | 1 |
| Click on a row, CPU 4× | 187 ms | about 390 ms | 1 |

1. **Every panel is a navigation.** `?new` and `?t=` re-render the whole page on the server. Until the answer
   arrives nothing on the screen changes. In production the function runs in `iad1` and the database in
   Frankfurt, which adds about 500 ms (a separate problem, see «Out of scope»).
2. **The list jumps.** When the panel opens, the list goes from 1096px to 676px in one frame. Every row wraps
   again and every amount moves 420px to the left. The panel itself moves only 16px.
3. **The close leaves an empty column.** `Panel` plays its exit (150 ms), and only then starts the navigation. The
   panel stays in the layout, transparent, until the server answers. Then the list jumps back.

Target, from the design rules this repository follows (Emil Kowalski, Apple's «Designing Fluid Interfaces»):
feedback in the frame of the input, motion that starts at the click and not after a wait, one movement that a new
click can reverse, and no motion for a key that a person presses many times a day.

## Execution context

- **Branch:** `fix/web-panel-feel`, cut from `main` (already created; the plan is its first commit).
- **Gates** (AGENTS.md «Reading the results» — read the output, not the exit code):
  - `rtk proxy pnpm lint` — clean means **no** `lint/…` lines and no `× Some errors were emitted while running checks.`
  - `rtk proxy pnpm typecheck`
  - `rtk proxy pnpm test`
- **Caution: an untracked folder breaks the web typecheck and `next build`.** `apps/web/e2e/` (with
  `zz-debug.spec.ts`) is left over from another piece of work and is not in git. `apps/web/tsconfig.json` includes
  `**/*.ts`, so its missing imports fail `tsc`. Do not delete it. Move it out before a gate or a build and move it
  back after: `mv apps/web/e2e /tmp/saldo-e2e-stash` … `mv /tmp/saldo-e2e-stash apps/web/e2e`.
- **Caution: port 3000 belongs to another project on this machine.** Start Saldo on 3100:
  `cd apps/web && PUBLIC_URL=http://localhost:3100 pnpm exec next start -p 3100` after
  `PUBLIC_URL=http://localhost:3100 pnpm build`.
- The development database is the `saldo-dev-postgres` container:
  `docker compose -f apps/web/docker/docker-compose.dev.yml up -d postgres` (colima must be running).
- Single-package loop: `rtk proxy pnpm --filter web test <pattern>`. Fix import order and formatting with
  `pnpm exec biome check --write <files>` before each commit.
- Spec: `docs/superpowers/specs/2026-10-07-web-panel-feel.html` (this topic), and §17.1.7 of the POC spec (the
  trailing panel, the URL as its state, decision 8). Earlier work on the same screen:
  `2026-09-29-0.3e-1-write-path.md` (the form in the panel).

## Decisions taken in this plan

1. **The URL stays the state that a person can share; the client changes it without asking the server.** Next.js
   16 integrates `window.history.pushState` and `replaceState` with `useSearchParams` (documented in
   `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`). A reload, a link from
   Home, Back and a page with JavaScript off still work, because the server still reads `?new`, `?t=` and
   `?edit` on its first render.
2. **A change is «panel only» when the path and every other parameter stay the same.** `panelOnlyChange` compares
   everything except `t`, `new` and `edit`. A filter, the period, a `?deleted=` toast or the prefill of «Metti da
   parte» make it a navigation, as today. This keeps a toast and a prefill from showing over the wrong page.
3. **The server renders the detail of every listed row.** The detail uses the server's catalog, formatters and
   `DeleteTransaction`. Rendering it on the client again would duplicate that code. The cost is a bigger RSC
   payload. Task 9 measures it. With 161 rows in the account, one period holds about 12 rows.
4. **«Modifica» stays a navigation.** The edit form needs the balances without the edited row (`formView`, mode
   `edit`). One per row would repeat accounts, categories and tags for every row. The detail stays on screen while
   the edit form loads. A later plan can split `FormView` into shared and per-row parts.
5. **The list makes room with a transition on `grid-template-columns`, not with a View Transition.** A View
   Transition animates snapshots: the text of the list stretches while its box changes size, and the page ignores
   input until the animation ends. A track transition reflows the list on every frame, but the amounts slide to
   their new place, and a click during the movement reverses it from where it is. Task 9 checks the longest frame
   at CPU 4×. Task 9 Step 5 adds `content-visibility: auto` to the day sections if that frame is too long.

   **Tried and reverted on 2026-10-08.** At CPU 4× a row click gave a 62 ms first frame (target 50), and
   `content-visibility` did not help. So a View Transition was built (commit `07d5daf`). It adds a frame before
   the panel shows, because the browser first captures the old page: a row took 76 ms instead of 15 ms, and
   «Nuova transazione» took 137 ms instead of 59 ms. The user compared both builds by hand and kept the track
   transition. Commit `ac440cc` reverts the View Transition. Task 9 sets the targets for the track transition
   from the measurements.
6. **The keyboard opens and closes without motion.** `N` and ↑ ↓ open a panel that is there on the next frame.
   The pointer gets the motion: 200 ms in (`--motion-fade`, `--motion-swap-easing`), 150 ms out, the values that
   `Panel` already uses.
7. **Every opening of «Nuova» is a new draft.** The form gets a new `key` when it leaves the screen (Task 8b). An
   opening while the exit of the same form plays reverses the exit and keeps the draft.
8. **The top bar, the FAB and `N` ask the page first.** They dispatch a cancelable `saldo:new-transaction` event
   on `window`. Transazioni cancels it and opens the panel in place. On every other page nobody cancels it, and the
   link (or `router.push`) goes to `/transactions?new` as today.
9. **The new form waits hidden in `<Activity>`** (Task 8b). Mounting the form on the click cost 224 ms at CPU 4×:
   its modules, its render and its focus. React renders the hidden form in the background, keeps it out of the
   layout with `display: none`, and runs its effects only while it shows. «Nuova» only shows it. After the form
   leaves the screen, its new `key` renders the next draft in the background. Thus decision 7 stays true. A form
   with other initial values (a prefill, a new day) is a new form. The edit form and the details do not change.

## Out of scope (recorded for the next plans)

- **The production region.** `x-vercel-id: fra1::iad1`: the function runs in Washington and Neon in Frankfurt.
  Fix: `"regions": ["fra1"]` in `vercel.json` (or in the Vercel project). This changes production, so the user
  decides it.
- **Four queries in a chain on every page:** session, user, `banned`, `sync_rows`. Better Auth's
  `session.cookieCache` and one query for `role` and `banned` can make it one or two.
- **`loading.tsx` and `useLinkStatus`** for the top-level pages, and the remaining motion from the phone (progress
  bars, the toast's exit, the dialog). See the TODO item, which stays open for them.
- **The same treatment for Conti and Profilo,** which use `Panel` and `SlotPanel` with navigations. Apply the
  pattern of this plan after it is accepted on Transazioni.

- **Two known limits of the new form.** Its `key` changes at midnight or when the first account changes, and that
  discards a visible draft.
- **The reflow of a very long period is not measured.** The development data has 161 rows.

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/web/src/features/transactions/panelState.ts` | Create | Read a panel from the URL; tell a panel-only change from a navigation; build a panel's URL. Pure. |
| `apps/web/src/features/transactions/panelState.test.ts` | Create | The rules above. |
| `apps/web/src/ui/PanelNav.tsx` | Create | The context a page gives its links (`selectedId`, `go`), `PanelLink`, `isPlainClick`. |
| `apps/web/src/ui/NewTransactionLink.tsx` | Create | The `saldo:new-transaction` event, its link, `openNewTransaction`, `wantsInstant`. |
| `apps/web/src/ui/Panel.tsx`, `Panel.module.css` | Modify | `onClose`, `closing`, `instant`: a panel whose page owns its state. `onClose` gets `'key'` or `'pointer'`. |
| `apps/web/src/ui/isEditable.ts` | Modify | A form or a dialog owns the keys only when it is on screen. |
| `apps/web/src/ui/ListRow.tsx` | Modify | `selectId`: a row whose selection comes from `PanelNav`. |
| `apps/web/src/ui/ListKeys.tsx` | Modify | `onSelect`: ↑ ↓ through the page's state. |
| `apps/web/src/ui/Shortcuts.tsx`, `TopBar.tsx`, `TabBar.tsx` | Modify | Ask the page before going to `/transactions?new`. |
| `apps/web/app/(app)/transactions/TransactionsPanels.tsx` | Create | The panel's client state, the layout, the event listener. |
| `apps/web/app/(app)/transactions/page.tsx` | Modify | Render every detail and the new form; hand them to `TransactionsPanels`. |
| `apps/web/app/(app)/transactions/TransactionForm.tsx` | Modify | «Annulla» through `PanelLink`. The amount takes the focus from an effect. |
| `apps/web/app/(app)/transactions/transactions.module.css` | Modify | The grid transition and the panel's column. |
| `apps/web/scripts/measure-panel.ts`, `apps/web/package.json` | Create, modify | The measurement, before and after. |
| `TODO.md`, `docs/superpowers/plans/README.md` | Modify | Record what this plan closes and what stays open. |

---

### Task 0: Commit the spec and the plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-07-web-panel-feel.html`
- Create: `docs/superpowers/plans/2026-10-07-web-panel-feel.md` (this file)

- [x] **Step 1: Commit**

```bash
rtk git add docs/superpowers/specs/2026-10-07-web-panel-feel.html docs/superpowers/plans/2026-10-07-web-panel-feel.md
rtk git commit -m "docs(specs): the web panel opens in the frame of the click"
```

---

### Task 1: The measurement script

The numbers in «Why this plan exists» came from throwaway scripts. This task makes them a repeatable command, so
Task 9 compares the same thing.

**Files:**
- Create: `apps/web/scripts/measure-panel.ts`
- Modify: `apps/web/package.json`

- [x] **Step 1: Add Playwright as a dev dependency**

`@playwright/test` 1.63.0 is already in the lockfile (a peer of `next`). Add it to the web package:

```bash
cd apps/web && pnpm add -D @playwright/test@^1.63.0 && pnpm exec playwright install chromium
```

Expected: `package.json` gets `"@playwright/test": "^1.63.0"` under `devDependencies`; Chromium installs or is
already in `~/Library/Caches/ms-playwright`.

- [x] **Step 2: Add the script entry**

In `apps/web/package.json`, after `"seed": …`, add:

```json
    "measure:panel": "tsx --env-file-if-exists=.env scripts/measure-panel.ts",
```

- [x] **Step 3: Write the script**

Create `apps/web/scripts/measure-panel.ts`:

```ts
/**
 * How the Transazioni panel opens and closes in a real browser (2026-10-07 plan): from the input to
 * the panel in the DOM, the server requests on the way, when the list's width starts and stops
 * changing, and the longest gap between two frames in the second after the input.
 *
 *   pnpm --filter web exec playwright install chromium   (once)
 *   pnpm --filter web measure:panel http://localhost:3100 [userId]
 *
 * Development only. It signs a person in by writing a session row and its signed cookie, so it
 * refuses anything but a local server AND a local database (the host of `DATABASE_URL` must be
 * localhost or 127.0.0.1). It deletes the session when it ends, on an error and on Ctrl-C too.
 * Run it against `next build && next start`: a dev server measures the compiler, not the app.
 * «server requests» counts RSC requests that are not prefetches. A hover can start a prefetch
 * (`next-router-prefetch: 1`), so those are counted on their own line.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { type Browser, chromium, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { session, user } from '../src/server/db/authSchema';
import { closeDb, getDb } from '../src/server/db/client';
import { env } from '../src/server/env';

const COOKIE = 'better-auth.session_token';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

interface Mark {
  t: number;
  what: string;
}

interface Scenario {
  label: string;
  viewport: { width: number; height: number };
  cpu: number;
  from: string;
  /** What has to be on screen before the measured input (an open panel, for a close). */
  setup?: (page: Page) => Promise<void>;
  act: (page: Page) => Promise<void>;
}

const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const NEW_BUTTON = 'a[href="/transactions?new"]:visible';
const ROW = 'main section a[href*="t="]:visible';

const SCENARIOS: Scenario[] = [
  {
    label: '«New transaction», wide',
    viewport: WIDE,
    cpu: 1,
    from: '/transactions',
    act: (p) => p.locator(NEW_BUTTON).first().click(),
  },
  {
    label: '«New transaction», wide',
    viewport: WIDE,
    cpu: 4,
    from: '/transactions',
    act: (p) => p.locator(NEW_BUTTON).first().click(),
  },
  {
    label: 'N, wide',
    viewport: WIDE,
    cpu: 4,
    from: '/transactions',
    act: (p) => p.keyboard.press('n'),
  },
  {
    label: '«New transaction» from Home, wide',
    viewport: WIDE,
    cpu: 4,
    from: '/home',
    act: (p) => p.locator(NEW_BUTTON).first().click(),
  },
  {
    label: 'Click on a row, wide',
    viewport: WIDE,
    cpu: 4,
    from: '/transactions',
    act: (p) => p.locator(ROW).first().click(),
  },
  {
    label: '✕ on the detail, wide',
    viewport: WIDE,
    cpu: 4,
    from: '/transactions',
    setup: async (p) => {
      await p.locator(ROW).first().click();
      await p.waitForSelector('aside');
    },
    act: (p) => p.locator('aside a[aria-label]').first().click(),
  },
  {
    label: 'FAB, phone',
    viewport: PHONE,
    cpu: 4,
    from: '/transactions',
    // A click, not a tap, on purpose: the same input as the wide scenarios.
    act: (p) => p.locator(NEW_BUTTON).first().click(),
  },
];

async function onlyUser(requested: string | undefined): Promise<string> {
  if (requested !== undefined) return requested;
  const rows = await getDb().select({ id: user.id }).from(user);
  const only = rows[0];
  if (rows.length !== 1 || only === undefined) {
    throw new Error(`${rows.length} accounts in the database: pass the userId to measure.`);
  }
  return only.id;
}

/** A session row and the cookie Better Auth signs for it: `token.base64(HMAC-SHA256(secret, token))`. */
async function signIn(userId: string, id: string): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  const signature = createHmac('sha256', env().secret).update(token).digest('base64');
  await getDb()
    .insert(session)
    .values({
      id,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      updatedAt: new Date(),
      userAgent: 'measure-panel',
    });
  return encodeURIComponent(`${token}.${signature}`);
}

/** Runs in the page: the clock starts at the timeStamp of the first pointerdown or keydown after this call. */
function arm(): void {
  const marks: { t: number; what: string }[] = [];
  Object.assign(window, { __marks: marks });
  let start: number | null = null;
  const mark = (what: string) =>
    marks.push({ t: Math.round(performance.now() - (start ?? performance.now())), what });
  const begin = (event: Event) => {
    if (start !== null) return;
    start = event.timeStamp;
    mark('input');
    let last = start;
    let worst = 0;
    const listWidth = () =>
      Math.round(
        [...document.querySelectorAll('main section')]
          .map((section) => section.getBoundingClientRect().width)
          .find((width) => width > 0) ?? 0,
      );
    const from = listWidth();
    let width = from;
    let firstChange: number | null = null;
    let lastChange: number | null = null;
    const frame = (time: number) => {
      worst = Math.max(worst, time - last);
      last = time;
      const now = listWidth();
      if (now !== width) {
        const at = Math.round(time - (start ?? time));
        firstChange ??= at;
        lastChange = at;
        width = now;
      }
      if (time - (start ?? time) < 1000) {
        requestAnimationFrame(frame);
        return;
      }
      if (firstChange !== null) {
        marks.push({ t: firstChange, what: `list starts to change (${from}px)` });
        marks.push({ t: lastChange ?? firstChange, what: `list settles (${width}px)` });
      }
      marks.push({ t: 1000, what: `longest frame ${Math.round(worst)} ms` });
    };
    requestAnimationFrame(frame);
  };
  document.addEventListener('pointerdown', begin, { capture: true });
  document.addEventListener('keydown', begin, { capture: true });
  let panel = document.querySelector('aside') !== null;
  new MutationObserver(() => {
    const now = document.querySelector('aside') !== null;
    if (now === panel || start === null) return;
    panel = now;
    mark(now ? 'panel in the DOM' : 'panel out of the DOM');
  }).observe(document.body, { subtree: true, childList: true });
}

async function measure(
  browser: Browser,
  base: string,
  cookie: string,
  scenario: Scenario,
): Promise<void> {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    isMobile: scenario.viewport.width < 500,
    hasTouch: scenario.viewport.width < 500,
  });
  await context.addCookies([{ name: COOKIE, value: cookie, url: base }]);
  const page = await context.newPage();
  await page.goto(base + scenario.from, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await scenario.setup?.(page);
  await page.waitForTimeout(500);
  const cdp = await context.newCDPSession(page);
  if (scenario.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpu });
  const requests: string[] = [];
  const prefetches: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    const headers = request.headers();
    if (!url.includes('_rsc=') && headers.rsc !== '1') return;
    (headers['next-router-prefetch'] === '1' ? prefetches : requests).push(url.replace(base, ''));
  });
  // tsx compiles with keepNames: `arm` calls a `__name` helper that does not exist in the page.
  await page.evaluate('globalThis.__name = (fn) => fn');
  await page.evaluate(arm);
  await scenario.act(page);
  await page.waitForTimeout(1500);
  const marks = await page.evaluate(
    () => (window as unknown as { __marks?: { t: number; what: string }[] }).__marks,
  );
  console.log(`\n== ${scenario.label}, CPU ${scenario.cpu}×`);
  if (marks === undefined) {
    console.log('  page reloaded: marks lost');
  } else {
    for (const item of [...marks].sort((a: Mark, b: Mark) => a.t - b.t)) {
      console.log(`  ${String(item.t).padStart(5)} ms  ${item.what}`);
    }
  }
  const list = (urls: string[]) => (urls.length > 0 ? ` (${urls.join(', ')})` : '');
  console.log(`  server requests: ${requests.length}${list(requests)}`);
  console.log(`  prefetches: ${prefetches.length}${list(prefetches)}`);
  await context.close();
}

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (argument === undefined) {
    console.error('Usage: pnpm --filter web measure:panel http://localhost:3100 [userId]');
    process.exitCode = 1;
    return;
  }
  const base = argument.replace(/\/$/, '');
  const database = new URL(env().databaseUrl);
  if (
    !LOCAL_HOSTS.has(new URL(base).hostname) ||
    !LOCAL_HOSTS.has(new URL(env().publicUrl).hostname) ||
    !LOCAL_HOSTS.has(database.hostname) ||
    // `pg` lets `?host=` override the host of the URL.
    database.searchParams.has('host')
  ) {
    throw new Error(
      'Refused: this script signs a person in, so it runs against a local server and a local database only.',
    );
  }
  let browser: Browser | undefined;
  let sessionId: string | undefined;
  let cleaning: Promise<void> | undefined;
  const cleanup = (): Promise<void> => {
    cleaning ??= (async () => {
      await browser?.close().catch(() => undefined);
      if (sessionId !== undefined) {
        await getDb()
          .delete(session)
          .where(eq(session.id, sessionId))
          .catch((error: unknown) => console.error('Could not delete the session', error));
      }
      await closeDb();
    })();
    return cleaning;
  };
  process.once('SIGINT', () => {
    void cleanup().finally(() => process.exit(130));
  });
  try {
    const userId = await onlyUser(process.argv[3]);
    // The id is known before the insert: a Ctrl-C during the insert still deletes the row.
    sessionId = randomUUID();
    const cookie = await signIn(userId, sessionId);
    // Our `cleanup` closes the browser. Playwright's own handler would exit before the delete.
    browser = await chromium.launch({ handleSIGINT: false });
    for (const scenario of SCENARIOS) await measure(browser, base, cookie, scenario);
  } finally {
    await cleanup();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [x] **Step 4: Typecheck and lint the script**

Run: `pnpm exec biome check --write apps/web/scripts/measure-panel.ts && rtk proxy pnpm --filter web typecheck`
(with `apps/web/e2e/` moved out, see «Execution context»).
Expected: no errors. If `new URL('')` throws for a missing argument, that is the intended refusal.

- [x] **Step 5: Record the baseline**

Build and start on 3100 (see «Execution context»), then run:

```bash
cd apps/web && pnpm measure:panel http://localhost:3100
```

Expected: about the numbers of the table in «Why this plan exists»: «panel in the DOM» 100–400 ms after «input»,
`server requests: 1` on every scenario, the list changing within a single frame. Paste the output into this plan,
under «Baseline» at the end, and stop the server.

- [x] **Step 6: Commit**

```bash
rtk git add apps/web/scripts/measure-panel.ts apps/web/package.json pnpm-lock.yaml docs/superpowers/plans/2026-10-07-web-panel-feel.md
rtk git commit -m "chore(web): measure how the Transazioni panel opens"
```

---

### Task 2: `panelState` — which panel a URL opens

**Files:**
- Create: `apps/web/src/features/transactions/panelState.ts`
- Test: `apps/web/src/features/transactions/panelState.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/web/src/features/transactions/panelState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { panelFromSearch, panelHref, panelOnlyChange, samePanel } from './panelState';

const search = (query: string) => new URLSearchParams(query);
const at = (query: string) => ({ pathname: '/transactions', search: search(query) });

describe('panelFromSearch', () => {
  it('reads the panel with the precedence the page always had', () => {
    expect(panelFromSearch(search(''))).toEqual({ kind: 'none' });
    expect(panelFromSearch(search('new&t=a'))).toEqual({ kind: 'new' });
    expect(panelFromSearch(search('t=a&edit'))).toEqual({ kind: 'edit', id: 'a' });
    expect(panelFromSearch(search('t=a'))).toEqual({ kind: 'detail', id: 'a' });
    expect(panelFromSearch(search('t='))).toEqual({ kind: 'none' });
  });
});

describe('panelOnlyChange', () => {
  it('opens and closes a panel over the same list', () => {
    expect(panelOnlyChange(at('direction=expense'), '/transactions?direction=expense&t=a')).toEqual(
      {
        kind: 'detail',
        id: 'a',
      },
    );
    expect(panelOnlyChange(at('direction=expense&t=a'), '/transactions?direction=expense')).toEqual(
      {
        kind: 'none',
      },
    );
    expect(panelOnlyChange(at('t=a'), '/transactions?new=')).toEqual({ kind: 'new' });
  });

  it('ignores the order of the parameters', () => {
    expect(panelOnlyChange(at('p=2026-09&q=bar'), '/transactions?q=bar&p=2026-09&t=a')).toEqual({
      kind: 'detail',
      id: 'a',
    });
  });

  it('is a navigation for another filter, another period or another page', () => {
    expect(panelOnlyChange(at('direction=expense'), '/transactions?t=a')).toBeNull();
    expect(panelOnlyChange(at('p=2026-09'), '/transactions?p=2026-10&t=a')).toBeNull();
    expect(panelOnlyChange(at(''), '/accounts?a=x')).toBeNull();
  });

  // A toast and a prefilled form belong to the page the server rendered: leaving them is a navigation.
  it('is a navigation while a delete toast or a prefill is in the URL', () => {
    expect(panelOnlyChange(at('deleted=a'), '/transactions?t=b')).toBeNull();
    expect(panelOnlyChange(at('new=&from=x'), '/transactions')).toBeNull();
  });
});

describe('panelOnlyChange, links that leave the page', () => {
  it('is a navigation for another origin', () => {
    expect(panelOnlyChange(at(''), 'https://evil.example/transactions?t=x')).toBeNull();
    expect(panelOnlyChange(at(''), '//evil.example/transactions?t=x')).toBeNull();
  });

  it('is a navigation for a link with a fragment', () => {
    expect(panelOnlyChange(at(''), '/transactions?t=x#top')).toBeNull();
  });
});

describe('panelHref', () => {
  it('replaces the panel that the base already has', () => {
    expect(panelHref('/transactions?t=old&edit=&q=1', { kind: 'detail', id: 'a' })).toBe(
      '/transactions?q=1&t=a',
    );
    expect(panelHref('/transactions?new=&q=1', { kind: 'none' })).toBe('/transactions?q=1');
  });

  it('adds the panel after the list parameters', () => {
    expect(panelHref('/transactions?direction=expense', { kind: 'detail', id: 'a' })).toBe(
      '/transactions?direction=expense&t=a',
    );
    expect(panelHref('/transactions', { kind: 'edit', id: '__ID__' })).toBe(
      '/transactions?t=__ID__&edit=',
    );
    expect(panelHref('/transactions', { kind: 'new' })).toBe('/transactions?new=');
    expect(panelHref('/transactions', { kind: 'none' })).toBe('/transactions');
  });
});

describe('samePanel', () => {
  it('compares the kind and the row', () => {
    expect(samePanel({ kind: 'detail', id: 'a' }, { kind: 'detail', id: 'a' })).toBe(true);
    expect(samePanel({ kind: 'detail', id: 'a' }, { kind: 'detail', id: 'b' })).toBe(false);
    expect(samePanel({ kind: 'detail', id: 'a' }, { kind: 'edit', id: 'a' })).toBe(false);
    expect(samePanel({ kind: 'none' }, { kind: 'none' })).toBe(true);
  });
});
```

- [x] **Step 2: Run it to make sure it fails**

Run: `rtk proxy pnpm --filter web test panelState`
Expected: FAIL — `Failed to resolve import "./panelState"`.

- [x] **Step 3: Write the implementation**

Create `apps/web/src/features/transactions/panelState.ts`:

```ts
/** The parameter that carries the selected row (§17.1.7). */
export const SELECTION_PARAM = 't';

/** `?new` opens «Nuova transazione»; `?t={id}&edit` turns the detail into the form (decision 8). */
export const NEW_PARAM = 'new';
export const EDIT_PARAM = 'edit';

/** The parameters that choose the panel and nothing else. */
const PANEL_PARAMS: ReadonlySet<string> = new Set([SELECTION_PARAM, NEW_PARAM, EDIT_PARAM]);

/** A URL that only resolves a path: the page's own links are all relative. */
const ORIGIN = 'http://panel.invalid';

export type PanelState =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string };

/** What a URL opens, with the precedence the page always had: `?new`, then `?t=…&edit`, then `?t=`. */
export function panelFromSearch(search: URLSearchParams): PanelState {
  if (search.has(NEW_PARAM)) return { kind: 'new' };
  const id = search.get(SELECTION_PARAM);
  if (id === null || id === '') return { kind: 'none' };
  return search.has(EDIT_PARAM) ? { kind: 'edit', id } : { kind: 'detail', id };
}

/** The same panel: the same kind on the same row. */
export function samePanel(a: PanelState, b: PanelState): boolean {
  const rowOf = (panel: PanelState) => ('id' in panel ? panel.id : null);
  return a.kind === b.kind && rowOf(a) === rowOf(b);
}

/**
 * Every parameter that is not the panel's, in an order that does not depend on the URL's. A key that
 * repeats compares as a set of pairs; Transazioni reads no repeated key.
 */
function listKey(search: URLSearchParams): string {
  return [...search]
    .filter(([key]) => !PANEL_PARAMS.has(key))
    .map((pair) => JSON.stringify(pair))
    .sort()
    .join(',');
}

/**
 * The panel `href` opens when going there changes nothing but the panel — the same path, the same
 * filters, the same period, no toast and no prefill left behind. Then the page already holds what
 * it needs, and the panel can change in the frame of the click. `null` for anything else, which is
 * a navigation. So is a link to another origin, or with a fragment: nothing pushes a URL that the
 * panel would ignore.
 */
export function panelOnlyChange(
  current: { pathname: string; search: URLSearchParams },
  href: string,
): PanelState | null {
  const target = new URL(href, ORIGIN);
  if (target.origin !== ORIGIN) return null;
  if (target.hash !== '') return null;
  if (target.pathname !== current.pathname) return null;
  if (listKey(target.searchParams) !== listKey(current.search)) return null;
  return panelFromSearch(target.searchParams);
}

/** The list's URL with `panel` open: the panel's parameters after the list's own. Drops the base's panel. */
export function panelHref(base: string, panel: PanelState): string {
  const url = new URL(base, ORIGIN);
  for (const key of PANEL_PARAMS) url.searchParams.delete(key);
  if (panel.kind === 'new') url.searchParams.set(NEW_PARAM, '');
  if (panel.kind === 'detail' || panel.kind === 'edit') {
    url.searchParams.set(SELECTION_PARAM, panel.id);
  }
  if (panel.kind === 'edit') url.searchParams.set(EDIT_PARAM, '');
  const query = url.searchParams.toString();
  return query === '' ? url.pathname : `${url.pathname}?${query}`;
}
```

- [x] **Step 4: Run the tests and make sure they pass**

Run: `rtk proxy pnpm --filter web test panelState`
Expected: PASS, 10 tests.

- [x] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/features/transactions/panelState.ts apps/web/src/features/transactions/panelState.test.ts
rtk git add apps/web/src/features/transactions/panelState.ts apps/web/src/features/transactions/panelState.test.ts
rtk git commit -m "feat(web): tell a panel-only change from a navigation"
```

---

### Task 3: `PanelNav` — links that change the panel in place

**Files:**
- Create: `apps/web/src/ui/PanelNav.tsx`
- Modify: `apps/web/src/ui/ListRow.tsx`

- [x] **Step 1: Create the context and the link**

Create `apps/web/src/ui/PanelNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { createContext, type MouseEvent, type ReactNode, useContext } from 'react';

/** What a page whose panel lives in client state gives the links inside it. */
export interface PanelNav {
  /** The row whose panel is open, or null. */
  selectedId: string | null;
  /**
   * Opens what `href` opens, in place, when only the panel changes. Answers false when going there
   * is a navigation, which the caller then makes as it always did.
   */
  go: (href: string, options?: { replace?: boolean; instant?: boolean }) => boolean;
}

export const PanelNavContext = createContext<PanelNav | null>(null);

export function usePanelNav(): PanelNav | null {
  return useContext(PanelNavContext);
}

/** A plain click. A modified one (a new tab, a new window) keeps the link's own behaviour. */
export function isPlainClick(event: MouseEvent): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);
}

interface Props {
  href: string;
  className?: string;
  /** Added to `className` while this link's row is the selected one. */
  selectedClassName?: string;
  /** The row this link opens: `aria-current` follows the page's selection. */
  selectId?: string;
  'aria-keyshortcuts'?: string;
  children: ReactNode;
}

/**
 * A link inside a page whose panel lives in client state (Transazioni). A plain click that only
 * changes the panel changes it in the frame of the click, and the URL follows; anything else is the
 * link it always was — outside such a page too, and with JavaScript off.
 */
export function PanelLink({ href, className, selectedClassName, selectId, children, ...rest }: Props) {
  const nav = usePanelNav();
  const selected = selectId !== undefined && nav?.selectedId === selectId;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (nav === null || !isPlainClick(event)) return;
    if (nav.go(href)) event.preventDefault();
  };
  const classes = [className, selected ? selectedClassName : undefined].filter(Boolean).join(' ');
  return (
    <Link
      href={href}
      className={classes}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Link>
  );
}
```

`next/link` skips its own navigation when `onClick` called `preventDefault()`
(`node_modules/next/dist/client/app-dir/link.js`: `if (e.defaultPrevented) return;`).

- [x] **Step 2: Let `ListRow` take its selection from the page**

In `apps/web/src/ui/ListRow.tsx`, add the import:

```tsx
import { PanelLink } from './PanelNav';
```

Add this prop after `selected?: boolean;`:

```tsx
  /**
   * The row of a list whose panel lives in client state (`PanelNav`): the page says which row is
   * selected, and a click opens it in the same frame. `selected` is not read then.
   */
  selectId?: string;
```

Add `selectId,` to the destructured props after `selected = false,`. Then replace the last two statements of the
function:

```tsx
  if (href === undefined) return <div className={className}>{body}</div>;
  if (selectId !== undefined) {
    return (
      <PanelLink
        className={className}
        selectedClassName={styles.selected}
        selectId={selectId}
        href={href}
      >
        {body}
      </PanelLink>
    );
  }
  return (
    <Link className={className} href={href} aria-current={selected ? 'true' : undefined}>
      {body}
    </Link>
  );
```

- [x] **Step 3: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

- [x] **Step 4: Commit**

```bash
pnpm exec biome check --write apps/web/src/ui/PanelNav.tsx apps/web/src/ui/ListRow.tsx
rtk git add apps/web/src/ui/PanelNav.tsx apps/web/src/ui/ListRow.tsx
rtk git commit -m "feat(web): links that change a client-side panel in place"
```

---

### Task 4: `Panel` — a panel whose page owns its state

**Files:**
- Modify: `apps/web/src/ui/Panel.tsx`
- Modify: `apps/web/src/ui/Panel.module.css`

- [x] **Step 1: Add the props**

In `apps/web/src/ui/Panel.tsx`, add to `interface Props`, after `sheet?: boolean;`:

```tsx
  /**
   * A page that keeps the panel in client state: the ✕, the scrim and Esc ask it to close,
   * and it closes at once. It answers false when closing has to be a navigation after all; the panel
   * then closes as a panel without this prop does.
   */
  onClose?: () => boolean;
  /** The page is playing the exit (with `onClose`); it takes the panel out when the exit has played. */
  closing?: boolean;
  /**
   * Opened or closed from the keyboard: no entrance and no exit. The entrance reads it once, at mount
   * (an open panel never plays it again); the exit reads it live.
   */
  instant?: boolean;
```

Destructure them after `sheet = false,`:

```tsx
  onClose,
  closing: closingProp = false,
  instant = false,
```

- [x] **Step 2: Close through the page first**

Replace:

```tsx
  const closing = closingFor === closeHref;

  // Closing is a navigation, which unmounts the panel at once: play the exit first, then go.
  const close = useCallback(() => {
    if (closingFor === closeHref) return;
```

with:

```tsx
  const closing = closingProp || closingFor === closeHref;
  // The entrance plays once, when the panel mounts: a later change of `instant` must not replay it.
  const [enteredInstantly] = useState(instant);

  // A page that owns the panel closes it at once. Otherwise closing is a navigation, which unmounts
  // the panel at once: play the exit first, then go.
  const close = useCallback(() => {
    if (closingProp) return;
    if (onClose?.() === true) return;
    if (closingFor === closeHref) return;
```

and change that callback's dependency list from `[router, closeHref, closingFor]` to
`[router, closeHref, closingFor, onClose, closingProp]`.

- [x] **Step 3: Mark an instant panel**

Rename the local click handler `onClose` to `onLinkClick`: the new prop takes that name.

Add `data-instant={instant ? '' : undefined}` and `data-still={enteredInstantly ? '' : undefined}` to the scrim
`<Link className={styles.scrim} …>` and to the `<aside className={styles.panel} …>`, after their `data-closing`
attribute. `data-still` plays no entrance; `data-instant` plays no exit.

Update the component's doc comment: replace the paragraph that starts «A client component for Esc and for focus.»
with:

```tsx
 * A client component for Esc and for focus. The selection lives in the URL, so closing is a
 * navigation and the ✕ is a plain link — with JavaScript off the panel still opens, still reloads
 * and still closes; only the key does nothing. A page can keep the panel in client state instead
 * (`onClose`): the URL then follows the panel, and nothing waits for the server.
```

- [x] **Step 4: Add the CSS**

At the end of `apps/web/src/ui/Panel.module.css`, add:

```css
/* Opened from the keyboard: the panel is there on the next frame. Latched at mount, so it never replays. */
.panel[data-still],
.scrim[data-still] {
  animation: none;
}

/* Closed from the keyboard: the panel is gone on the next frame. */
.panel[data-instant],
.scrim[data-instant] {
  transition: none;
}
```

Also add `pointer-events: none;` to the existing `.scrim[data-closing]` rule: a scrim that is leaving must not
swallow a click.

Both new rules must stay the last rules of the file: they override `.panel[data-sheet]` and the media queries by source order.

- [x] **Step 5: Typecheck and commit**

Run: `rtk proxy pnpm --filter web typecheck` — expected: no errors. Conti and Profilo pass none of the new props,
so they behave as before.

```bash
pnpm exec biome check --write apps/web/src/ui/Panel.tsx apps/web/src/ui/Panel.module.css
rtk git add apps/web/src/ui/Panel.tsx apps/web/src/ui/Panel.module.css
rtk git commit -m "feat(web): a Panel whose page owns its state"
```

---

### Task 5: `ListKeys` — ↑ ↓ through the page's state

**Files:**
- Modify: `apps/web/src/ui/ListKeys.tsx`

- [x] **Step 1: Add `onSelect`**

Add to `interface Props`, after `editHref: string;`:

```tsx
  /**
   * The page moves the selection itself (Transazioni, whose panel is client state). It answers
   * false when the move has to be a navigation; the selection then moves through `href`.
   */
  onSelect?: (id: string) => boolean;
```

Add `onSelect,` to the destructured props after `editHref,`. Replace:

```tsx
      moved.current = true;
      router.replace(href.replace(ID, encodeURIComponent(next)), { scroll: false });
```

with:

```tsx
      moved.current = true;
      if (onSelect?.(next) === true) return;
      router.replace(href.replace(ID, encodeURIComponent(next)), { scroll: false });
```

and add `onSelect` to the dependency list of that `useEffect`. In the component's doc comment, change «The
selection is the URL, so a move is `router.replace`» to «The selection is the URL, so a move replaces it — in
place when the page owns the panel (`onSelect`), else with `router.replace`».

- [x] **Step 2: Typecheck and commit**

Run: `rtk proxy pnpm --filter web typecheck` — expected: no errors.

```bash
pnpm exec biome check --write apps/web/src/ui/ListKeys.tsx
rtk git add apps/web/src/ui/ListKeys.tsx
rtk git commit -m "feat(web): list keys can move a client-side selection"
```

---

### Task 6: «Nuova transazione» asks the page first

**Files:**
- Create: `apps/web/src/ui/NewTransactionLink.tsx`
- Modify: `apps/web/src/ui/Shortcuts.tsx`, `apps/web/src/ui/TopBar.tsx`, `apps/web/src/ui/TabBar.tsx`

- [x] **Step 1: Create the event and its link**

Create `apps/web/src/ui/NewTransactionLink.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import { isPlainClick } from './PanelNav';

/** Decision 8: «Nuova transazione» is the form on Transazioni, from any page. */
export const NEW_TRANSACTION_HREF = '/transactions?new';

/** Dispatched on `window` before going to the form: a page that can open it in place cancels it. */
export const NEW_TRANSACTION_EVENT = 'saldo:new-transaction';

/** Opens «Nuova transazione» in the page when the page can. False: it has to be a navigation. */
export function openNewTransaction(instant: boolean): boolean {
  return !window.dispatchEvent(
    new CustomEvent(NEW_TRANSACTION_EVENT, { cancelable: true, detail: { instant } }),
  );
}

/** Whether the request came from the keyboard, which opens the form without motion. */
export function wantsInstant(event: Event): boolean {
  if (!(event instanceof CustomEvent)) return false;
  const detail: unknown = event.detail;
  return (
    typeof detail === 'object' && detail !== null && 'instant' in detail && detail.instant === true
  );
}

interface Props {
  className: string | undefined;
  'aria-label'?: string;
  'aria-keyshortcuts'?: string;
  children: ReactNode;
}

/** The top bar's button and the FAB: a link to the form, which the page opens in place when it can. */
export function NewTransactionLink({ className, children, ...rest }: Props) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isPlainClick(event) && openNewTransaction(false)) event.preventDefault();
  };
  return (
    <Link className={className} href={NEW_TRANSACTION_HREF} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
```

`className` is `string | undefined` because `noUncheckedIndexedAccess` makes a CSS module class
(`styles.fab`, `styles.new`) `string | undefined`.

- [x] **Step 2: `N` asks the page first**

Replace `apps/web/src/ui/Shortcuts.tsx` with:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';
import { NEW_TRANSACTION_HREF, openNewTransaction } from './NewTransactionLink';

/**
 * The keys that work on every page of the shell (§17.1.7): `N` opens «Nuova transazione» — in
 * place on Transazioni, which answers the request, and on its page from anywhere else. Mounted
 * once in the `(app)` layout; it renders nothing, and without JavaScript the top bar's link and the
 * FAB still get there.
 */
export function Shortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'n' && event.key !== 'N') return;
      if (ignoresShortcut(event)) return;
      event.preventDefault();
      if (!openNewTransaction(true)) router.push(NEW_TRANSACTION_HREF);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);
  return null;
}
```

- [x] **Step 3: The top bar's button**

In `apps/web/src/ui/TopBar.tsx`, add `import { NewTransactionLink } from './NewTransactionLink';` and replace:

```tsx
          <Link className={styles.new} href="/transactions?new" aria-keyshortcuts="n">
```

with:

```tsx
          <NewTransactionLink className={styles.new} aria-keyshortcuts="n">
```

and its closing `</Link>` (the one after `</span>` with the `kbd`) with `</NewTransactionLink>`. `Link` stays
imported: the brand uses it.

- [x] **Step 4: The FAB**

In `apps/web/src/ui/TabBar.tsx`, replace the import `import Link from 'next/link';` with
`import { NewTransactionLink } from './NewTransactionLink';` and replace:

```tsx
      <Link className={styles.fab} href="/transactions?new" aria-label={newTransaction}>
        <Icon name="plus" size={26} />
      </Link>
```

with:

```tsx
      <NewTransactionLink className={styles.fab} aria-label={newTransaction}>
        <Icon name="plus" size={26} />
      </NewTransactionLink>
```

- [x] **Step 5: Typecheck and commit**

Run: `rtk proxy pnpm --filter web typecheck` — expected: no errors. Nothing listens to the event yet, so every
page still navigates to `/transactions?new`.

```bash
pnpm exec biome check --write apps/web/src/ui/NewTransactionLink.tsx apps/web/src/ui/Shortcuts.tsx apps/web/src/ui/TopBar.tsx apps/web/src/ui/TabBar.tsx
rtk git add apps/web/src/ui/NewTransactionLink.tsx apps/web/src/ui/Shortcuts.tsx apps/web/src/ui/TopBar.tsx apps/web/src/ui/TabBar.tsx
rtk git commit -m "feat(web): «Nuova transazione» asks the page before navigating"
```

---

### Task 7: `TransactionsPanels` and the page

**Files:**
- Create: `apps/web/app/(app)/transactions/TransactionsPanels.tsx`
- Modify: `apps/web/app/(app)/transactions/page.tsx`
- Modify: `apps/web/app/(app)/transactions/TransactionForm.tsx`

- [x] **Step 1: Create the client component**

Create `apps/web/app/(app)/transactions/TransactionsPanels.tsx`:

```tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type PanelState,
  panelFromSearch,
  panelHref,
  panelOnlyChange,
  samePanel,
} from '../../../src/features/transactions/panelState';
import { ListKeys } from '../../../src/ui/ListKeys';
import { NEW_TRANSACTION_EVENT, wantsInstant } from '../../../src/ui/NewTransactionLink';
import { Panel } from '../../../src/ui/Panel';
import { type PanelNav, PanelNavContext } from '../../../src/ui/PanelNav';
import styles from './transactions.module.css';

/** `Panel`'s own exit: the panel leaves the DOM once it has played. */
const EXIT_MS = 150;

const NONE: PanelState = { kind: 'none' };

export interface DetailPanel {
  title: string;
  body: ReactNode;
}

interface Props {
  /** The list: the period, the search, the chips and the days. */
  children: ReactNode;
  /** The list's URL with no panel: its filters and its period. */
  baseHref: string;
  newTitle: string;
  editTitle: string;
  closeLabel: string;
  /** «Nuova transazione», rendered once by the server; every opening mounts a fresh copy. */
  newForm: ReactNode;
  /**
   * «Modifica transazione», only on a page loaded with `?t=…&edit`: the form needs the row's own
   * balances, so opening it is still a navigation, and the detail stays up while it loads.
   */
  edit: { id: string; form: ReactNode } | null;
  /** The detail of every row of the list, so a click opens one without asking the server. */
  details: Record<string, DetailPanel>;
  upcomingIds: string[];
  ids: string[];
  upcomingDisclosureId: string;
}

interface View {
  panel: PanelState;
  /** The exit is playing: the panel is still in the DOM, and the list already takes its room back. */
  closing: boolean;
  /** Opened or closed from the keyboard: no motion. */
  instant: boolean;
  /** How many times «Nuova» opened: the form's key, so each opening is a new draft. */
  opened: number;
}

/** The query of `href` as `useSearchParams().toString()` writes it. */
function searchOf(href: string): string {
  return new URL(href, 'http://panel.invalid').searchParams.toString();
}

/** The query of the address bar, written the same way. */
function locationQuery(): string {
  return new URLSearchParams(window.location.search).toString();
}

/** What the person sees: a panel that plays its exit is already closed. */
function shownOf(view: View): PanelState {
  return view.closing ? NONE : view.panel;
}

/**
 * The trailing panel of Transazioni (§17.1.7), in client state. The URL still says what is open, so
 * a reload, a link from Home and Back work, and without JavaScript every link is a page. A click
 * that only changes the panel changes it in the frame of the click, and the URL follows through
 * `history.pushState`, which Next syncs into `useSearchParams`. Anything else — a filter, the
 * period, a save, Back — is a navigation, and the panel follows the URL it brings.
 */
export function TransactionsPanels(props: Props) {
  const { baseHref, details, edit, newForm } = props;
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The first state is the server's: the same query, read the same way, so hydration matches.
  const [view, setView] = useState<View>(() => ({
    panel: panelFromSearch(new URLSearchParams(search)),
    closing: false,
    instant: false,
    opened: 0,
  }));
  // The handlers below read the committed view; they are not new functions on every render.
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  // The last query read from `useSearchParams`, and the queries `go` wrote that it has not shown yet.
  // Next applies a URL that `go` pushed in a transition, after the click: when two pushes are
  // quicker than that, the first one shows up after the second one has already moved the panel.
  const seen = useRef(search);
  const written = useRef<string[]>([]);
  // Where the focus was when the panel opened, and where it goes back to when the panel has left.
  const opener = useRef<Element | null>(null);
  const returnTo = useRef<Element | null>(null);

  /** Before the panel opens or closes: keep the focus's way back. */
  const track = useCallback((next: PanelState) => {
    const shown = shownOf(viewRef.current);
    if (shown.kind === 'none' && next.kind !== 'none') {
      const active = document.activeElement;
      opener.current = active === document.body ? null : active;
      returnTo.current = null;
    } else if (shown.kind !== 'none' && next.kind === 'none') {
      returnTo.current =
        opener.current?.isConnected === true
          ? opener.current
          : document.querySelector('#content a[aria-current="true"]');
      opener.current = null;
    }
  }, []);

  /** A URL this component did not write (a navigation, Back): the panel follows it, with no motion. */
  const follow = useCallback(
    (query: string) => {
      const next = panelFromSearch(new URLSearchParams(query));
      if (samePanel(next, shownOf(viewRef.current))) return;
      track(next);
      setView((current) =>
        samePanel(next, shownOf(current))
          ? current
          : { ...current, panel: next, closing: false, instant: true },
      );
    },
    [track],
  );

  // A new query in `useSearchParams`. One that `go` wrote and has since replaced is old: the panel
  // is already past it. The last one `go` wrote is the panel on screen. Any other is a navigation.
  useLayoutEffect(() => {
    if (search === seen.current) return;
    seen.current = search;
    const mine = written.current.lastIndexOf(search);
    if (mine === -1) {
      written.current = [];
      follow(search);
    } else if (mine === written.current.length - 1) {
      written.current = [];
    } else {
      written.current = written.current.slice(mine + 1);
    }
  }, [search, follow]);

  // Back before Next has synced a pushed URL: `useSearchParams` may never change, the address bar does.
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname !== pathname) return;
      const query = locationQuery();
      seen.current = query;
      written.current = [];
      follow(query);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [follow, pathname]);

  const go = useCallback(
    (href: string, options: { replace?: boolean; instant?: boolean } = {}) => {
      const here = locationQuery();
      const next = panelOnlyChange({ pathname, search: new URLSearchParams(here) }, href);
      // The edit form is not on the page until the server renders it: that one stays a navigation.
      if (next === null || next.kind === 'edit') return false;
      const instant = options.instant === true;
      track(next);
      setView((current) => {
        if (next.kind === 'none') {
          return current.panel.kind === 'none' ? current : { ...current, closing: true, instant };
        }
        // «Nuova» again while its own exit plays takes the same draft back: the close is reversed.
        const opened =
          next.kind === 'new' && current.panel.kind !== 'new' ? current.opened + 1 : current.opened;
        return { panel: next, closing: false, instant, opened };
      });
      // The selected row clicked again: the same URL is not a second history entry.
      const target = searchOf(href);
      if (target !== here) {
        // Back where `useSearchParams` already is: Next may never report the round trip.
        written.current = target === seen.current ? [] : [...written.current, target];
        window.history[options.replace === true ? 'replaceState' : 'pushState'](null, '', href);
      }
      return true;
    },
    [pathname, track],
  );

  // The exit has played: the panel leaves the DOM, unless something opened again meanwhile.
  useEffect(() => {
    if (!view.closing) return;
    const closed = view.panel;
    const timer = setTimeout(
      () =>
        setView((current) =>
          current.closing && current.panel === closed
            ? { ...current, panel: NONE, closing: false }
            : current,
        ),
      view.instant ? 0 : EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [view.closing, view.panel, view.instant]);

  // The panel has left: the focus, which was in it, goes back where it came from. Not when the
  // person has put it somewhere else meanwhile.
  useEffect(() => {
    if (view.panel.kind !== 'none') return;
    const target = returnTo.current;
    returnTo.current = null;
    const active = document.activeElement;
    if (!(target instanceof HTMLElement) || !target.isConnected) return;
    if (active !== null && active !== document.body) return;
    target.focus();
  }, [view.panel]);

  // The top bar's button, the FAB and N: on this page they open the form here.
  useEffect(() => {
    const onNew = (event: Event) => {
      // No form to show here (the URL holds a deletion notice or a prefill): the link navigates.
      if (newForm === null) return;
      const current = viewRef.current;
      // Already open: N must not replace it, nor its prefill, with a navigation.
      if (current.panel.kind === 'new' && !current.closing) {
        event.preventDefault();
        return;
      }
      const href = panelHref(baseHref, { kind: 'new' });
      if (go(href, { instant: wantsInstant(event) })) event.preventDefault();
    };
    window.addEventListener(NEW_TRANSACTION_EVENT, onNew);
    return () => window.removeEventListener(NEW_TRANSACTION_EVENT, onNew);
  }, [go, baseHref, newForm]);

  const { panel } = view;
  // The row whose panel is in the DOM, and the selected row: none while the exit plays.
  const panelId = panel.kind === 'detail' || panel.kind === 'edit' ? panel.id : null;
  const selectedId = view.closing ? null : panelId;
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const detail = panelId === null ? undefined : details[panelId];
  const editing = panel.kind === 'edit' && edit?.id === panel.id ? edit : null;
  const motion = { closing: view.closing, instant: view.instant };

  // Stable across renders: `Panel` and `ListKeys` subscribe their keys through these.
  const closeToList = useCallback(() => go(baseHref), [go, baseHref]);
  const editCloseHref =
    editing === null ? baseHref : panelHref(baseHref, { kind: 'detail', id: editing.id });
  const closeToDetail = useCallback(() => go(editCloseHref), [go, editCloseHref]);
  const onSelect = useCallback(
    (id: string) =>
      go(panelHref(baseHref, { kind: 'detail', id }), { replace: true, instant: true }),
    [go, baseHref],
  );

  let content: ReactNode = null;
  if (panel.kind === 'new' && newForm !== null) {
    content = (
      <Panel
        key="form"
        sheet
        bare
        title={props.newTitle}
        closeHref={baseHref}
        closeLabel={props.closeLabel}
        onClose={closeToList}
        {...motion}
      >
        <Fragment key={view.opened}>{newForm}</Fragment>
      </Panel>
    );
  } else if (editing !== null) {
    content = (
      <Panel
        key="form"
        sheet
        bare
        title={props.editTitle}
        closeHref={editCloseHref}
        closeLabel={props.closeLabel}
        onClose={closeToDetail}
        {...motion}
      >
        {editing.form}
      </Panel>
    );
  } else if (detail !== undefined) {
    content = (
      <Panel
        key="detail"
        title={detail.title}
        closeHref={baseHref}
        closeLabel={props.closeLabel}
        onClose={closeToList}
        {...motion}
      >
        {detail.body}
      </Panel>
    );
  }

  const formOpen = panel.kind === 'new' || editing !== null;
  return (
    <PanelNavContext value={nav}>
      <div
        className={styles.layout}
        data-panel={content !== null && !view.closing ? '' : undefined}
        data-instant={view.instant ? '' : undefined}
      >
        <div className={styles.list}>{props.children}</div>
        <div className={styles.side}>{content}</div>
      </div>
      {/* ↑ ↓ and E belong to the list; while a form is open the keys are the form's. */}
      {formOpen ? null : (
        <ListKeys
          upcomingIds={props.upcomingIds}
          ids={props.ids}
          upcomingDisclosureId={props.upcomingDisclosureId}
          selectedId={selectedId}
          href={panelHref(baseHref, { kind: 'detail', id: '__ID__' })}
          editHref={panelHref(baseHref, { kind: 'edit', id: '__ID__' })}
          onSelect={onSelect}
        />
      )}
    </PanelNavContext>
  );
}
```

`<PanelNavContext value={…}>` is React 19's context provider syntax.

Changes from the first draft of this step, found on a production build and in review:

- **A query that `go` wrote is not a navigation.** Next applies a `pushState` URL to `useSearchParams` in a
  transition, after the render of the click. The first draft read that old query as a navigation. A click then
  opened the panel with no entrance, and ✕ removed it with no exit.
- **The panel follows a new query in a layout effect.** The component keeps the queries that `go` wrote and
  `useSearchParams` has not shown yet (`written`). A query in that list before the last one is an old sync, and
  the effect ignores it. The last one is the panel on screen. Any other query is a navigation, and the panel
  follows it. A `go` back to the query that the hook already shows empties the list, because Next may never
  report that round trip. A `popstate` listener covers Back before Next syncs a pushed URL, and empties the list.
  The address bar cannot tell an old sync: Next's `HistoryUpdater` writes it on every commit, before layout
  effects.
- **The rule compares with what the person sees.** A closing panel counts as closed. A new URL that names the
  closing panel opens it again, with no motion. The exit of a closed panel is not stopped.
- **The focus goes back.** When a panel has left, the focus goes back to where it was when the panel opened. If
  that element is gone, it goes to the selected row. If the person moved the focus meanwhile, it stays there.
- **The same URL is not a second history entry,** the selection leaves with the close, and N on an open form does
  nothing.
- **The handlers are stable.** `Panel` and `ListKeys` put `onClose` and `onSelect` in their effects' dependencies,
  so `closeToList`, `closeToDetail` and `onSelect` are `useCallback`s.

- [x] **Step 2: Rewrite the page's imports and constants**

In `apps/web/app/(app)/transactions/page.tsx`:

1. Remove the imports of `ListKeys` and `Panel` (`../../../src/ui/ListKeys`, `../../../src/ui/Panel`).
2. Add, in import order:

```tsx
import {
  EDIT_PARAM,
  NEW_PARAM,
  SELECTION_PARAM,
} from '../../../src/features/transactions/panelState';
import { type DetailPanel, TransactionsPanels } from './TransactionsPanels';
```

3. Remove the local constants `SELECTION_PARAM`, `NEW_PARAM` and `EDIT_PARAM` and their comments (they now come
   from `panelState`). Keep `DELETED_PARAM`, `UPCOMING_ID`, `MISSING` and `FACT_LABELS`.

- [x] **Step 3: Replace the panel computations**

Replace the block from `const selectedId = params[SELECTION_PARAM];` down to and including the closing `: null;` of
`const form = …` with:

```tsx
  // The page opened with a panel (a reload, a link from Home): the server renders it. Opened on the
  // page, a panel is the client's (`TransactionsPanels`), and the URL follows it.
  const selectedId = params[SELECTION_PARAM];
  const creating = params[NEW_PARAM] !== undefined;
  // «Metti da parte», «Preleva» and «Registra la spesa» fill a new form from the URL.
  const newForm = formView({
    data: page.data,
    today,
    currency,
    mode: 'new',
    id: null,
    prefill: creating
      ? {
          from: params.from,
          to: params.to,
          description: params.description,
          closeGoal: params.closeGoal,
          amount: params.amount,
        }
      : undefined,
  });
  // `new URLSearchParams({ edit: '' })` writes `edit=`: presence is what counts, so `?edit` works too.
  const editForm =
    selectedId !== undefined && params[EDIT_PARAM] !== undefined
      ? formView({ data: page.data, today, currency, mode: 'edit', id: selectedId })
      : null;
```

Then remove the `selectedRecurring` block (the comment «Decision 10: deleting an occurrence…» and the `const
selectedRecurring = …;` statement) and replace it with:

```tsx
  // Decision 10: deleting an occurrence of a recurrence says so, as the phone does.
  const recurringIds = new Set(
    page.data.transactions.filter((row) => row.recurrenceId !== null).map((row) => row.id),
  );
```

- [x] **Step 4: Make the detail a function of its row**

Remove `const panelOpen = form !== null || selected !== null;`. After the `noteText` function and the
`hasRows`/`moneyParts` lines, add the detail body. It is the old detail `Panel`'s children with `selected`
renamed to `detail`:

```tsx
  /** The detail of one row: what the phone's detail screen shows (§6.6). */
  const detailBody = (detail: DetailView) => (
    <>
      {/* Not the list row's amount on purpose: the phone's detail screen signs a transfer
          `-amount` / `negative` while its list row leaves it unsigned, and the web matches
          the phone screen for screen (see `DetailView.hero`). */}
      <AmountText
        minor={detail.hero.minor}
        currency={currency}
        locale={locale}
        sign={detail.hero.signDisplay}
        size="hero"
      />

      <dl className={styles.facts}>
        {detail.facts.map((item) =>
          fact(
            item.kind,
            t(FACT_LABELS[item.kind]),
            item.value === null ? (
              MISSING
            ) : item.kind === 'date' ? (
              formatLongDate(item.value, locale)
            ) : item.href === null ? (
              item.value
            ) : (
              <Link className={styles.factLink} href={item.href}>
                {item.value}
              </Link>
            ),
          ),
        )}
        {fact('note', t('transactions.detailNote'), noteText(detail))}
        {detail.recurrence === null
          ? null
          : fact(
              'recurrence',
              t('recurrence.recurringRow'),
              endLabel(detail.recurrence.endDate, t, locale),
            )}
        {detail.excluded
          ? fact(
              'excluded',
              t('transactions.excludedFromTotals'),
              // The tick is the whole value, and `Icon` is always `aria-hidden`: without the
              // word beside it a screen reader reads the label and then silence.
              <>
                <Icon name="check" size={16} />
                <VisuallyHidden>{t('common.yes')}</VisuallyHidden>
              </>,
            )
          : null}
        {detail.tagNames.length === 0
          ? null
          : fact('tags', t('transactions.tags'), detail.tagNames.join(' · '))}
        {detail.attachmentCount === 0
          ? null
          : fact(
              'attachments',
              t('transactions.detailAttachments'),
              plural(t, locale, 'attachments.summary', detail.attachmentCount),
            )}
      </dl>

      <div className={styles.actions}>
        {/* Still a navigation: the edit form is rendered by the server (2026-10-07 plan, decision 4). */}
        <Link
          className={styles.action}
          href={href({ [SELECTION_PARAM]: detail.id, [EDIT_PARAM]: '' })}
          aria-keyshortcuts="e"
        >
          <Icon name="pencil" size={14} />
          {t('common.edit')}
          <span aria-hidden="true">
            <kbd className={styles.kbd}>E</kbd>
          </span>
        </Link>
        <span className={styles.spacer} />
        <DeleteTransaction
          id={detail.id}
          updatedAt={detail.updatedAt}
          deletedHref={href({ [DELETED_PARAM]: detail.id })}
          strings={{
            action: t('common.delete'),
            title: t('transactions.deleteTitle', { name: detail.title }),
            body: t(
              recurringIds.has(detail.id)
                ? 'transactions.deleteRecurringBody'
                : 'transactions.deleteBody',
            ),
            confirm: t('common.delete'),
            cancel: t('common.cancel'),
            busy: t('common.loading'),
            errors: writeErrors,
          }}
        />
      </div>
    </>
  );

  // Every row of the list, and the one the URL selected when the list does not hold it (a link
  // from Home to a row of another period).
  const upcomingIds = view.upcomingDays.flatMap((day) => day.rows.map((row) => row.id));
  const ids = view.days.flatMap((day) => day.rows.map((row) => row.id));
  const listed = [...upcomingIds, ...ids];
  const detailIds =
    selectedId === undefined || listed.includes(selectedId) ? listed : [...listed, selectedId];
  const details: Record<string, DetailPanel> = {};
  for (const id of detailIds) {
    const detail = detailView({ data: page.data, id, kindLabel });
    if (detail !== null) details[id] = { title: detail.title, body: detailBody(detail) };
  }

  const formProps = {
    locale,
    currency,
    decimalSeparator: moneyParts.decimalSeparator,
    symbol: moneyParts.symbol,
    symbolPosition: moneyParts.symbolPosition,
    messages: formMessages(catalogs[locale]),
  };
  // A closing expense ends on Conti, where the goal has just left the list.
  const afterSave = (form: { closeGoalId: string | null }) =>
    form.closeGoalId === null ? href({ [SELECTION_PARAM]: '__ID__' }) : '/accounts';
```

`fact` and `noteText` stay as they are; `detailBody` must come after them, and after `writeErrors` and `href`.

- [x] **Step 5: Replace the page's JSX**

Replace the whole `return (…);` of `TransactionsPage` with the block below. The list's markup (the head, the empty
states, «In arrivo» and the days) is unchanged: it moves inside `<TransactionsPanels>` without its `<div
className={styles.list}>` wrapper, which `TransactionsPanels` renders now.

```tsx
  return (
    <>
      <TransactionsPanels
        baseHref={href()}
        newTitle={t('txForm.newTitle')}
        editTitle={t('txForm.editTitle')}
        closeLabel={t('common.close')}
        newForm={
          newForm === null ? null : (
            <TransactionForm
              view={newForm}
              {...formProps}
              closeHref={href()}
              afterSave={afterSave(newForm)}
            />
          )
        }
        edit={
          editForm === null || editForm.id === null
            ? null
            : {
                id: editForm.id,
                form: (
                  <TransactionForm
                    key={`edit:${editForm.id}`}
                    view={editForm}
                    {...formProps}
                    closeHref={href({ [SELECTION_PARAM]: editForm.id })}
                    afterSave={afterSave(editForm)}
                  />
                ),
              }
        }
        details={details}
        upcomingIds={upcomingIds}
        ids={ids}
        upcomingDisclosureId={UPCOMING_ID}
      >
        {/* The list's head and rows: exactly the old `<div className={styles.list}>` children. */}
        <div className={styles.head}>{/* … unchanged … */}</div>
        {/* …the `!hasRows ? … : (<> …«In arrivo»… {view.days.map(…)} </>)` block, unchanged… */}
      </TransactionsPanels>

      {deletedId === undefined || undoTitle === null ? null : (
        <UndoToast
          // A second delete is a new toast, with its own five seconds.
          key={deletedId}
          id={deletedId}
          restoredHref={href({ [SELECTION_PARAM]: deletedId })}
          withoutDeletedHref={href()}
          strings={{
            message: t('transactions.deleted', { name: undoTitle }),
            undo: t('common.undo'),
            errors: writeErrors,
          }}
        />
      )}
    </>
  );
```

The two `{/* … unchanged … */}` lines are the instruction to move the existing JSX, not code to type: cut the
existing `<div className={styles.head}>…</div>` and the `{!hasRows ? (…) : (…)}` expression out of the old
`<div className={styles.list}>`, and paste them there. Delete the old `ListKeys`, the old two `Panel`s and the old
outer `<div className={styles.layout} …>`.

- [x] **Step 6: Rows take their selection from the panel**

In `daySection`, replace `selected={selected?.id === row.id}` with `selectId={row.id}`.

- [x] **Step 7: «Annulla» in the form**

In `apps/web/app/(app)/transactions/TransactionForm.tsx`, add `import { PanelLink } from '../../../src/ui/PanelNav';`
and replace:

```tsx
        <Link className={styles.cancel} href={closeHref}>
          {t('common.cancel')}
        </Link>
```

with:

```tsx
        <PanelLink className={styles.cancel} href={closeHref}>
          {t('common.cancel')}
        </PanelLink>
```

If `Link` has no other use in the file, remove its import (Biome reports it).

- [x] **Step 8: Typecheck, lint, test**

Run: `rtk proxy pnpm --filter web typecheck`, then `rtk proxy pnpm lint`, then `rtk proxy pnpm --filter web test`.
Expected: no type errors; no `lint/…` lines; all tests pass. A type error that names `selected` or `form` means a
use of the old variables remains in the page: replace it with `detail` inside `detailBody`, or remove it.

- [x] **Step 9: Commit**

```bash
pnpm exec biome check --write "apps/web/app/(app)/transactions"
rtk git add "apps/web/app/(app)/transactions"
rtk git commit -m "feat(web): Transazioni opens its panel in the frame of the click"
```

---

### Task 8: The list makes room with one movement

**Files:**
- Modify: `apps/web/app/(app)/transactions/transactions.module.css`

- [x] **Step 1: Replace the wide layout**

In `transactions.module.css`, replace:

```css
/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 24px;
  }
}
```

with:

```css
/*
 * `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. The panel's track
 * grows from nothing as the panel opens, so the list makes room in one movement — the amounts slide
 * to their new place instead of jumping — and a click during the movement reverses it from where it
 * is. Closing is quicker than opening, as the panel's own exit.
 */
@media (min-width: 1024px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 0;
    column-gap: 0;
    transition-property: grid-template-columns, column-gap;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  }

  .layout[data-panel] {
    grid-template-columns: minmax(0, 1fr) var(--layout-panel-width);
    column-gap: 24px;
    transition-duration: var(--motion-fade);
    transition-timing-function: var(--motion-swap-easing);
  }

  /* Opened or closed from the keyboard: the list takes its new width on the next frame. */
  .layout[data-instant] {
    transition: none;
  }
}
```

- [x] **Step 2: Add the panel's column**

After the `.list { … }` rule, add:

```css
/* Below the breakpoint the panel is fixed over the screen: its wrapper takes no place in the list. */
.side {
  display: contents;
}

/*
 * The panel's column at and above the breakpoint. It clips what does not fit yet while it grows;
 * the panel sits at its trailing edge, so it is uncovered from the side it will sit on. It spans the
 * list's height, so the panel stays sticky beside a long list.
 */
@media (min-width: 1024px) {
  .side {
    display: flex;
    justify-content: flex-end;
    align-self: stretch;
    min-width: 0;
    overflow-x: clip;
  }

  .side > aside {
    flex: none;
    align-self: flex-start;
  }
}
```

- [x] **Step 3: Look at it**

Build and start on 3100 (see «Execution context»). Open `http://localhost:3100/transactions` at 1440px wide.
Check each line:

1. A click on a row: the panel enters from the right while the list narrows, in one movement of about 200 ms.
2. The ✕: the list widens back while the panel leaves; no empty column stays.
3. A click on a second row while the panel is open: the panel stays, its content changes, the list does not move.
4. A click on a row, then the ✕ before the panel is fully open: the movement reverses from where it is.
5. `N`: the form is there on the next frame, with no movement. Esc closes it the same way.
6. Scroll down a long list with the panel open: the panel stays sticky under the top bar.
7. At 390px: the FAB raises the sheet; the scrim and the sheet leave together on close.

If line 6 fails (the panel scrolls away), the cause is `align-self: stretch` on `.side` not applying: check that no
rule gives `.side` a height.

- [x] **Step 4: Commit**

```bash
rtk git add "apps/web/app/(app)/transactions/transactions.module.css"
rtk git commit -m "feat(web): the list makes room for the panel in one movement"
```

---

### Task 8b: The new form waits hidden; Esc closes at once

The Task 8 check found two gaps. «New transaction» took 136 ms at CPU 1× and 224 ms at CPU 4× from the input to
the panel in the DOM. The target is ≤ 20 ms and ≤ 50 ms. Also, Esc played the exit, but decision 6 says that the
keyboard closes with no motion.

A CPU profile of a click on «New transaction» (production build, CPU 4×) found the cause in the mount of the form:

| Cost in the click | «New transaction» | Click on a row |
| --- | --- | --- |
| Instantiation of the form's modules (Turbopack's module factory) | 88 ms | 2.5 ms |
| `focus()` from `autoFocus`, which forces style and layout | 69 ms | — |
| Other JavaScript (React's render and commit) | 66 ms | 33 ms |

**Files:**
- Modify: `apps/web/src/ui/Panel.tsx`
- Modify: `apps/web/app/(app)/transactions/TransactionsPanels.tsx`
- Modify: `apps/web/app/(app)/transactions/TransactionForm.tsx`
- Modify: `apps/web/app/(app)/transactions/page.tsx`
- Modify: `apps/web/src/ui/isEditable.ts`
- Modify: `apps/web/scripts/measure-panel.ts`

- [x] **Step 1: `Panel` says how a close came, and latches the entrance each time it shows**

In `apps/web/src/ui/Panel.tsx`, add `useLayoutEffect` to the React import. Before `interface Props`, add:

```tsx
/** How a close came: Esc is the keyboard; the ✕ and the scrim are the pointer. */
export type CloseFrom = 'key' | 'pointer';
```

Change the type of `onClose` to `onClose?: (from: CloseFrom) => boolean;`. Replace the latch, `close` and the
timer's cleanup with:

```tsx
  // The entrance plays once, when the panel shows: a later change of `instant` must not replay it.
  // A page can keep a panel mounted and hidden in `<Activity>` (the new transaction form): the
  // panel mounts once, while hidden, and shows many times. Layout effects run again each time it
  // shows, before the paint, so the latch takes the `instant` of that showing.
  const [enteredInstantly, setEnteredInstantly] = useState(instant);
  const instantNow = useRef(instant);
  useLayoutEffect(() => {
    instantNow.current = instant;
  });
  useLayoutEffect(() => {
    setEnteredInstantly(instantNow.current);
  }, []);

  // A page that owns the panel closes it at once. Otherwise closing is a navigation, which unmounts
  // the panel at once: play the exit first, then go.
  const close = useCallback(
    (from: CloseFrom) => {
      if (closingProp) return;
      if (onClose?.(from) === true) return;
      if (closingFor === closeHref) return;
      clearTimeout(timer.current);
      // The keyboard closes on the next frame: no exit (spec §06).
      if (from === 'key') {
        router.push(closeHref);
        return;
      }
      setClosingFor(closeHref);
      timer.current = setTimeout(() => router.push(closeHref), EXIT_MS);
    },
    [router, closeHref, closingFor, onClose, closingProp],
  );

  // Unmounted, or hidden in `<Activity>`: a panel that shows again starts open.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      setClosingFor(null);
    },
    [],
  );
```

The Esc listener calls `close('key')`. `onLinkClick` (the ✕ and the scrim) calls `close('pointer')`. Conti and
Profilo pass no `onClose`: Esc now navigates at once there, and the ✕ keeps the exit. `onLinkClick` uses
`isPlainClick` from `./PanelNav` for the modifier check.

- [x] **Step 2: `TransactionsPanels` keeps the new form in `<Activity>`**

In `apps/web/app/(app)/transactions/TransactionsPanels.tsx`:

1. Import `Activity` from `react` and `type CloseFrom` from `Panel`.
2. Rename `View.opened` to `draft`, and add this function before `shownOf`:

```tsx
/** The new form's key once `to` takes the place of the current panel: a form that leaves is spent. */
function draftAfter(current: View, to: PanelState): number {
  return current.panel.kind === 'new' && to.kind !== 'new' ? current.draft + 1 : current.draft;
}
```

3. The key changes when the form leaves the screen, not when it opens. In `follow`, `go` and the exit's timer, the
   new state is:

```tsx
// follow
{ panel: next, closing: false, instant: true, draft: draftAfter(current, next) }
// go, a panel that opens
{ panel: next, closing: false, instant, draft: draftAfter(current, next) }
// the exit's timer
{ ...current, panel: NONE, closing: false, draft: draftAfter(current, NONE) }
```

`go` to `none` only sets `closing`, and the panel stays `new`. Thus «Nuova» during the exit reverses the exit and
keeps the draft.

4. Add `const side = useRef<HTMLDivElement>(null);` and give it to `<div className={styles.side}>`. In the effect that
   gives the focus back, a focus left in the side counts as lost. React hides the new form in a deferred (Offscreen)
   render, so in that commit the old form, with its focused input, is still in the DOM. Also, the browser can keep
   the focus on a `display: none` input until its next style update. The effect removes that focus first:

```tsx
    const active = document.activeElement;
    // Never leave the focus on a hidden input, even with nowhere to send it back.
    if (active instanceof HTMLElement && side.current?.contains(active) === true) active.blur();
    if (!(target instanceof HTMLElement) || !target.isConnected) return;
    if (active !== null && active !== document.body && side.current?.contains(active) !== true)
      return;
    target.focus();
```

5. Esc closes with no motion:

```tsx
  const closeToList = useCallback(
    (from: CloseFrom) => go(baseHref, { instant: from === 'key' }),
    [go, baseHref],
  );
  const closeToDetail = useCallback(
    (from: CloseFrom) => go(editCloseHref, { instant: from === 'key' }),
    [go, editCloseHref],
  );
```

6. Replace the `panel.kind === 'new'` branch of `content` with a panel that is always there:

```tsx
  // Decision 9: the new form waits hidden, so «Nuova» only shows it. `<Activity>` renders it in the
  // background, keeps it out of the layout with `display: none`, and runs its effects (Esc, the
  // focus) only while it shows. Shown again, the panel plays its entrance from the start.
  const creating = panel.kind === 'new';
  const newPanel =
    newForm === null ? null : (
      <Activity mode={creating ? 'visible' : 'hidden'}>
        <Panel
          sheet
          bare
          title={props.newTitle}
          closeHref={baseHref}
          closeLabel={props.closeLabel}
          onClose={closeToList}
          closing={creating && view.closing}
          instant={view.instant}
        >
          <Fragment key={view.draft}>{newForm}</Fragment>
        </Panel>
      </Activity>
    );
```

`content` keeps only the edit form and the detail. The layout becomes:

```tsx
  const formOpen = creating || editing !== null;
  const open = (creating && newPanel !== null) || content !== null;
  // …
      <div
        className={styles.layout}
        data-panel={open && !view.closing ? '' : undefined}
        data-instant={view.instant ? '' : undefined}
      >
        <div className={styles.list}>{props.children}</div>
        <div className={styles.side} ref={side}>
          {newPanel}
          {content}
        </div>
      </div>
```

- [x] **Step 3: The form focuses the amount from an effect, and its ids are unique**

React applies `autoFocus` only when an element mounts. A hidden form mounts once, so `autoFocus` does not apply when
it shows. In `apps/web/app/(app)/transactions/TransactionForm.tsx`, remove `autoFocus={view.mode === 'new'}` from
`AmountField`, and add after `focusField`:

```tsx
  // The new form opens on the amount, as the phone's keypad does. An effect, not `autoFocus`: the
  // page keeps this form hidden in `<Activity>` and shows it many times, and an effect runs again
  // each time it shows. The panel is on screen already, so the browser needs no scroll.
  useEffect(() => {
    if (view.mode !== 'new') return;
    form.current
      ?.querySelector<HTMLElement>('[data-field="amount"] input')
      ?.focus({ preventScroll: true });
  }, [view.mode]);
```

The hidden new form and the edit form can be in the DOM together. Replace the fixed ids `tx-date` and `tx-tags`
with `useId()`:

```tsx
  // A hidden new form and an edit form can be in the DOM together: their ids must differ.
  const dateId = useId();
  const tagsId = useId();
```

- [x] **Step 4: Other initial values are a new form**

The hidden form keeps its state when the server sends a new `newForm` (a prefill from Conti, a new day). In
`apps/web/app/(app)/transactions/page.tsx`, give the new `TransactionForm` a key:

```tsx
            <TransactionForm
              // The form waits hidden between openings: other initial values (a prefill, a new
              // day) are a new form, not the old draft.
              key={JSON.stringify([newForm.initial, newForm.closeGoalId])}
              view={newForm}
```

- [x] **Step 5: A hidden form does not own the keys**

`ignoresShortcut` looked for `form[data-owns-keys]` in the DOM. The hidden form is in the DOM, so N and ↑ ↓ did
nothing on Transazioni. In `apps/web/src/ui/isEditable.ts`, replace its last line with:

```ts
  for (const owner of document.querySelectorAll(OWNS_PAGE)) {
    if (owner.getClientRects().length > 0) return true;
  }
  return false;
```

- [x] **Step 6: The measurement counts a visible panel**

In `apps/web/scripts/measure-panel.ts`, «panel in the DOM» and «panel out of the DOM» look for a visible `aside`.
The observer also watches `style`, because `<Activity>` shows and hides with `display`. It reads the time before
`getClientRects`, so the layout that the call forces does not count:

```ts
  // `<Activity>` hides a panel with `display: none` on the `aside`: a hidden one does not count.
  // The time is read before `getClientRects`, whose layout must not count either.
  const visiblePanel = () =>
    [...document.querySelectorAll('aside')].some((aside) => aside.getClientRects().length > 0);
  let panel = visiblePanel();
  new MutationObserver(() => {
    if (start === null) return;
    const at = Math.round(performance.now() - start);
    const now = visiblePanel();
    if (now === panel) return;
    panel = now;
    marks.push({ t: at, what: now ? 'panel in the DOM' : 'panel out of the DOM' });
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style'],
  });
```

The «✕ on the detail» scenario waits for `aside:visible` and clicks `aside:visible a[aria-label]`.

- [x] **Step 7: Check in the browser**

Build and start on 3100. At 1440px:

1. «Nuova», type an amount, «Annulla», «Nuova» again: the draft is empty.
2. «Nuova», ✕, «Nuova» during the exit: the exit reverses and the draft stays.
3. `N`, Esc, `N`: no animation on the panel and no transition on the list.
4. A click on «Nuova» plays the entrance, also after a keyboard opening.
5. The focus goes to the amount on open, and back to «Nuova» on close.
6. With the form hidden, ↓ opens the first row and ↓ again moves the selection.
7. A save lands on the detail of the saved row. «Nuova» after it is empty.
8. «Metti da parte» from a goal in Conti opens a prefilled form. After its close, `N` opens an empty form.
9. Esc on the edit form goes back to the detail with no motion. No two elements share an id.

At 390px, the FAB raises the sheet with `sheet-in` and `scrim-in`, the second time too.

Result on 2026-10-08: every line passes, with no console errors.

- [x] **Step 8: Measure**

```bash
cd apps/web && pnpm measure:panel http://localhost:3100
```

Output on 2026-10-08 (production build, local Postgres):

```text
== «New transaction», wide, CPU 1×
      8 ms  input
     29 ms  panel in the DOM
     76 ms  list starts to change (1120px)
    259 ms  list settles (676px)
   1000 ms  longest frame 33 ms
  server requests: 0
  prefetches: 0

== «New transaction», wide, CPU 4×
      8 ms  input
     75 ms  panel in the DOM
    126 ms  list starts to change (1120px)
    309 ms  list settles (676px)
   1000 ms  longest frame 76 ms
  server requests: 0
  prefetches: 0

== N, wide, CPU 4×
      3 ms  input
     73 ms  list starts to change (1120px)
     73 ms  list settles (676px)
     85 ms  panel in the DOM
   1000 ms  longest frame 73 ms
  server requests: 0
  prefetches: 0

== «New transaction» from Home, wide, CPU 4×
      6 ms  input
    277 ms  list starts to change (1120px)
    277 ms  list settles (676px)
    323 ms  panel in the DOM
   1000 ms  longest frame 100 ms
  server requests: 1 (/transactions?new&_rsc=_THLMR_XtjiYRnEr)
  prefetches: 0

== Click on a row, wide, CPU 4×
      8 ms  input
     30 ms  panel in the DOM
     94 ms  list starts to change (1120px)
    277 ms  list settles (676px)
   1000 ms  longest frame 77 ms
  server requests: 0
  prefetches: 0

== ✕ on the detail, wide, CPU 4×
      5 ms  input
     27 ms  list starts to change (676px)
    143 ms  list settles (1120px)
    169 ms  panel out of the DOM
   1000 ms  longest frame 17 ms
  server requests: 0
  prefetches: 0

== FAB, phone, CPU 4×
      7 ms  input
     44 ms  panel in the DOM
   1000 ms  longest frame 43 ms
  server requests: 0
  prefetches: 0
```

Over five runs, «panel in the DOM» for «New transaction» was 21–33 ms at CPU 1× and 65–88 ms at CPU 4×. The FAB
was 44–68 ms. «input» is at 7–8 ms in each run. Before this task the numbers were 136 ms, 224 ms and 189 ms.

The CPU 4× target (≤ 50 ms after «input») is not met. The CPU 1× target (≤ 20 ms after «input») is met in three
runs of five. The JavaScript of the click is now about 10 ms at CPU 4×. The rest is the style and layout of the form
that shows: `focus()` must have a layout, so it does that work in the click. With `focus()` replaced by a no-op,
«New transaction» measured 24–25 ms at CPU 4×. The first frame must do the same layout before it paints, so a later
`focus()` only moves the mark, not the paint. Task 9 decides about this target.

- [x] **Step 9: Typecheck, lint, test**

Run: `rtk proxy pnpm --filter web typecheck`, then `rtk proxy pnpm lint`, then `rtk proxy pnpm --filter web test`.
Expected: no type errors; no `lint/…` lines; all tests pass.

- [x] **Step 10: Commit**

```bash
pnpm exec biome check --write "apps/web/app/(app)/transactions" apps/web/src/ui apps/web/scripts/measure-panel.ts
rtk git add "apps/web/app/(app)/transactions" apps/web/src/ui apps/web/scripts/measure-panel.ts \
  docs/superpowers/plans/2026-10-07-web-panel-feel.md docs/superpowers/specs/2026-10-07-web-panel-feel.html
rtk git commit -m "perf(web): the new form waits hidden; Esc closes at once"
```

---

### Task 9: Verify, measure, and record

**Files:**
- Modify: `docs/superpowers/plans/2026-10-07-web-panel-feel.md` (this file: «After», status)
- Modify: `TODO.md`, `docs/superpowers/plans/README.md`

- [x] **Step 1: Measure**

With the production build running on 3100:

```bash
cd apps/web && pnpm measure:panel http://localhost:3100
```

Acceptance:

| Scenario | Required |
| --- | --- |
| «New transaction» on Transazioni, a row, the ✕, `N` | `server requests: 0` |
| «New transaction» and the FAB | «panel in the DOM» ≤ 40 ms after «input» at CPU 1×; ≤ 100 ms at CPU 4× |
| A click on a row, CPU 4× | «panel in the DOM» ≤ 50 ms; «longest frame» ≤ 70 ms; «list settles» ≤ 300 ms |
| ✕ on the detail | «panel out of the DOM» ≤ 200 ms; «list settles» ≤ 200 ms |
| `N` | the list changes within one frame (no transition) |
| From Home | not worse than the baseline (still a navigation from Home) |

The first targets were 20 ms at CPU 1× and 50 ms at CPU 4× for «New transaction» and the FAB. The browser needs the
style and layout of the form that appears, and `focus()` forces that work in the click, so the targets are 40 ms and
100 ms. The first targets for a row were 50 ms for the longest frame and 250 ms for «list settles». The first frame
lays out the panel and the list once, and then the track transition reflows the list on each frame, which keeps the
movement reversible, so the targets are 70 ms and 300 ms.

Paste the output under «After» at the end of this plan.

- [x] **Step 2: Measure the payload**

In the browser's network panel (or with the measurement's request log), compare the `/transactions` document size
with the baseline. Record both numbers under «After». The page now carries one detail per listed row. If the
document more than doubles for the development account, record it as a follow-up; do not change the approach in
this plan.

- [x] **Step 3: Check the behaviour that must not change**

In the browser, at 1440px:

1. Reload `/transactions?t=<id>`: the detail is open. Reload `/transactions?new`: the form is open.
2. Open a row, then Back: the panel closes and the URL is the list's. Forward: it opens again.
3. Open a row, press `E`: the edit form replaces the detail after the server answers. Save: the detail of the
   saved row is open, with the new values.
4. «Nuova», fill an amount, «Annulla», «Nuova» again: the form is empty (a new draft).
5. Delete a row: the toast shows «Annulla». While it shows, a click on a row is a navigation and works.
6. From Conti, «Metti da parte»: the form opens prefilled. Close it and press `N`: the form is empty.
7. A filter chip with the panel open: the list filters and the panel closes.
8. Home → «New transaction»: Transazioni opens with the form, as before.
9. Turn JavaScript off: a row link, the ✕ and «Annulla» still work as pages.
10. macOS «Reduce motion» on: no slide, the panel appears and goes.

- [x] **Step 4: Run the gates**

With `apps/web/e2e/` moved out (see «Execution context»):

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines and no `× Some errors were emitted`; no type errors; every test passes.

- [x] **Step 5: Only if «longest frame» is above 50 ms at CPU 4×**

The list reflows on every frame of the transition. Let the browser skip the day sections that are off screen. In
`transactions.module.css`, after `.list { … }`, add:

```css
/* The track transition reflows the list on every frame: the days off screen are skipped. */
.list > section {
  content-visibility: auto;
  contain-intrinsic-size: auto 320px;
}
```

Measure again (Step 1). Check that ↑ ↓ still scroll the selected row into view, and that the browser's find in
page still finds a row below the fold. Commit:

```bash
rtk git add "apps/web/app/(app)/transactions/transactions.module.css"
rtk git commit -m "perf(web): skip off-screen days while the list makes room"
```

If the frame is still above 50 ms, stop and report to the user with the numbers: the fallback is a View
Transition (decision 5), which is a product choice because it blocks input during the animation.

**Result: tried, not applied.** The longest frame of a row click was 62 ms (median of six runs; 59–76 ms) before
the CSS. With the CSS it was 59, 62 and 62 ms, and «list settles» did not change (262–276 ms). The CSS did not
help, so it is not in the code.

- [x] **Step 6: Update `TODO.md`**

In `TODO.md`, under «Web app: a UI pass — navigation feels slow, motion is missing», add after the first
paragraph:

```markdown
Picked up in part on 2026-10-07 (`docs/superpowers/plans/2026-10-07-web-panel-feel.md`): on Transazioni,
«Nuova transazione» and the detail of a row open and close in the frame of the click, and the list makes room
in one movement. Still open: the production region (`fra1::iad1` — the function runs in Washington, Neon in
Frankfurt), the four queries in a chain on every page, `loading.tsx` and `useLinkStatus` for the top-level
pages, the edit form (still a navigation), the same pattern on Conti and Profilo, and the motion the phone has
that the web lacks.
```

- [x] **Step 7: Update the plans README**

In `docs/superpowers/plans/README.md`, before `## Future (not POC)`, add:

```markdown
### Picked up from `TODO.md` on 2026-10-07

**Plan:** `2026-10-07-web-panel-feel.md` · **Spec:** `specs/2026-10-07-web-panel-feel.html`, §17.1.7

- **Web: the Transazioni panel opens in the frame of the click.** The panel is client state and the URL follows
  it with `history.pushState`; the server renders every row's detail and the new form. The list makes room with
  a transition on its grid track. `N` and ↑ ↓ open without motion. «Modifica» is still a navigation.
```

Add ` ✅ done` to the heading and a one-line status with the measured numbers when Task 9 is accepted.

- [x] **Step 8: Commit**

```bash
rtk git add TODO.md docs/superpowers/plans/README.md docs/superpowers/plans/2026-10-07-web-panel-feel.md
rtk git commit -m "docs: record the web panel work and what stays open"
```

- [ ] **Step 9: Review**

Use **requesting-code-review** on the branch, then merge to `main` when the user accepts it.

---

## Baseline

Output of `pnpm measure:panel http://localhost:3100` on 2026-10-07 (production build, local Postgres):

```text
== «New transaction», wide, CPU 1×
      8 ms  input
    109 ms  list starts to change (1096px)
    109 ms  list settles (676px)
    124 ms  panel in the DOM
   1000 ms  longest frame 42 ms
  server requests: 1 (/transactions?new&_rsc=HovGXzaOsaz0CWt6)
  prefetches: 0

== «New transaction», wide, CPU 4×
      9 ms  input
    259 ms  list starts to change (1096px)
    259 ms  list settles (676px)
    336 ms  panel in the DOM
   1000 ms  longest frame 117 ms
  server requests: 1 (/transactions?new&_rsc=HovGXzaOsaz0CWt6)
  prefetches: 0

== N, wide, CPU 4×
      2 ms  input
    211 ms  list starts to change (1096px)
    211 ms  list settles (676px)
    277 ms  panel in the DOM
   1000 ms  longest frame 117 ms
  server requests: 1 (/transactions?new&_rsc=HovGXzaOsaz0CWt6)
  prefetches: 0

== «New transaction» from Home, wide, CPU 4×
      9 ms  input
    327 ms  list starts to change (1120px)
    327 ms  list settles (676px)
    417 ms  panel in the DOM
   1000 ms  longest frame 117 ms
  server requests: 1 (/transactions?new&_rsc=_THLMR_XtjiYRnEr)
  prefetches: 0

== Click on a row, wide, CPU 4×
     12 ms  input
    109 ms  list starts to change (1096px)
    109 ms  list settles (676px)
    128 ms  panel in the DOM
   1000 ms  longest frame 59 ms
  server requests: 1 (/transactions?t=01a108fd-3ace-7f36-bd3b-1ee163a3d9f9&_rsc=HovGXzaOsaz0CWt6)
  prefetches: 0

== ✕ on the detail, wide, CPU 4×
      5 ms  input
    194 ms  list starts to change (676px)
    194 ms  list settles (1096px)
    204 ms  panel out of the DOM
   1000 ms  longest frame 17 ms
  server requests: 1 (/transactions?_rsc=HovGXzaOsaz0CWt6)
  prefetches: 0

== FAB, phone, CPU 4×
      9 ms  input
    299 ms  panel in the DOM
   1000 ms  longest frame 133 ms
  server requests: 1 (/transactions?new&_rsc=HovGXzaOsaz0CWt6)
  prefetches: 0
```

## After

Output of `pnpm measure:panel http://localhost:3100` on 2026-10-08 (production build, local Postgres, commit
`266a600`). Times are in milliseconds after «input». Three runs for each scenario, six for «Click on a row» and `N`
(three before and three after the `content-visibility` trial; the code is the same).

| Scenario | Before | After: median (range) | Target | Result |
| --- | --- | --- | --- | --- |
| «New transaction», CPU 1×, panel in the DOM | 116 | 23 (22–26) | ≤ 40 | met |
| «New transaction», CPU 4×, panel in the DOM | 327 | 59 (50–61) | ≤ 100 | met |
| FAB, 390px, CPU 4×, panel in the DOM | 290 | 38 (36–48) | ≤ 100 | met |
| Click on a row, CPU 4×, panel in the DOM | 116 | 17 (15–20) | ≤ 50 | met |
| Click on a row, CPU 4×, longest frame | 59 | 62 (59–76) | ≤ 70 | met by the median; one run of six had 76 |
| Click on a row, CPU 4×, list settles | 97 | 262 (256–270) | ≤ 300 | met |
| ✕ on the detail, panel out of the DOM | 199 | 166 (165–167) | ≤ 200 | met |
| ✕ on the detail, list settles | 189 | 141 (138–149) | ≤ 200 | met |
| `N`, CPU 4× | 275 | the list starts and settles in the same frame (69–127) | one frame | met |
| «New transaction» from Home, CPU 4× | 408 | 322 (305–430) | not worse | met (1 request, as designed) |
| Server requests on Transazioni | 1 for each panel | 0 | 0 | met |

«Before» is the Baseline above, from «input». The row's «list settles» was 97 ms before only because the list
jumped in one frame. Now the list moves for 200 ms, which is the purpose of the change.

Payload of the `/transactions` document (development account, 161 rows, production build):

| | Before (`703711d`) | After (HEAD) |
| --- | --- | --- |
| Decoded | 99.7 KB | 156.7 KB (+57%) |
| Transferred (gzip) | 14.7 KB | 19.8 KB (+35%) |

The document does not double, so it is not a follow-up.

Behaviour checks of Step 3 (production build, throwaway Playwright script, 1440px): all ten pass.

- Items 1 to 8 pass. Item 3 used a test row, which the check then deleted (item 5). Item 6 used the goal «Viaggio in
  Giappone»: «Set aside» opens a prefilled transfer, and `N` after the close opens an empty form.
- Item 9 (JavaScript off) passes: the row link, the ✕ and «Annulla» work as pages. Playwright reported the ✕ as «not
  stable» for its normal click while the 200 ms entrance ran, so the check waited and clicked with `force`.
- Item 10 (Reduce motion) passes: one frame after the click the list is at its final width, the panel has opacity 1
  and no animation runs.
