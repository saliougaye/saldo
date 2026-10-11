# Web: the time zone list of Preferences opens in place — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/profile/preferences`, a click on «Fuso orario» opens its panel in the frame of the click, with no request to the server. The hour in each zone is right while the panel is open.

**Architecture:** The browser makes the list. The page sends only the saved zone, the language, the minute of the render and the strings. A client module makes the rows from the static tables of `@saldo/i18n` (a new subpath `@saldo/i18n/timeZones`). It calculates the hours with `wallClock`. A `useSyncExternalStore` hook gives the current minute: the minute of the render on the server and in the hydration, the minute of the browser after it. `edit:timeZone` is always in the `panels` of `PanelSwitch`. The save does not change.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-web-timezone-in-place.html`. On this topic, that spec wins over this plan. The rules for panel motion, focus and Esc stay in `docs/superpowers/specs/2026-10-07-web-panel-feel.html`.

**Out of scope:** the edit form of a transaction (`?t=ID&edit`) and of an account (`?a=ID&edit`). They stay navigations. Do not change their code.

---

## Rules for every task

- **Gates.** Read the output, not the exit code (AGENTS.md «Reading the results»). Run `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck --force` and `rtk proxy pnpm --filter web test`. A clean lint has **no** `lint/…` lines and no `× Some errors were emitted while running checks.`
- To test one file, run `rtk proxy pnpm --filter web test <pattern>`, with no `--`.
- Fix the format before each commit: `pnpm exec biome check --write <files>`.
- Another agent uses ports 3000, 3100 and 3102. Start the manual production server on port 3101. Run the e2e suite with `E2E_PORT=3105 E2E_DB_PORT=54335`.
- The manual server uses the database `saldo_editinplace`, a copy of the development database. `apps/web/.env` of the worktree points at it, with `PUBLIC_URL=http://localhost:3101`. Do not commit `.env`.
- Commit each task with a Conventional Commit. End each message with the `Co-Authored-By:` line that the session gives.
- Work on the branch `fix/web-edit-in-place`, cut from `main`. Do not push and do not merge.

## File structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `packages/i18n/package.json` | Modify | Export `./timeZones`, a subpath with no catalog. |
| `apps/web/src/ui/clientImports.test.ts` | Modify | The subpath loads without the catalogs. |
| `apps/web/src/features/profile/timeZoneRows.ts` + `.test.ts` | Create | Pure: the rows of the list and the hour of each row. |
| `apps/web/src/features/profile/useMinute.ts` | Create | The current minute, with the minute of the render for the hydration. |
| `apps/web/src/features/profile/zoneCache.ts` + `.test.ts` | Create (Task 5) | The rows and the hours of one minute, kept between renders, for the warm-up. |
| `apps/web/src/features/profile/deviceZone.ts` | Modify | Read the aliases from the static table. |
| `apps/web/src/features/profile/preferenceOptions.ts` | Modify | Delete `timeZoneOptions`, `ZoneOption` and `TimeZoneOptions`. |
| `apps/web/app/(app)/profile/preferences/TimeZonePanel.tsx` | Modify | Make the rows in the browser. |
| `apps/web/app/(app)/profile/preferences/page.tsx` | Modify | `edit:timeZone` is always a panel. Send `locale` and `renderedAt`. |
| `apps/web/e2e/profile.spec.ts` | Modify | The row opens the panel in place, and the hours are the browser's. |

---

### Task 1: The subpath `@saldo/i18n/timeZones`

**Files:**
- Modify: `packages/i18n/package.json`
- Modify: `apps/web/src/ui/clientImports.test.ts`

- [x] **Step 1: Write the failing test.** In `clientImports.test.ts`, add the subpath to the test «can reach the formatter and the translator without the catalogs»:

```ts
    const zones = await import('@saldo/i18n/timeZones');
    expect(typeof zones.timeZoneCity).toBe('function');
```

- [x] **Step 2: Run it and see it fail.** Run: `rtk proxy pnpm --filter web test clientImports`. Expected: FAIL, because the package does not export `./timeZones`.

- [x] **Step 3: Add the export.** In `packages/i18n/package.json`:

```json
  "exports": {
    ".": "./src/index.ts",
    "./format": "./src/format.ts",
    "./timeZones": "./src/timeZones.ts",
    "./translate": "./src/translate.ts"
  },
```

