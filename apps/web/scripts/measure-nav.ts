/**
 * How fast a navigation shows its state (2026-10-11 plan): for four inputs, the time from the click
 * to the first change on the page («feedback») and to the new content («settled»).
 *
 *   pnpm --filter web exec playwright install chromium   (once)
 *   pnpm --filter web measure:nav http://localhost:3100 [userId]
 *
 * Development only. Same guard as `measure-panel.ts`: it signs a person in by writing a session row,
 * so it runs against a local server AND a local database only, and it deletes the session when it
 * ends. Run it against `next build && next start`: a dev server measures the compiler, not the app.
 * Chrome runs with the CPU four times slower, at 1440px. Each input runs `RUNS` times in a new
 * browser context; the line shows the median and every run.
 *
 * - feedback: the first change in `document.body` (attributes, childList, subtree) after the
 *   first `pointerdown`.
 * - settled: the first moment when the URL (path and query) differs from the one before the click
 *   AND `main` holds no `[data-skeleton]` (the root of `PageSkeleton`, drawn by a `loading.tsx`).
 *   A URL changes when the navigation commits. Before a `loading.tsx` exists, that commit already
 *   holds the content. After it, the skeleton commits first, so the second condition waits for the
 *   content. The predicate runs in the `MutationObserver` callback, where `feedback` is stamped
 *   too, and on each frame as a fallback (a URL change is not a DOM mutation). Only Conti has a
 *   `main h1`, so a new `h1` cannot be the test for the other tabs.
 */
import { type Browser, chromium } from '@playwright/test';
import { closeDb } from '../src/server/db/client';
import { assertLocalOnly, type DevSession, onlyUser, openSession } from './lib/devSession';

const RUNS = 5;
const TIMEOUT = 20_000;

interface Input {
  label: string;
  from: string;
  /** The element to click. */
  act: string;
}

const INPUTS: Input[] = [
  { label: 'tab Conti → Stats', from: '/accounts', act: 'nav a[href="/stats"]:visible' },
  {
    label: 'tab Home → Transazioni',
    from: '/home',
    act: 'nav a[href="/transactions"]:visible',
  },
  {
    label: 'chip on Transazioni',
    from: '/transactions',
    act: 'main a[href*="direction=expense"]:visible',
  },
  {
    label: 'period ‹ on Transazioni',
    from: '/transactions',
    // A link with a label and a `p=` period in its href: the ‹ of the stepper (the › may be a
    // span). The other links with a label in `main` do not carry `p=`.
    act: 'main a[aria-label][href*="p="]:visible',
  },
];

interface Marks {
  start: number | null;
  feedback: number | null;
  settled: number | null;
}

/** Runs in the page. A string, so that tsx does not add its `__name` helper to it. */
const PROBE = `(() => {
  const url = () => location.pathname + location.search;
  const before = url();
  const marks = { start: null, feedback: null, settled: null };
  window.__marks = marks;
  const check = () => {
    if (marks.start === null || marks.settled !== null) return;
    if (url() !== before && document.querySelector('main [data-skeleton]') === null) {
      marks.settled = performance.now();
    }
  };
  document.addEventListener('pointerdown', (event) => {
    if (marks.start === null) marks.start = event.timeStamp;
  }, { capture: true });
  new MutationObserver(() => {
    if (marks.start !== null && marks.feedback === null) marks.feedback = performance.now();
    check();
  }).observe(document.body, { attributes: true, childList: true, subtree: true });
  const frame = () => {
    check();
    if (marks.settled === null) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})()`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

async function run(
  browser: Browser,
  base: string,
  cookie: ReturnType<DevSession['cookie']>,
  input: Input,
): Promise<{ feedback: number; settled: number }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    await context.addCookies([cookie]);
    const page = await context.newPage();
    await page.goto(base + input.from, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(PROBE);
    await page.locator(input.act).first().click();
    // A function, not a string: the app's CSP forbids the `eval` that Playwright uses for a string.
    // `__marks?.` so that a full reload shows «No marks», not a TypeError.
    await page.waitForFunction(
      () => (window as unknown as { __marks?: Marks }).__marks?.settled != null,
      undefined,
      { timeout: TIMEOUT, polling: 100 },
    );
    const marks = await page.evaluate(() => (window as unknown as { __marks?: Marks }).__marks);
    if (marks?.start == null || marks.settled === null) throw new Error('No marks: page reloaded?');
    return {
      feedback: (marks.feedback ?? marks.settled) - marks.start,
      settled: marks.settled - marks.start,
    };
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
  assertLocalOnly(base);
  let browser: Browser | undefined;
  let session: DevSession | undefined;
  try {
    const userId = await onlyUser(process.argv[3]);
    // Our `close` closes the browser. Playwright's own handler would exit before the delete.
    const opened = await openSession(
      userId,
      'measure-nav',
      () => browser?.close() ?? Promise.resolve(),
    );
    session = opened;
    browser = await chromium.launch({ handleSIGINT: false });
    for (const input of INPUTS) {
      const feedback: number[] = [];
      const settled: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        const result = await run(browser, base, opened.cookie(base), input);
        feedback.push(result.feedback);
        settled.push(result.settled);
      }
      const all = (values: number[]) => values.map((value) => Math.round(value)).join('/');
      console.log(
        `${input.label.padEnd(26)} feedback ${Math.round(median(feedback))} ms (${all(feedback)}) · settled ${Math.round(median(settled))} ms (${all(settled)})`,
      );
    }
  } finally {
    await (session?.close() ?? closeDb());
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
