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
 * - settled: the first frame where `settled` is true. For a tab and for a period arrow, that is a
 *   new URL; for a chip, an `aria-current` chip that was not on the page before. A URL changes when
 *   the navigation commits: with a `loading.tsx` that is the skeleton, not the data.
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
  /** A page expression: true when the new content shows. `before` is the state before the click. */
  settled: string;
}

const URL_CHANGED = 'location.pathname + location.search !== before.url';

const INPUTS: Input[] = [
  {
    label: 'tab Conti → Stats',
    from: '/accounts',
    act: 'nav a[href="/stats"]:visible',
    settled: URL_CHANGED,
  },
  {
    label: 'tab Home → Transazioni',
    from: '/home',
    act: 'nav a[href="/transactions"]:visible',
    settled: URL_CHANGED,
  },
  {
    label: 'chip on Transazioni',
    from: '/transactions',
    act: 'main a[href*="direction=expense"]:visible',
    settled: `document.querySelectorAll('main a[aria-current="true"]').length > before.current`,
  },
  {
    label: 'period ‹ on Transazioni',
    from: '/transactions',
    // The ‹ comes first in the stepper, and the only links with a label in `main` are the stepper's.
    act: 'main a[aria-label][href*="p="]:visible',
    settled: URL_CHANGED,
  },
];

interface Marks {
  start: number | null;
  feedback: number | null;
  settled: number | null;
}

/** Runs in the page. A string, so that tsx does not add its `__name` helper to it. */
const probe = (settled: string): string => `(() => {
  const before = {
    url: location.pathname + location.search,
    current: document.querySelectorAll('main a[aria-current="true"]').length,
  };
  const marks = { start: null, feedback: null, settled: null };
  window.__marks = marks;
  document.addEventListener('pointerdown', (event) => {
    if (marks.start === null) marks.start = event.timeStamp;
  }, { capture: true });
  new MutationObserver(() => {
    if (marks.start !== null && marks.feedback === null) marks.feedback = performance.now();
  }).observe(document.body, { attributes: true, childList: true, subtree: true });
  const check = () => {
    if (marks.start !== null && marks.settled === null && (${settled})) {
      marks.settled = performance.now();
    }
    if (marks.settled === null) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
})()`;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

async function run(
  browser: Browser,
  base: string,
  cookie: { name: string; value: string; url: string },
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
    await page.evaluate(probe(input.settled));
    await page.locator(input.act).first().click();
    // A function, not a string: the app's CSP forbids the `eval` that Playwright uses for a string.
    await page.waitForFunction(
      () => (window as unknown as { __marks: Marks }).__marks.settled !== null,
      undefined,
      { timeout: TIMEOUT },
    );
    const marks = await page.evaluate(() => (window as unknown as { __marks: Marks }).__marks);
    if (marks.start === null || marks.settled === null) throw new Error('No marks: page reloaded?');
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