`timeZones.ts` imports `./format` for a type only, `./timeZoneCities` and `./timeZones.generated`. It imports no catalog.

- [x] **Step 4: Run the test, then commit.** Expected: PASS.

```bash
git add packages/i18n/package.json apps/web/src/ui/clientImports.test.ts
git commit -m "feat(i18n): a subpath for the time zone tables, with no catalog"
```

### Task 2: The rows and the hours, as pure functions

**Files:**
- Create: `apps/web/src/features/profile/timeZoneRows.ts`
- Test: `apps/web/src/features/profile/timeZoneRows.test.ts`

The test fixes the text of the rows at one instant. This is the guard that the browser shows the text that the server showed (spec §05). It covers dates: the hour in two zones on the two sides of a change of daylight saving time.

- [x] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { timeZoneRows, zoneTimes } from './timeZoneRows';

// 2026-03-29 00:30 UTC: Rome is still on winter time (01:30), London too (00:30). One hour later
// both have moved to summer time.
const BEFORE = new Date(Date.UTC(2026, 2, 29, 0, 30));
const AFTER = new Date(Date.UTC(2026, 2, 29, 1, 30));

describe('timeZoneRows', () => {
  it('gives every zone with its city and its name, sorted by city in the language', () => {
    const rows = timeZoneRows('it', null);
    const rome = rows.find((row) => row.zone === 'Europe/Rome');
    expect(rome).toEqual({ zone: 'Europe/Rome', city: 'Roma', name: 'Ora dell’Europa centrale' });
    const cities = rows.map((row) => row.city);
    expect(cities).toEqual([...cities].sort(new Intl.Collator('it').compare));
    expect(timeZoneRows('en', null).find((row) => row.zone === 'Europe/Rome')?.city).toBe('Rome');
  });

  it('adds the saved zone when the table does not list it, under its CLDR id', () => {
    expect(timeZoneRows('en', null).some((row) => row.zone === 'Etc/GMT+5')).toBe(false);
    const rows = timeZoneRows('en', 'Etc/GMT+5');
    expect(rows.find((row) => row.zone === 'Etc/GMT+5')).toEqual({
      zone: 'Etc/GMT+5',
      city: 'GMT+5',
      name: undefined,
    });
    // An alias is not a new row: Asia/Kolkata is listed as Asia/Calcutta.
    expect(timeZoneRows('en', 'Asia/Kolkata').length).toBe(timeZoneRows('en', null).length);
  });
});

describe('zoneTimes', () => {
  it('gives the wall time of each zone at the instant, 24-hour', () => {
    expect(zoneTimes(['Europe/Rome', 'Europe/London'], BEFORE)).toEqual(
      new Map([
        ['Europe/Rome', '01:30'],
        ['Europe/London', '00:30'],
      ]),
    );
    expect(zoneTimes(['Europe/Rome', 'Europe/London'], AFTER)).toEqual(
      new Map([
        ['Europe/Rome', '03:30'],
        ['Europe/London', '02:30'],
      ]),
    );
  });

  it('leaves out a zone that Intl does not know', () => {
    expect(zoneTimes(['Mars/Olympus'], BEFORE).has('Mars/Olympus')).toBe(false);
  });
});
```

On 2026-10-11 every zone of `Intl.supportedValuesOf('timeZone')` in Node is in `TIME_ZONES` or in `TIME_ZONE_ALIASES`. `Etc/GMT+5` is not in the two tables, and `Intl` knows it. A phone can store such an id. The city of an unlisted zone comes from its id (`timeZoneCity`).

- [x] **Step 2: Run it and see it fail.** Run: `rtk proxy pnpm --filter web test timeZoneRows`. Expected: FAIL, because the module does not exist.

- [x] **Step 3: Write `timeZoneRows.ts`.**

```ts
import {
  canonicalTimeZone,
  formatWallTime,
  TIME_ZONES,
  timeZoneCity,
  timeZoneName,
  wallClock,
} from '@saldo/i18n/timeZones';
import type { AppLocale } from '@saldo/i18n/format';

/** One row of the time zone list (§6.8): the zone, its city and its name in the app's language. */
export interface ZoneRow {
  zone: string;
  city: string;
  /** «Ora dell’Europa centrale»; absent for an id CLDR does not list. */
  name?: string;
}

