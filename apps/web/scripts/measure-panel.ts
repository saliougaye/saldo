/**
 * How the Transazioni panel opens and closes in a real browser (2026-10-07 plan): from the input to
 * the panel in the DOM, the server requests on the way, when the list's width starts and stops
 * changing, and the longest gap between two frames in the second after the input. A View
 * Transition shows as «view transition starts» and «view transition done»: during it the list's
 * width changes in one frame, and the browser draws the movement from snapshots.
 *
 *   pnpm --filter web exec playwright install chromium   (once)
 *   pnpm --filter web measure:panel http://localhost:3100 [userId]
 *
 * Development only. It signs a person in by writing a session row and its signed cookie, so it
 * refuses anything but a local server AND a local database (the host of `DATABASE_URL` must be
 * localhost or 127.0.0.1). It deletes the session when it ends, on an error and on Ctrl-C too.
 * Run it against `next build && next start`: a dev server measures the compiler, not the app.
 * «server requests» counts RSC requests that are not prefetches. A hover can start a prefetch
 * (`next-router-prefetch: 1`), so those are counted on their own line. «panel in the DOM» means a
 * visible `aside`: Transazioni keeps its new form in the DOM, hidden by `<Activity>`.
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
      await p.waitForSelector('aside:visible');
    },
    act: (p) => p.locator('aside:visible a[aria-label]').first().click(),
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
  // A View Transition (decision 5): when it starts, and when its animation is done and the page
  // takes input again.
  if ('startViewTransition' in document) {
    const native = document.startViewTransition.bind(document);
    document.startViewTransition = (
      options?: ViewTransitionUpdateCallback | StartViewTransitionOptions,
    ) => {
      const transition = native(options);
      if (start !== null) {
        mark('view transition starts');
        const done = () => mark('view transition done');
        transition.finished.then(done, done);
      }
      return transition;
    };
  }
  document.addEventListener('pointerdown', begin, { capture: true });
  document.addEventListener('keydown', begin, { capture: true });
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