/**
 * Every zone of the list, sorted by city in the app's language, plus the saved one if the list does
 * not hold it (a zone `Intl` knows and CLDR does not name), so the panel can always show what is
 * selected. Static data: the browser makes it from the tables, the server sends no list.
 */
export function timeZoneRows(locale: AppLocale, saved: string | null): ZoneRow[] {
  const ids: string[] = [...TIME_ZONES];
  const current = saved === null ? null : canonicalTimeZone(saved);
  if (current !== null && !ids.includes(current)) ids.push(current);
  const collator = new Intl.Collator(locale);
  return ids
    .map((zone): ZoneRow => ({
      zone,
      city: timeZoneCity(zone, locale),
      name: timeZoneName(zone, locale),
    }))
    .sort((a, b) => collator.compare(a.city, b.city));
}

/** The wall time in each zone at `now`, `07:04`. A zone that `Intl` does not know has no entry. */
export function zoneTimes(zones: readonly string[], now: Date): Map<string, string> {
  const times = new Map<string, string>();
  for (const zone of zones) {
    const clock = wallClock(zone, now);
    if (clock !== null) times.set(zone, formatWallTime(clock));
  }
  return times;
}
```

`Intl.Collator(locale).compare` is the comparison of `String.prototype.localeCompare(b, locale)`, which `timeZoneOptions` used on the server.

On 2026-10-11 the work also put `minuteOf` (Task 3, step 2) in this module in this task, with one more test: the first instant of a minute shows the same hours as the last instant (`Asia/Kathmandu`, +05:45). The code in `apps/web/src/features/profile/timeZoneRows.ts` is the reference.

- [x] **Step 4: Run the test.** Expected: PASS.

  On 2026-10-11: 5 passed.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src/features/profile/timeZoneRows.ts apps/web/src/features/profile/timeZoneRows.test.ts
git commit -m "feat(web): the rows and the hours of the time zone list, as pure functions"
```

### Task 3: The panel makes its list in the browser

**Files:**
- Create: `apps/web/src/features/profile/useMinute.ts`
- Modify: `apps/web/src/features/profile/deviceZone.ts`, `apps/web/src/features/profile/preferenceOptions.ts`
- Modify: `apps/web/app/(app)/profile/preferences/TimeZonePanel.tsx`, `apps/web/app/(app)/profile/preferences/page.tsx`
- Test: `apps/web/e2e/profile.spec.ts` (must stay green)

- [x] **Step 1: Run the e2e flow of the profile first (baseline).** Run: `E2E_PORT=3105 E2E_DB_PORT=54335 rtk proxy pnpm --filter web e2e profile`. Expected: PASS.

- [x] **Step 2: Write `useMinute.ts`.**

```ts
'use client';

import { useSyncExternalStore } from 'react';

const MINUTE = 60_000;

/** The minute of `Date.now()`, as a whole number. */
function currentMinute(): number {
  return Math.floor(Date.now() / MINUTE);
}

/** One timer for the next minute, then one for each minute after it. */
function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(
      () => {
        onChange();
        schedule();
      },
      MINUTE - (Date.now() % MINUTE),
    );
  };
  schedule();
  return () => clearTimeout(timer);
}

/**
 * The current minute (`Date.now() / 60000`, whole), new at each minute while a component reads it.
 * The server and the hydration read `renderedAt`, the minute of the server's render: thus the
 * hydration finds the server's text, and React renders the browser's minute after it.
 */
export function useMinute(renderedAt: number): number {
  return useSyncExternalStore(subscribe, currentMinute, () => renderedAt);
}
```

The server page also needs the minute of the render. Next makes every export of a `'use client'` module a client reference, so a server component cannot call a function of `useMinute.ts`. Thus add `minuteOf` to `timeZoneRows.ts`, which has no directive:

```ts
/** The minute of `date` as a whole number: what `useMinute` reads. */
export function minuteOf(date: Date): number {
  return Math.floor(date.getTime() / 60_000);
}
```

- [x] **Step 3: Read the aliases from the static table.** In `deviceZone.ts`, delete the `aliases` parameter. Import `TIME_ZONE_ALIASES` from `@saldo/i18n/timeZones`:

```ts
import { TIME_ZONE_ALIASES } from '@saldo/i18n/timeZones';

/**
 * The id the time-zone list holds for a zone the browser reports, or null when it holds none: a
 * browser says Asia/Kolkata where CLDR lists Asia/Calcutta.
 */
export function listedZone(zone: string | undefined, known: ReadonlySet<string>): string | null {
  if (zone === undefined || zone === '') return null;
  const id = Object.hasOwn(TIME_ZONE_ALIASES, zone) ? (TIME_ZONE_ALIASES[zone] ?? zone) : zone;
  return known.has(id) ? id : null;
}
```

- [x] **Step 4: Change `TimeZonePanel`.** The props are `saved`, `locale`, `renderedAt` and `strings`. The rows come from `timeZoneRows`, and the hours from `zoneTimes` at the minute of `useMinute`:

```tsx
export function TimeZonePanel({ saved, locale, renderedAt, strings }: Props) {
  const { shown, error, save } = useSaveSetting(saved);
  const [query, setQuery] = useState('');
  const zones = useMemo(() => timeZoneRows(locale, saved), [locale, saved]);
  const ids = useMemo(() => zones.map((row) => row.zone), [zones]);
  const byZone = useMemo(() => new Map(zones.map((row) => [row.zone, row])), [zones]);
  const minute = useMinute(renderedAt);
  const times = useMemo(() => zoneTimes(ids, new Date(minute * 60_000)), [ids, minute]);
  // … `device` as before, with `listedZone(reported, new Set(ids))` …
  // … `groups` as before, with `ids` in place of `zones.map((option) => option.zone)` …
  const rows = (list: readonly string[]): ListOption<string>[] =>
    list.map((zone) => ({
      value: zone,
      label: byZone.get(zone)?.city ?? zone,
      subtitle: byZone.get(zone)?.name,
      detail: times.get(zone),
    }));
  // … the render does not change …
}
```

`new Date(minute * 60_000)` is the first instant of the minute. The hour of a zone does not change in the minute, because every zone offset is a whole number of minutes.

- [x] **Step 5: Change the page.** In `page.tsx`, delete `ON_REQUEST` and the filter on it: every row has its panel. Give the panel the new props:

```tsx
      case 'timeZone': {
        const saved = settings.timeZone ?? null;
        return (
          <TimeZonePanel
            saved={saved === null ? null : canonicalTimeZone(saved)}
            locale={locale}
            renderedAt={minuteOf(new Date())}
            strings={{ /* unchanged */ }}
          />
        );
      }
```

Update the comment above `panels`: every editor is rendered here, and a click only chooses one. Delete `timeZoneOptions`, `ZoneOption` and `TimeZoneOptions` from `preferenceOptions.ts`, and the imports that only they used (`canonicalTimeZone`, `formatWallTime`, `TIME_ZONE_ALIASES`, `TIME_ZONES`, `timeZoneCity`, `timeZoneName`, `wallClock`). Keep the comment at the top of the file true: the time zone rows are now the one exception that the browser makes.

- [x] **Step 6: Run the gates and the e2e flow.** Run the three gates, then `E2E_PORT=3105 E2E_DB_PORT=54335 rtk proxy pnpm --filter web e2e profile`. Expected: PASS, with the same count as step 1.

  On 2026-10-11: step 1 gave 9 passed, and step 6 gave 9 passed. `pnpm lint` checked 1101 files with no `lint/` line. `pnpm --filter web typecheck` gave no `error TS`. The web tests gave 108 files and 499 tests passed (1 file and 3 tests skipped).

- [x] **Step 7: Commit.**

```bash
git add -A apps/web packages/i18n
git commit -m "feat(web): Preferenze → the time zone list opens in place, with the browser's hours"
```

### Task 4: An e2e test for the panel in place

**Files:**
- Modify: `apps/web/e2e/profile.spec.ts`

The test covers the flow of the screen (AGENTS.md «Tests»): a click on the row opens the panel with no RSC request, the hours are the browser's, Esc closes, and the focus returns.

- [x] **Step 1: Write the test.** Add it after «the time zone is searched by city…»:

```ts
test('the time zone row opens its list in place, with the hours of this browser', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Fuso Posto',
    email: 'prefs-zone-place@e2e.test',
  });
  const { page } = member;
  await page.goto(PREFERENCES);
  const requests: string[] = [];
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers.rsc === '1' && headers['next-router-prefetch'] === undefined) {
      requests.push(request.url());
    }
  });

  const zoneRow = row(page, t('profile.timeZone'));
  await zoneRow.click();
  await expect(page).toHaveURL(/edit=timeZone$/);
  const list = page.getByRole('radiogroup', { name: t('profile.timeZone') });
  const tokyo = timeZoneCity('Asia/Tokyo', 'it');
  const tokyoRow = list.getByRole('radio', { name: new RegExp(`^${tokyo}`) });
  await expect(tokyoRow).toBeVisible();
  // The hour in Tokyo now, as this browser reads it: the panel did not get it from a render.
  const hour = await page.evaluate(() =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
  );
  await expect(tokyoRow).toContainText(hour);
  expect(requests).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`${PREFERENCES}$`));
  await expect(list).toHaveCount(0);
  await expect(zoneRow).toBeFocused();
  expect(requests).toEqual([]);
  await member.context.close();
});
```

A minute can change between the read of `hour` and the check. `toContainText` retries, and the panel renders the new minute, but `hour` stays old. If the test fails near a minute boundary, read `hour` again in a `expect.poll`. Do the simple version first.

The focus after Esc goes to the row only if the search field does not keep it. `TextField` is the first field of the panel. Check where the focus is after the click: if Esc first leaves the field (as on the settings panels of Admin), press Esc two times and write why.

On 2026-10-11 the code differs from the sketch in two points. The code in `apps/web/e2e/profile.spec.ts` is the reference.

- The test reads the hour of Tokyo again on each try, in an `expect.poll`. Thus a new minute during the check does not fail it.
- One Esc closes the panel, and the focus goes back to the row. The search field does not keep the Esc.

- [x] **Step 2: Run it.** Run: `E2E_PORT=3105 E2E_DB_PORT=54335 rtk proxy pnpm --filter web e2e profile`. Expected: PASS.

  On 2026-10-11: 10 passed (the setup, the 8 tests of before and the new test).

- [x] **Step 3: Make sure that it fails on the old code.** On `main` the click sends one RSC request (see «Measurements»). Thus `expect(requests).toEqual([])` fails there.

  On 2026-10-11 the measurement of `main` gave 1 RSC request for each of 7 clicks. Thus the test fails on `main` at the first `expect(requests).toEqual([])`.

- [x] **Step 4: Commit.**

```bash
git add apps/web/e2e/profile.spec.ts
git commit -m "test(web): the time zone list opens in place, with the browser's hours"
```

### Task 5: Measure, check by hand, and decide the warm-up

- [x] **Step 1: Build and start.** `cd apps/web && PUBLIC_URL=http://localhost:3101 pnpm exec next build`, then `PUBLIC_URL=http://localhost:3101 pnpm exec next start -p 3101`.

- [x] **Step 2: Run the temporary script** `apps/web/scripts/tmp-tz-measure.ts` (not committed): `pnpm exec tsx --env-file=.env scripts/tmp-tz-measure.ts http://localhost:3101 after`. It records the click time (CPU 4×, 1440px, median of 7), the RSC requests, the sizes, the text of the 418 rows, the console of a load of `?edit=timeZone`, and the screenshots.

- [x] **Step 3: Compare with main.** The text of the rows must be the same as `tz-text-main.json`, apart from the hours. The screenshots of the list and of `?edit=timeZone` must be the same, pixel for pixel, with the hours hidden (1440px and 500px, light and dark). The console must have no error.

- [x] **Step 4: Decide the warm-up.** If the first open is slow, try a warm-up: the page calls `zoneTimes(TIME_ZONES, new Date())` in `requestIdleCallback` after it mounts, which fills the formatter cache of `wallClock`. Measure again. Keep the warm-up only if the median is shorter by more than 20 ms. Write the numbers here.

  On 2026-10-11, without a warm-up, the click took 315 ms (346, 315, 309, 334, 344, 314, 292), with no RSC request. That is only 33 ms shorter than the navigation. A trace gave about 300 ms of script in the click and about 80 ms of style, layout and paint. A CPU profile put most of the script in `Intl`: 418 formatters, `formatToParts` for each zone, and the collator. The work kept a warm-up, with these parts:

  - `src/features/profile/zoneCache.ts` keeps the rows (`cachedTimeZoneRows`, one entry for a language and a saved zone) and the hours of one minute (`cachedZoneTimes`, zone by zone). A new minute starts an empty map. `zoneCache.test.ts` proves that the hours of a part and of a new minute are those of `zoneTimes`.
  - `TimeZoneWarmup` renders nothing. The page puts it in the list of Preferences. After the mount it makes the rows in one idle task, then the hours in idle tasks of 40 zones. Safari has no `requestIdleCallback`, so it gets a `setTimeout` of 50 ms.
  - `TimeZonePanel` reads the two caches. A zone that the warm-up did not reach gets its hour at the render.

  With the warm-up the click took 87 ms (83, 93, 85, 87, 88, 81, 93), with no RSC request. The warm-up is kept: it is 228 ms shorter.

- [x] **Step 5: Check by hand** with the script or a browser: a click shows the list in the next frame with no RSC request; ✕ and Esc close in place and the focus returns to the row; Back closes; a reload of `?edit=timeZone` opens with the list in the HTML; a choice saves, the row shows the new zone, and the panel stays open.

  On 2026-10-11 a temporary script on the build with the warm-up gave these results. ✕ closes with no RSC request, the URL is `/profile/preferences`, and the focus is on the row. Back closes with no RSC request. A choice of Tokyo saves: the URL keeps `?edit=timeZone`, the row shows «Tokyo», the panel stays open and Tokyo is checked. A load of `?edit=timeZone` shows 418 rows, and its HTML holds the list. The console has no error, also on a load of `?edit=timeZone` (no hydration mismatch). The text of the 418 rows, with the hours removed, is the same as on `main`, row for row. The 8 screenshots (the list and `?edit=timeZone`, 1440px and 500px, light and dark, hours hidden) are the same bytes as on `main`.

- [ ] **Step 6: Copy the numbers** into section 06 of the spec. Delete the temporary scripts.

### Task 6: Close the work

- [ ] **Step 1: Update the docs.**
  - `TODO.md`, «Web app: a UI pass»: delete only the sentence about the time zone list. Keep the sentence about the edit forms.
  - `docs/superpowers/specs/2026-10-11-web-navigation-feel.html` §05, row «Profilo › Preferences»: `edit:timeZone` is in place now. Name this spec.
- [ ] **Step 2: Run every gate and the whole web e2e suite.** `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck --force`, `rtk proxy pnpm --filter web test`, then `E2E_PORT=3105 E2E_DB_PORT=54335 rtk proxy pnpm --filter web e2e`. Expected on `main`: 73 passed and 1 skipped (`fixme`). After this plan: 74 passed and 1 skipped.
- [ ] **Step 3: Commit.**

```bash
git add TODO.md docs/superpowers
git commit -m "docs: the time zone list of Preferenze opens in place"
```

---

## Measurements

The «Before» column is commit `526e23a0` (main) on port 3101. The script runs on a copy of the development database (5 accounts, 124 transactions).

| Value (1440px, CPU 4×) | Before | After |
| --- | --- | --- |
| Click on «Time zone» to a visible row | 348 ms (348, 293, 399, 326, 374, 366, 325) | 87 ms (83, 93, 85, 87, 88, 81, 93) |
| The same, without the warm-up | — | 315 ms (346, 315, 309, 334, 344, 314, 292) |
| RSC requests for the click (no prefetch) | 1 | 0 |
| RSC response, `/profile/preferences` | 41.1 KB (9.0 KB gzip) | 42.9 KB (9.2 KB gzip) |
| RSC response, `?edit=timeZone`, also after each save | 79.0 KB (15.8 KB gzip) | 42.9 KB (9.2 KB gzip) |
| HTML, `?edit=timeZone` | 391.8 KB (28.8 KB gzip) | 349.1 KB (22.3 KB gzip) |
| 418 `Intl.DateTimeFormat`, first time, in the page | 70 ms | 72 ms |
| The client chunk with the zone tables, once, cached | — | 59.0 KB (16.3 KB gzip, 13.3 KB brotli) |

- «After» is the build of the branch with the warm-up, on port 3101, with the same database. Each click time is the median of 7 clicks, each in a new browser context, 1.5 s after the load.
- The RSC response of the list is 1.8 KB larger: the props of `TimeZonePanel`, its client reference and `TimeZoneWarmup`.
- The chunk holds the zone tables and the cities in seven languages. The browser loads it once for each deployment. Only the Preferences page imports it.
