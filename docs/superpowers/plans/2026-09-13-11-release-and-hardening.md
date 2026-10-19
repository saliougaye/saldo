# Phase 11 — Release docs & hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Somebody who has never seen this repository can clone it, follow only the docs, and end up with a signed
Android APK and an iOS build on their own phone, talking to their own server — and what they install has no
outstanding item from the §18 security checklist against it.

**Architecture:** Five independent bodies of work, in an order chosen so the cheap gates come first. (1) The repository
goes green: `pnpm lint` currently fails on 26 accessibility errors, so CI is red and every later "is it green?" is
unreadable. (2) The two §18 items that were never built — CSV formula-injection escaping and the app-switcher privacy
overlay — because they change code, and code changes want to land before docs describe the result. (3) The
accessibility pass over the app itself. (4) The measured performance answer to §19.4, which is a *decision* (in-memory
or SQL) that the docs then state. (5) Release plumbing and documentation: the signing config plugin, `build:android`,
the two build documents, the README, CONTRIBUTING, and the Maestro flows.

Nothing here changes the domain model or the sync protocol. `SYNC_SCHEMA_VERSION` does not move.

**Tech Stack:** Biome 2.5 (lint), Vitest (core/web), jest-expo + RNTL (mobile), Expo SDK 57 config plugins
(`expo/config-plugins`), Gradle, Maestro (YAML flows), `expo-screen-capture`.

**Spec:** §15 (build & sideload), §16 (testing strategy), §18 (security & privacy checklist), §19 (open questions 2 and 4).

---

## File structure

| File | Responsibility |
| --- | --- |
| `docs/brand/mascotte/generatori/*.html` | Modify: 9 inline `<svg>` gain a `<title>`, 17 `<img>` gain `alt`. Generator pages, not app code. |
| `packages/core/src/io/csv.ts` | Modify: `csvRows` escapes the user-controlled columns against formula injection. |
| `packages/core/src/io/csv.test.ts` | Modify: the escaping rule and its exception (`amount`). |
| `apps/mobile/src/features/lock/PrivacyOverlay.tsx` | Create: covers the UI while the app is not active, so the switcher snapshot shows nothing. |
| `apps/mobile/src/features/lock/PrivacyOverlay.test.tsx` | Create: it covers on `inactive`/`background` and only when the lock is on. |
| `apps/mobile/app/_layout.tsx` | Modify: mount `PrivacyOverlay` inside `Ready`. |
| `apps/mobile/src/components/*` | Modify: accessibility labels and hit areas on the icon-only controls. |
| `apps/mobile/scripts/measure-performance.ts` | Create: times the §5 aggregates over 20k rows and prints a table. |
| `apps/mobile/plugins/withReleaseSigning.js` | Create: writes `signingConfigs.release` into the generated Gradle project. |
| `apps/mobile/app.config.ts` | Modify: register the plugin. |
| `apps/mobile/package.json` | Modify: `build:android` and `measure:perf` scripts. |
| `apps/mobile/maestro/*.yaml` | Create: the two §16 flows. |
| `docs/building-android.md` | Create: prerequisites → keystore → prebuild → assembleRelease → install. |
| `docs/building-ios.md` | Create: prerequisites → prebuild → Xcode signing → the free-account limits. |
| `README.md` | Modify: features, screenshots, quick start. |
| `CONTRIBUTING.md` | Create: how to run the workspace, the conventions that are non-negotiable, how to propose a change. |

---

## Task 1: The repository goes green

`pnpm lint` fails with 26 errors, all in the icon generator pages under `docs/brand/mascotte/generatori/`. CI runs
`pnpm lint`, so **CI is red right now** and no later verification in this plan can be believed until this is fixed.
Two Biome rules: `a11y/noSvgWithoutTitle` (9 files with an inline `<svg>`) and `a11y/useAltText` (17 `<img>` across
three `verifica-*.html` pages).

These are real accessibility errors, not noise, and the fix is one attribute each — so they get fixed rather than
ignored. Do **not** add these paths to `biome.json`'s ignore list: the same rules are what Task 4 leans on.

**Files:**
- Modify: `docs/brand/mascotte/generatori/android-background.html`, `android-foreground.html`,
  `android-monochrome.html`, `favicon.html`, `ios-dark.html`, `ios-light.html`, `ios-tinted.html`,
  `splash-dark.html`, `splash-light.html` (one `<title>` each)
- Modify: `docs/brand/mascotte/generatori/verifica-icone.html`, `verifica-splash.html`, `verifica-varianti.html`
  (`alt` on every `<img>`)

- [ ] **Step 1: See the failure**

```bash
pnpm lint --max-diagnostics=40
```

Expected: `Found 26 errors.`, `lint/a11y/noSvgWithoutTitle` on nine files at `4:1`, `lint/a11y/useAltText` seventeen
times across the three `verifica-*` pages.

- [ ] **Step 2: Give every inline `<svg>` a title**

In each of the nine files the `<svg …>` opening tag is on line 4. Insert a `<title>` as its **first child**. The text
is what the file produces, in Italian like the rest of `docs/brand`:

| File | Title text |
| --- | --- |
| `android-background.html` | `Sfondo icona adattiva Android` |
| `android-foreground.html` | `Primo piano icona adattiva Android` |
| `android-monochrome.html` | `Icona monocroma Android` |
| `favicon.html` | `Favicon Saldo` |
| `ios-dark.html` | `Icona iOS scura` |
| `ios-light.html` | `Icona iOS chiara` |
| `ios-tinted.html` | `Icona iOS tinta` |
| `splash-dark.html` | `Splash scuro` |
| `splash-light.html` | `Splash chiaro` |

For example, `favicon.html` line 4 becomes:

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Favicon Saldo</title>  <circle cx="19" cy="24" r="8" fill="#171717"/>
```

- [ ] **Step 3: Give every `<img>` an `alt`**

`verifica-varianti.html` — the whole body, replaced (five images, each labelled with the variant it shows):

```html
<div style="text-align:center"><img src="../procione.svg" width="140" alt="Procione canonico"><p style="font-size:12px;color:#8C8C8C">canonico</p></div>
<div style="text-align:center;background:#121212;padding:14px;border-radius:16px"><img src="../procione-trasparente.svg" width="140" alt="Procione su fondo trasparente"><p style="font-size:12px;color:#8C8C8C">trasparente</p></div>
<div style="text-align:center;background:#121212;padding:14px;border-radius:16px"><img src="../procione-scuro.svg" width="140" alt="Variante scura del procione"><p style="font-size:12px;color:#8C8C8C">variante scuro</p></div>
<div style="text-align:center;background:#5FBF7F;padding:14px;border-radius:16px;color:#0A0A0A"><img src="../procione-monocromo.svg" width="140" alt="Procione monocromo"><p style="font-size:12px">monocromo</p></div>
<div style="text-align:center"><img src="../procione-scuro.svg" width="16" alt="Variante scura del procione a 16 px"><p style="font-size:12px;color:#8C8C8C">16</p></div>
```

`verifica-splash.html` — the three `<figure>` images:

```html
<figure><div class="phone" style="background:#E9E9E7"><img src="../../../../apps/mobile/assets/splash-icon.png" alt="Splash chiaro"></div><figcaption>splash light · #E9E9E7</figcaption></figure>
<figure><div class="phone" style="background:#050505"><img src="../../../../apps/mobile/assets/splash-icon-dark.png" alt="Splash scuro"></div><figcaption>splash dark · #050505</figcaption></figure>
<figure><div class="fav"><img src="../../../../apps/mobile/assets/favicon.png" alt="Favicon Saldo"><span>Saldo — finanze</span></div><figcaption>favicon a 16 px in una scheda</figcaption></figure>
```

`verifica-icone.html` — eight images on lines 15–21. Each one shows an icon at a size or on a background; give each an
`alt` naming what it shows, taken from the `<p>` caption that already sits under it (for example
`alt="Icona iOS chiara a 180 px"`). Read the file before editing: the captions are the source of the wording, and the
line numbers in the lint output are the checklist.

- [ ] **Step 4: Verify lint is clean**

```bash
pnpm lint
```

Expected: no `lint/…` line and **no** `× Some errors were emitted while running checks.` `Checked N files … No fixes
applied.` on its own is not a pass — read for the absence of errors, per AGENTS.md.

- [ ] **Step 5: Commit**

```bash
git add docs/brand/mascotte/generatori
git commit -m "fix(brand): the icon generators pass the accessibility rules they are checked by"
```

---

## Task 2: The CSV export cannot smuggle a formula

§18: *"The CSV export prefixes cells starting with `= + - @` with `'` (formula injection) **except** the numeric
`amount` column."* Nothing does this today — `field()` in `packages/core/src/io/csv.ts` only applies RFC 4180 quoting.

The attack is concrete and it is not hypothetical for a finance app: a transaction described
`=cmd|'/c calc'!A1`, or a tag named `@SUM(A1:A9)`, becomes a live formula when the export is opened in Excel or
LibreOffice. The prefix `'` makes the spreadsheet treat the cell as text; a re-import is unaffected because
`csvParse` reads the cell as text either way, and Task 2 keeps the round-trip test that proves it.

**Which columns.** Only the ones a user can type into: `account`, `to_account`, `category`, `parent_category`,
`description`, `note`, `tags`. `date`, `type`, `currency`, `excluded`, `recurring` and `id` are generated by this
codebase and `amount` is excluded by the spec, because a leading `-` there is a minus sign and quoting it would break
every spreadsheet that reads the column as a number.

**Files:**
- Modify: `packages/core/src/io/csv.ts`
- Test: `packages/core/src/io/csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/io/csv.test.ts` (inside the existing top-level `describe` for `csvRows`, or as a new
`describe` at the end of the file):

```ts
describe('formula injection', () => {
  const context = {
    currency: 'EUR' as const,
    accounts: [{ ...account, id: 'acc-1', name: '=HYPERLINK("http://evil","click")' }],
    categories: [],
    tags: [{ id: 'tag-1', name: '@SUM(A1:A9)' }],
  };

  it("prefixes a cell that starts with =, +, - or @ with an apostrophe", () => {
    const rows = csvRows(
      [{ ...transaction, accountId: 'acc-1', description: '+1 caffè', tagIds: ['tag-1'] }],
      context,
    );
    const row = rows[1] ?? [];
    expect(row[4]).toBe('\'=HYPERLINK("http://evil","click")');
    expect(row[8]).toBe("'+1 caffè");
    expect(row[10]).toBe("'@SUM(A1:A9)");
  });

  it('leaves a negative amount alone, because there it is a minus sign', () => {
    const rows = csvRows([{ ...transaction, amount: 1250 }], context);
    expect(rows[1]?.[2]).toBe('12.50');
  });

  it('leaves an ordinary cell untouched', () => {
    const rows = csvRows([{ ...transaction, description: 'Caffè' }], context);
    expect(rows[1]?.[8]).toBe('Caffè');
  });
});
```

`account` and `transaction` are the fixtures the file already builds for its other tests — reuse them rather than
inventing new ones; if they are named differently in the file, use the existing names.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
pnpm --filter @saldo/core test -- --run src/io/csv.test.ts
```

Expected: FAIL — the first test reports `'=HYPERLINK…'` received without the leading apostrophe.

- [ ] **Step 3: Implement the guard**

In `packages/core/src/io/csv.ts`, above `csvRows`:

```ts
/**
 * §18. A spreadsheet reads a cell starting with `=`, `+`, `-` or `@` as a formula, and a
 * description or a tag is somebody else's text — a shared export is enough for that to matter. The
 * apostrophe makes the cell text again; `csvParse` never sees it, because it strips it back off on
 * import (see `csvParse.test.ts`).
 *
 * Not applied to `amount`: there a leading `-` is a minus sign, and quoting it would stop every
 * spreadsheet reading the column as a number. Every other column this touches is user-typed.
 */
function textCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
```

Then wrap the seven user-controlled cells in `csvRows`:

```ts
    rows.push([
      tx.date,
      tx.kind,
      formatMinorUnits(tx.amount, minorDigits),
      context.currency,
      textCell(accountName.get(tx.accountId) ?? ''),
      textCell(tx.toAccountId === null ? '' : (accountName.get(tx.toAccountId) ?? '')),
      textCell(own?.name ?? ''),
      textCell(parent?.name ?? ''),
      textCell(tx.description),
      textCell(tx.note ?? ''),
      textCell(
        tx.tagIds
          .map((id) => tagName.get(id) ?? '')
          .filter((name) => name !== '')
          .join('|'),
      ),
      String(tx.excludeFromTotals),
      String(tx.recurrenceId !== null),
      tx.id,
    ]);
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
pnpm --filter @saldo/core test -- --run src/io
```

Expected: PASS, including the existing export → import round-trip test. If the round-trip now fails, the apostrophe is
reaching the parser: add the strip to `csvParse` in the same commit (a leading `'` on a text cell is removed) and a
test for it, because export and import are one feature.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/io
git commit -m "fix(core): a description cannot become a spreadsheet formula"
```

---

## Task 3: Nothing readable in the app switcher

§18: *"App lock hides content in the app switcher (`expo-screen-capture` / privacy overlay on `AppState` inactive)."*
`useAppLock` re-locks when the app comes **back** after a minute (§6.32), which is a different thing: between the
moment you swipe up and the moment the lock screen appears, the operating system has already photographed the balances
on screen and put that photograph in the switcher.

**Overlay, not `expo-screen-capture`.** `preventScreenCaptureAsync` sets `FLAG_SECURE` on Android, which also blocks
the user's own screenshots — for a finance app you *do* want to screenshot a receipt out of. The overlay costs one
component, works the same on both platforms, and covers the case the checklist names. iOS snapshots on `inactive`
(which also fires for the notification shade and an incoming call — covering there is correct, not over-eager);
Android snapshots on `background`.

**Only when the lock is on.** The overlay follows `kv.appLockEnabled`, the same flag `useAppLock` reads: somebody who
did not turn the lock on did not ask for their screen to be hidden, and an app that flashes grey every time the shade
comes down is worse than one that does not.

**Files:**
- Create: `apps/mobile/src/features/lock/PrivacyOverlay.tsx`
- Create: `apps/mobile/src/features/lock/PrivacyOverlay.test.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/lock/PrivacyOverlay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { act } from 'react';
import { AppState } from 'react-native';
import { DatabaseContextForTests } from '../../db/DatabaseProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PrivacyOverlay } from './PrivacyOverlay';

function renderWith(lockEnabled: boolean) {
  const kv = { get: (key: string) => (key === 'appLockEnabled' && lockEnabled ? 'true' : null) };
  return render(
    <DatabaseContextForTests kv={kv}>
      <ThemeProvider preference="light">
        <PrivacyOverlay />
      </ThemeProvider>
    </DatabaseContextForTests>,
  );
}

function goTo(status: 'active' | 'inactive' | 'background') {
  act(() => {
    // `AppState.addEventListener` is mocked by jest-expo; emit through the same channel the
    // component subscribes to.
    AppState.emit?.('change', status);
  });
}

describe('PrivacyOverlay', () => {
  it('covers the screen when the app goes inactive with the lock on', () => {
    renderWith(true);
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
    goTo('inactive');
    expect(screen.getByTestId('privacy-overlay')).toBeTruthy();
  });

  it('uncovers it when the app comes back', () => {
    renderWith(true);
    goTo('background');
    expect(screen.getByTestId('privacy-overlay')).toBeTruthy();
    goTo('active');
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
  });

  it('stays out of the way when the lock is off', () => {
    renderWith(false);
    goTo('inactive');
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
  });
});
```

**Read `apps/mobile/src/features/lock/relock.test.ts` and `apps/mobile/src/db/DatabaseProvider.tsx` first.** The
harness above assumes a test-only context export and an `AppState.emit`. If `DatabaseProvider` exposes no such export,
add one next to the existing context (`export const DatabaseContextForTests = DatabaseContext.Provider` is enough) and
say so in the commit; if `AppState.emit` is not available under jest-expo, drive the listener by capturing it with
`jest.spyOn(AppState, 'addEventListener')` — whichever the repository's other AppState test
(`MaterialiserGate`) already does, do that, because two ways of faking the same thing is one too many.

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter mobile test -- PrivacyOverlay
```

Expected: FAIL — `Cannot find module './PrivacyOverlay'`.

- [ ] **Step 3: Write the component**

Create `apps/mobile/src/features/lock/PrivacyOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, View } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * §18. The operating system photographs the screen on its way out and shows that photograph in the
 * app switcher — before `useAppLock` gets a chance to send anybody to the lock screen. This covers
 * the UI while the app is not active, so the photograph is of the cover.
 *
 * Only when the app lock is on: hiding the screen is what that setting asks for, and flashing a
 * blank panel over somebody who never asked is noise. iOS goes `inactive` for the notification
 * shade and an incoming call as well as for the switcher — covering there too is deliberate.
 */
export function PrivacyOverlay() {
  const { kv } = useDatabase();
  const theme = useTheme();
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const onChange = (status: AppStateStatus): void => {
      if (kv.get('appLockEnabled') !== 'true') {
        setCovered(false);
        return;
      }
      setCovered(status !== 'active');
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [kv]);

  if (!covered) return null;
  return (
    <View
      testID="privacy-overlay"
      // Not focusable and not described: it is a cover, and a screen reader announcing it while
      // the app is in the background would be the only thing that made it noticeable.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.palette.page,
      }}
    />
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
pnpm --filter mobile test -- PrivacyOverlay
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Mount it**

In `apps/mobile/app/_layout.tsx`, import the component and put it **after** the `<Stack>` inside `Ready`, so it draws
over everything:

```tsx
                <Ready>
                  <Stack screenOptions={{ headerShown: false }}>
```

becomes, at the closing end of that block:

```tsx
                  </Stack>
                  <PrivacyOverlay />
                </Ready>
```

with `import { PrivacyOverlay } from '../src/features/lock/PrivacyOverlay';` alongside the other feature imports.
`Ready` currently returns `<>{children}</>` and takes a single child — passing two children still satisfies
`ReactNode`, so no signature changes.

- [ ] **Step 6: Verify on a device, because a switcher snapshot cannot be unit-tested**

```bash
pnpm --filter mobile ios
```

Turn the app lock on in Impostazioni, go Home, and swipe up to the switcher: the Saldo card must be a flat panel in
the theme's page colour, not a screenshot of the balances. Repeat with the lock off: the card shows the app.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/lock apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): the app switcher shows a cover, not the balances"
```

---

## Task 4: The accessibility pass

The roadmap asks for "labels, hit areas, reduce motion". **Reduce Motion is already done** — `src/theme/motion.ts`
honours it by construction (`ReduceMotion.System` plus `useMotion().reduced`), and §A of `2026-09-11-ui-scoping.md`
records why. What is left is the two that were never swept: every control that is *only* an icon needs a name, and
every tappable thing needs to be big enough to hit.

There are 63 `accessibilityLabel`s in the app already, so this is a sweep for the gaps, not a rewrite.

**The rule for hit areas:** 44×44pt is the floor (iOS HIG; Android asks 48dp, and 44 with `hitSlop` reaching 48 is
what the components already do where they do it). A control smaller than that gets `hitSlop`, not a bigger icon — the
design's spacing is not up for renegotiation here.

**Files:**
- Modify: whichever components the audit in step 1 names, under `apps/mobile/src/components/` and
  `apps/mobile/src/features/`
- Test: `apps/mobile/src/components/a11y.test.tsx` (create)

- [ ] **Step 1: Produce the audit list**

```bash
grep -rn "<Pressable" apps/mobile/src apps/mobile/app | wc -l
grep -rln "<Pressable" apps/mobile/src apps/mobile/app
```

For every file in that list, open it and check each `Pressable`/`TouchableOpacity` against three questions, writing
the answers into a scratch list (file:line → verdict):

1. Does the control contain **any** `Text`? If not, it is icon-only and needs `accessibilityLabel` (an i18n key, never
   a literal — AGENTS.md).
2. Does it declare `accessibilityRole`? Buttons need `"button"`, rows that open a screen `"button"`, toggles
   `"switch"` with `accessibilityState={{ checked }}`.
3. Is its touch target at least 44×44? If the icon is 20–24px in a row with no padding, add
   `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}`.

Known suspects from the icon-only inventory: the back button in `ScreenHeader`, the FAB, the period chip on Home, the
close buttons on every `Sheet`, the attachment tiles, the calendar's month arrows, and the amount keypad's delete key.

- [ ] **Step 2: Write the failing test for the shared primitives**

Create `apps/mobile/src/components/a11y.test.tsx`. It pins the primitives everything else is built from, so a new
screen inherits the labels rather than re-deciding them:

```tsx
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { BackButton } from './ScreenHeader';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider preference="light">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('accessibility of the shared controls', () => {
  it('names the back button and gives it a button role', () => {
    render(
      <Host>
        <BackButton />
      </Host>,
    );
    const button = screen.getByRole('button');
    expect(button.props.accessibilityLabel).toBeTruthy();
  });

  it('gives the back button a 44pt touch target', () => {
    render(
      <Host>
        <BackButton />
      </Host>,
    );
    const { hitSlop } = screen.getByRole('button').props;
    expect(hitSlop).toBeDefined();
  });
});
```

Extend this file with one `describe` per primitive the audit found wanting — the FAB, the sheet close button, the
keypad delete key — following the same two assertions. Do not test every screen: the primitives are where the fix
belongs, and a per-screen test would pin the composition rather than the rule.

- [ ] **Step 3: Run it and watch the gaps fail**

```bash
pnpm --filter mobile test -- a11y
```

Expected: FAIL on whichever primitive has no label or no `hitSlop`. If everything passes on the first run, the audit
in step 1 was not thorough enough — icon-only controls without labels exist; find them before moving on.

- [ ] **Step 4: Fix the primitives**

For each failure, add the label through i18n. New keys go in **both** `packages/i18n/src/locales/it.ts` and `en.ts`
under an `a11y` group, for example:

```ts
  a11y: {
    back: 'Indietro',
    close: 'Chiudi',
    addTransaction: 'Aggiungi transazione',
    deleteDigit: 'Cancella una cifra',
    previousMonth: 'Mese precedente',
    nextMonth: 'Mese successivo',
  },
```

and in `en.ts`:

```ts
  a11y: {
    back: 'Back',
    close: 'Close',
    addTransaction: 'Add transaction',
    deleteDigit: 'Delete a digit',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
  },
```

The catalog parity test enforces that both files carry the same keys — run it before assuming you are done.

- [ ] **Step 5: Run the whole mobile suite**

```bash
pnpm --filter mobile test
pnpm --filter @saldo/i18n test
```

Expected: all green, including the it/en parity test.

- [ ] **Step 6: Verify with a screen reader on a device**

```bash
pnpm --filter mobile ios
```

Turn VoiceOver on (Settings → Accessibility → VoiceOver, or triple-click the side button). Swipe through Home: every
control announces something that says what it does — no "button" on its own, no icon name read as a file name. Then
Settings → Accessibility → Display & Text Size → Larger Text at its largest: no label is cut mid-word and no card
loses its number.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile packages/i18n
git commit -m "feat(mobile): every icon-only control says what it is"
```

---

## Task 5: The 20k-transaction answer

§19 open question 4: *"Maximum supported transactions for in-memory calculations. If it becomes slow above 20k rows,
push aggregation into SQL."* This task **answers** it with a number rather than an opinion, and the answer is what the
README and the docs then state.

The screens that could hurt all share one shape: read every transaction in a range, then fold it in `@saldo/core`.
Home's chart, Statistics, budgets and the account series all do this. The measurement therefore belongs in core, over
generated rows, with no React and no SQLite in the way — that isolates the question being asked (is the *arithmetic*
too slow?) from the one that is not (is `expo-sqlite` too slow?), and only the first one has "push it into SQL" as its
answer.

**No timing assertion in CI.** A wall-clock threshold in the test suite is a flake generator on a shared runner. The
script prints a table; the number goes in the plan and in `docs/self-hosting.md`'s performance note. If a later change
regresses it, this script is how you find out.

**Files:**
- Create: `apps/mobile/scripts/measure-performance.ts`
- Modify: `apps/mobile/package.json` (a `measure:perf` script)

- [x] **Step 1: Write the harness**

Create `apps/mobile/scripts/measure-performance.ts`:

```ts
/**
 * §19.4: how many transactions the in-memory aggregates can carry before a screen feels slow.
 *
 * Run with: pnpm --filter mobile measure:perf [rows]
 *
 * Pure `@saldo/core` over generated rows — no SQLite, no React. That is the point: if the numbers
 * here are fine and the app still stutters, the cost is in the query or the render, and pushing
 * aggregation into SQL would be the wrong fix.
 */
import {
  type Account,
  accountBalances,
  addDays,
  type Category,
  categoryTotals,
  periodTotals,
  type Transaction,
} from '@saldo/core';

const rows = Number.parseInt(process.argv[2] ?? '20000', 10);
const today = '2026-09-13';
const start = addDays(today, -730);

const accounts: Account[] = Array.from({ length: 4 }, (_, index) => ({
  id: `acc-${index}`,
  name: `Account ${index}`,
  type: 'checking',
  openingBalance: 100000,
  currency: 'EUR',
  icon: 'landmark',
  sortOrder: index,
  archivedAt: null,
  deletedAt: null,
}));

const categories: Category[] = Array.from({ length: 40 }, (_, index) => ({
  id: `cat-${index}`,
  name: `Category ${index}`,
  direction: index % 5 === 0 ? 'income' : 'expense',
  parentId: null,
  icon: 'tag',
  colour: null,
  sortOrder: index,
  archivedAt: null,
  deletedAt: null,
}));

const transactions: Transaction[] = Array.from({ length: rows }, (_, index) => ({
  id: `tx-${index}`,
  kind: index % 5 === 0 ? 'income' : 'expense',
  amount: 100 + (index % 9000),
  date: addDays(start, index % 730),
  accountId: `acc-${index % 4}`,
  toAccountId: null,
  categoryId: `cat-${index % 40}`,
  description: `Transaction ${index}`,
  note: null,
  tagIds: [],
  excludeFromTotals: false,
  recurrenceId: null,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
}));

function time(label: string, fn: () => unknown): void {
  // Once to warm the JIT, then five runs: the median is what a screen actually waits for.
  fn();
  const runs = Array.from({ length: 5 }, () => {
    const startedAt = performance.now();
    fn();
    return performance.now() - startedAt;
  }).sort((a, b) => a - b);
  console.log(`${label.padEnd(28)} ${(runs[2] ?? 0).toFixed(1)}ms`);
}

console.log(`${rows} transactions, ${accounts.length} accounts, ${categories.length} categories\n`);
time('accountBalances', () => accountBalances(accounts, transactions, today));
time('periodTotals', () => periodTotals(transactions, { start, end: today }));
time('categoryTotals', () => categoryTotals(transactions, categories, { start, end: today }));
```

**The imports are the part to check, not to trust.** Open `packages/core/src/index.ts` and use the names it actually
exports for "balances per account", "income and expense over a range" and "spend per category"; the entity literals
above must match the Zod schemas in `packages/core/src/entities.ts` field for field (TypeScript will say so). Fix the
script to the codebase, not the codebase to the script.

- [x] **Step 2: Add the script**

In `apps/mobile/package.json`, next to `seed:db`:

```json
    "measure:perf": "esbuild scripts/measure-performance.ts --bundle --platform=node --format=cjs --outfile=.measure-perf.cjs --log-level=error && node .measure-perf.cjs"
```

and add `.measure-perf.cjs` to `apps/mobile/.gitignore`, next to the existing `.seed-db.cjs` entry.

- [x] **Step 3: Run it at three sizes**

```bash
pnpm --filter mobile measure:perf 5000
pnpm --filter mobile measure:perf 20000
pnpm --filter mobile measure:perf 50000
```

Expected: three tables of three numbers. **Write them into this plan** under a "Result" heading — the point of the
task is the record, not the run.

- [x] **Step 4: Take the decision and write it down**

The threshold that matters is one frame's worth of budget on a mid-range phone, and a screen that folds three of these
per render has about **100ms** before it is noticeable. Judge against the 20k column:

- **Under 100ms total** → the answer to §19.4 is "20k is fine in memory"; record it and change no code.
- **Over 100ms** → do not push aggregation into SQL in this phase. Record which function dominates, open it as a
  follow-up in `docs/superpowers/plans/README.md`, and state the measured ceiling in the docs. Rewriting the
  aggregates as SQL is a phase of its own, and the POC ships either way.

Append the numbers and the verdict to `docs/self-hosting.md` under a short "Limits" heading, because it is the person
running a server for a household who needs to know.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/scripts apps/mobile/package.json apps/mobile/.gitignore docs/self-hosting.md docs/superpowers/plans/2026-09-13-11-release-and-hardening.md
git commit -m "chore(mobile): measure what the in-memory aggregates cost at 20k rows"
```


### Result

Run on 2026-09-13, Node v22.13.1 on darwin/arm64, via
`pnpm --filter mobile measure:perf <rows>`. Medians of five runs after one warm-up.

The harness measures nine folds, not three: the three the task named plus the Home/Statistics
chart series (`dailyCumulative`), the account sparkline (`monthEndBalances`), the §5.5 baselines
(`periodHistory`, `categorySpendHistory`), the §5.10 tag ranking (`spendingByTag`) and budget
progress — the point was to cover what a screen actually waits for. The last line runs everything
`app/(tabs)/stats.tsx` folds per render, which is the heaviest screen in the app. The import list
sketched in Step 1 above was wrong in every name (`periodTotals`, `categoryTotals`,
`Category.colour`, numeric `createdAt`); the script follows `packages/core/src/index.ts` and
`entities.ts` instead, as Step 1 said it should.

```
5000 transactions over 730 days, 5 accounts, 40 categories, 8 budgets
period: 2026-09-01..2026-09-30 (30 days), today 2026-09-13, node v22.13.1 on darwin/arm64

accountBalances            Accounts tab, account detail    0.3ms
summarizePeriod            Home header, Statistics         0.1ms
spendingByCategory         Statistics, budgets             0.2ms
spendingByTag              Statistics tag ranking (§5.10)  0.2ms
dailyCumulative            Home/Statistics chart series    0.2ms
monthEndBalances x8        Account sparkline               1.1ms
periodHistory x6           Statistics baselines (§5.5)     0.4ms
categorySpendHistory       Statistics baselines (§5.5)     0.1ms
budgetProgress x8          Budgets tab                     0.0ms
— Statistics screen total  every fold above that it runs   1.1ms
```

```
20000 transactions over 730 days, 5 accounts, 40 categories, 8 budgets
period: 2026-09-01..2026-09-30 (30 days), today 2026-09-13, node v22.13.1 on darwin/arm64

accountBalances            Accounts tab, account detail    1.9ms
summarizePeriod            Home header, Statistics         0.6ms
spendingByCategory         Statistics, budgets             0.4ms
spendingByTag              Statistics tag ranking (§5.10)  1.0ms
dailyCumulative            Home/Statistics chart series    0.7ms
monthEndBalances x8        Account sparkline               5.2ms
periodHistory x6           Statistics baselines (§5.5)     2.8ms
categorySpendHistory       Statistics baselines (§5.5)     0.3ms
budgetProgress x8          Budgets tab                     0.0ms
— Statistics screen total  every fold above that it runs   4.7ms
```

```
50000 transactions over 730 days, 5 accounts, 40 categories, 8 budgets
period: 2026-09-01..2026-09-30 (30 days), today 2026-09-13, node v22.13.1 on darwin/arm64

accountBalances            Accounts tab, account detail    9.3ms
summarizePeriod            Home header, Statistics         2.2ms
spendingByCategory         Statistics, budgets             2.5ms
spendingByTag              Statistics tag ranking (§5.10)  2.6ms
dailyCumulative            Home/Statistics chart series    2.8ms
monthEndBalances x8        Account sparkline               43.4ms
periodHistory x6           Statistics baselines (§5.5)     19.8ms
categorySpendHistory       Statistics baselines (§5.5)     1.1ms
budgetProgress x8          Budgets tab                     0.0ms
— Statistics screen total  every fold above that it runs   49.4ms
```

**Verdict on §19.4: 20k rows is fine in memory. No code changed, and no SQL follow-up is opened.**

The 20k column comes to **4.7ms** for the whole Statistics screen and **7.1ms** for the account
detail (`accountBalances` + `monthEndBalances`) — an order of magnitude under the 100ms the task
set as the threshold. The ceiling is not 20k either: the heaviest screen at 50k was 49.4ms, still
under it.

**What dominates:** `monthEndBalances`, by a wide margin — 5.2ms of the 20k column and 43.4ms of
the 50k one. It walks the whole ledger once per sparkline point, so it is O(rows × months) where
everything else is O(rows); at 8 points that is eight full passes. `periodHistory` is second, at
six `filter` passes plus the arrays they allocate. Both are obvious to fix (one pass, bucketing by
month; one pass, bucketing by period) — **and neither was touched**, because they are nowhere near
slow enough to justify changing working code. Noted here so that whoever does hit a limit knows
where to look first.

**A note on the 50k column's stability.** Two runs of the same fixture gave `monthEndBalances`
24.5ms and 43.4ms — the higher figure is recorded above, deliberately. At that size the fixture is
tens of megabytes of objects and the variance is GC, not arithmetic, which is itself part of the
answer: the first thing to go wrong past ~50k rows is memory pressure, not the sums. The 5k and
20k columns were stable across runs.

**And on the composite line.** At 20k it reads 4.7ms while its parts add up to about 5.8ms. It is
timed last, so every function it calls is already hot and inlined by then. Read it as the optimistic
end of what that screen costs, and the individual rows as the pessimistic end; the verdict does not
turn on the difference.

**The caveat that belongs with the number.** This is Node's JIT on a development Mac, with no
SQLite and no rendering in the way. The app runs the same functions under Hermes on a phone, which
is slower, while also drawing a screen. Treat the table as a floor — "it cannot be faster than
this" — not as a device prediction; quoting a device figure needs a device measurement, which this
phase did not do. What the table does settle is that the *arithmetic* is not the risk: if a screen
stutters, the cost is in the query or the render, and rewriting these folds as SQL would be the
wrong fix confidently applied.

---

## Task 6: A release build that is signed, in one command

§15 step 4: *"A config plugin in `apps/mobile/plugins/withReleaseSigning.js` wires `signingConfigs.release` so it
survives `prebuild --clean`."* Neither the plugin nor the `build:android` script exists.

**Why a plugin at all.** `apps/mobile/android/` is generated and git-ignored (Continuous Native Generation), so any
edit made to `build.gradle` by hand is deleted by the next `expo prebuild --clean`. The plugin is the only place a
signing config can live and still be there tomorrow.

**Why Gradle properties rather than a file in the repository.** The keystore and its passwords go in
`~/.gradle/gradle.properties`, outside the checkout, and the plugin reads them with `hasProperty` so a machine without
them still builds a debug APK. `.gitignore` already refuses `*.keystore`, `*.jks`, `*.p12`.

**Files:**
- Create: `apps/mobile/plugins/withReleaseSigning.js`
- Modify: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Write the plugin**

Create `apps/mobile/plugins/withReleaseSigning.js`:

```js
/**
 * §15. `android/` is generated, so a signing config edited into `build.gradle` by hand is gone
 * after the next `expo prebuild --clean`. This writes it on every prebuild instead.
 *
 * The credentials come from `~/.gradle/gradle.properties` — outside the checkout, so nothing
 * signable is ever committed:
 *
 *   SALDO_UPLOAD_STORE_FILE=/Users/you/keys/saldo-release.keystore
 *   SALDO_UPLOAD_KEY_ALIAS=saldo
 *   SALDO_UPLOAD_STORE_PASSWORD=…
 *   SALDO_UPLOAD_KEY_PASSWORD=…
 *
 * A machine without them still builds: the `if` below leaves `release` signed with the debug key,
 * which is what `assembleDebug` wants and what CI (which never signs) would hit.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_CONFIG = `
        release {
            if (project.hasProperty('SALDO_UPLOAD_STORE_FILE')) {
                storeFile file(SALDO_UPLOAD_STORE_FILE)
                storePassword SALDO_UPLOAD_STORE_PASSWORD
                keyAlias SALDO_UPLOAD_KEY_ALIAS
                keyPassword SALDO_UPLOAD_KEY_PASSWORD
            }
        }`;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    if (contents.includes('SALDO_UPLOAD_STORE_FILE')) return gradleConfig;

    // 1. Add the `release` signing config next to the `debug` one Expo generates.
    contents = contents.replace(
      /signingConfigs \{/,
      `signingConfigs {${SIGNING_CONFIG}`,
    );

    // 2. Point the release build type at it. Expo's template signs release with `debug`, which is
    //    what produces an APK that installs but cannot be updated by a differently signed build.
    contents = contents.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?signingConfig signingConfigs\.)debug/,
      '$1release',
    );

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

module.exports = withReleaseSigning;
```

- [ ] **Step 2: Register it**

In `apps/mobile/app.config.ts`, add the plugin at the end of the `plugins` array (after the `expo-image-picker`
entry):

```ts
    './plugins/withReleaseSigning',
```

- [ ] **Step 3: Add the convenience script**

In `apps/mobile/package.json`:

```json
    "build:android": "expo prebuild --platform android --clean && cd android && ./gradlew assembleRelease"
```

- [ ] **Step 4: Prove the plugin writes what it says**

```bash
cd <repo>/apps/mobile && SALDO_SERVER_URL=saldo.example.com pnpm exec expo prebuild --platform android --clean
grep -n "SALDO_UPLOAD_STORE_FILE" apps/mobile/android/app/build.gradle
grep -n "signingConfig signingConfigs.release" apps/mobile/android/app/build.gradle
```

Expected: both greps match. If the second does not, the `buildTypes` regex missed — print the surrounding block with
`sed -n '/buildTypes/,/^    }/p' apps/mobile/android/app/build.gradle` and adjust the pattern to what Expo SDK 57
actually generates. **Do not commit `apps/mobile/android/`**; it is git-ignored and must stay that way.

- [ ] **Step 5: Build a signed APK end to end**

Generate a keystore and put the four properties in `~/.gradle/gradle.properties` (the exact commands are what Task 7
writes into `docs/building-android.md` — write them there first if that is easier, then follow your own document,
which is also how you find out whether it works).

```bash
pnpm --filter mobile build:android
```

Expected: `BUILD SUCCESSFUL` and an APK at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
Confirm it is signed with the release key, not the debug one:

```bash
keytool -printcert -jarfile apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Expected: the owner line is the one from your keystore, not `CN=Android Debug`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/plugins apps/mobile/app.config.ts apps/mobile/package.json
git commit -m "feat(mobile): a release build signs itself, and survives prebuild --clean"
```

---

## Task 7: The two build documents

The acceptance criterion for this phase is *"a person following only the docs on a clean machine produces an installed
APK and an iOS build connected to a self-hosted server."* §15 already contains the steps; these documents are that
content written for somebody who has never seen the repository, with the failure modes named.

**Files:**
- Create: `docs/building-android.md`
- Create: `docs/building-ios.md`
- Modify: `docs/self-hosting.md` (a link to both, near the top)

- [ ] **Step 1: Write `docs/building-android.md`**

Sections, in this order, with the exact commands:

1. **What you get** — a sideloadable APK signed with your own key, pointed at your own server.
2. **Before you start** — JDK 17, Android SDK with platform tools, `ANDROID_HOME` exported, Node from `.nvmrc`,
   pnpm. One command per check (`java -version`, `adb --version`, `node --version`).
3. **The server address is a build input** — `SALDO_SERVER_URL` is required and baked in; §15's table of the four
   variables, with the note that a fork must change `SALDO_BUNDLE_ID`.
4. **Make a keystore** —
   `keytool -genkeypair -v -storetype PKCS12 -keystore saldo-release.keystore -alias saldo -keyalg RSA -keysize 2048 -validity 10000`,
   with a sentence saying to keep it: an APK signed with a different key cannot update one already installed.
5. **Tell Gradle about it** — the four `SALDO_UPLOAD_*` properties in `~/.gradle/gradle.properties`, and why they live
   there and not in the checkout.
6. **Build** — `pnpm install`, then
   `SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile build:android`, and where the APK lands.
7. **Install** — `adb install -r …`, or copy to the phone and allow "install unknown apps".
8. **When it goes wrong** — at minimum: `SDK location not found` (export `ANDROID_HOME`), a build that succeeds but
   the app says the server is not configured (the variable was not exported for the *prebuild*), and
   `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (a previous install signed with another key — uninstall first).

- [ ] **Step 2: Write `docs/building-ios.md`**

Same shape:

1. **What you get**, and the honest limit up front: with a free Apple ID the app stops working after 7 days and you
   can have 3 sideloaded apps at once. A paid account gives a year.
2. **Before you start** — macOS, current Xcode, CocoaPods, an Apple ID signed into Xcode.
3. **Prebuild** —
   `SALDO_BUNDLE_ID=com.<you>.saldo SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile exec expo prebuild --platform ios --clean`,
   and why the bundle id must be yours.
4. **Sign** — open `apps/mobile/ios/Saldo.xcworkspace`, Signing & Capabilities → Team → your Personal Team.
5. **Run on the device in Release** — Product → Scheme → Edit Scheme → Run → Build Configuration → Release, then
   select the device and run. Developer Mode must be on (Settings → Privacy & Security).
6. **Keeping it alive** — re-run from Xcode every 7 days, or AltStore/SideStore to refresh automatically.
7. **When it goes wrong** — a bundle id already taken by somebody else's app id, "Untrusted Developer" (Settings →
   General → VPN & Device Management), and a build that reaches the sign-in screen and says the server is not
   configured.

- [ ] **Step 3: Link them**

Add near the top of `docs/self-hosting.md`, after its first paragraph:

```markdown
Once the server is up, build the app for your phone: [Android](building-android.md) · [iOS](building-ios.md).
```

- [ ] **Step 4: Follow your own Android document on a clean shell**

```bash
env -i HOME="$HOME" PATH="$PATH" bash -lc 'cd <repo> && pnpm --filter mobile build:android'
```

The point is to catch a step that only works because your shell already has something exported. Anything that fails
here is a missing line in the document, not a thing to fix by hand and move on from.

- [ ] **Step 5: Commit**

```bash
git add docs/building-android.md docs/building-ios.md docs/self-hosting.md
git commit -m "docs: how to build and sideload Saldo on Android and iOS"
```

---

## Task 8: The README somebody actually lands on

Today's README describes the repository layout and how to develop in it. What it does not have is what §11 of the
roadmap asks for: **features, screenshots, quick start**. Somebody arriving from a link decides in fifteen seconds
whether this is worth their evening, and a table of package paths does not help them decide.

**Screenshots.** `.screenshots/` is git-ignored working scratch — those files must not be what the README links to.
Take fresh ones on a seeded simulator and commit them under `docs/screenshots/`.

**Files:**
- Modify: `README.md`
- Create: `docs/screenshots/*.png` (4 images)
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Seed a simulator and take four screenshots**

```bash
xcrun simctl get_app_container booted io.github.saldo.app data
```

Seed that container's `Documents/SQLite/saldo.db` with the demo data (`pnpm --filter mobile seed:db <path> --reset`),
restart Metro with `--clear`, then capture Home, the transactions list, Statistics and a budget — light theme, no
personal data, the status bar clean. Save them as `docs/screenshots/home.png`, `transactions.png`, `statistics.png`,
`budgets.png`.

- [ ] **Step 2: Rewrite the top of the README**

Above the existing `## Repository` section, put:

1. The one-paragraph pitch that is already there (keep it — it is good).
2. **Screenshots** — the four images in a row, as a markdown table so they render side by side.
3. **What it does** — a bulleted list of the features that are actually built, each one line: periods you choose
   (month, week, pay cycle, year), transactions with categories, tags and attachments, budgets with rollover,
   statistics, recurring transactions, multi-account with transfers, CSV and JSON export, CSV import including a
   Spendee preset, passkey sign-in to your own server, sync across devices, app lock, Italian and English, light and
   dark.
4. **Quick start** — three numbered lines: run the server ([self-hosting](docs/self-hosting.md)), build the app
   ([Android](docs/building-android.md) · [iOS](docs/building-ios.md)), sign in with a passkey.
5. **What it is not** — no cloud service, no accounts on somebody else's server, no telemetry, no bank connections.

Leave `## Repository`, `## Development`, `## Self-hosting` and `## License` where they are.

- [ ] **Step 3: Write `CONTRIBUTING.md`**

Short, and honest about the state of the project:

1. **Status** — a POC being built to a written spec; the spec and the roadmap are in `docs/superpowers/`, and the spec
   wins over the design prototype.
2. **Getting set up** — `pnpm install`, the three gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`), and the note
   from AGENTS.md that `pnpm lint` can exit 0 while reporting errors, so read the output.
3. **The conventions that are not negotiable** — TypeScript strict with no `any` and no `!`; money as integer minor
   units; dates as `LocalDate`; business rules in `@saldo/core` as pure functions with tests first; no hard-coded UI
   strings (both `it.ts` and `en.ts`); no hard-coded colours, radii or font sizes; `packages/*` never imports from
   `apps/*`; `android/` and `ios/` are generated and never committed.
4. **Commits and branches** — Conventional Commits, a branch per piece of work.
5. **What to open first** — an issue describing the behaviour, before a pull request that changes it.

Point at `AGENTS.md` for the long version rather than restating it: two copies of a convention is one copy that goes
stale.

- [ ] **Step 4: Check every link resolves**

```bash
grep -o "](\([^)]*\))" README.md CONTRIBUTING.md docs/building-android.md docs/building-ios.md
```

For each relative path in that output, confirm the file exists. A README whose screenshots 404 is worse than one
without screenshots.

- [ ] **Step 5: Commit**

```bash
git add README.md CONTRIBUTING.md docs/screenshots
git commit -m "docs: a README that says what Saldo does, with pictures"
```

---

## Task 9: The two Maestro flows

§16 lists E2E as optional, and the roadmap lists the flows. They are worth the hour because they cover the one thing
every other test in this repository cannot: that the screens are wired to each other. Both flows come straight from
§16 — *"Onboarding → add expense → see Home update"* and *"edit recurring 'this and following'"*.

**Files:**
- Create: `apps/mobile/maestro/onboarding-and-first-expense.yaml`
- Create: `apps/mobile/maestro/edit-recurring-following.yaml`
- Modify: `README.md` (one line under Development on how to run them)

- [ ] **Step 1: Install Maestro and confirm it sees the app**

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
maestro --version
```

- [ ] **Step 2: Write the first flow**

Create `apps/mobile/maestro/onboarding-and-first-expense.yaml`:

```yaml
# §16: onboarding → add an expense → Home shows it. Run against a simulator with the app installed
# and its database cleared (Impostazioni → dev → reset, or delete Documents/SQLite/saldo.db).
appId: io.github.saldo.app
---
- launchApp:
    clearState: true
- assertVisible: "Saldo"
- tapOn: "Accedi con passkey"
# The passkey ceremony cannot be driven from here — it hands over to the browser and an
# authenticator. Run this flow on a simulator already signed in, and start it at the next step.
- assertVisible:
    id: "home-screen"
- tapOn:
    id: "fab-add-transaction"
- tapOn: "5"
- tapOn: "0"
- tapOn: "0"
- tapOn: "Spesa"
- tapOn: "Salva"
- assertVisible: "5,00 €"
```

The `id`s above are `testID`s that must exist on the FAB and the Home screen root. Add them where they are missing —
`testID="fab-add-transaction"` and `testID="home-screen"` — in the same commit; a flow that selects on visible Italian
text alone breaks the moment a label is reworded.

- [ ] **Step 3: Write the second flow**

Create `apps/mobile/maestro/edit-recurring-following.yaml`:

```yaml
# §5.9 / §16: editing a recurring transaction with "questa e le successive" changes the future
# occurrences and leaves the past ones alone.
appId: io.github.saldo.app
---
- launchApp
- assertVisible:
    id: "home-screen"
- tapOn: "Transazioni"
- tapOn:
    text: "Affitto"
    index: 0
- tapOn: "Modifica"
- tapOn:
    id: "amount-field"
- inputText: "60000"
- tapOn: "Salva"
- assertVisible: "Questa e le successive"
- tapOn: "Questa e le successive"
- assertVisible: "600,00 €"
```

This one needs the demo data seeded (it selects a recurring "Affitto"), so the flow's first line of documentation is
the seeding command — put it in the comment header the way the first flow does.

- [ ] **Step 4: Run both**

```bash
cd <repo>/apps/mobile && maestro test maestro/
```

Expected: both flows pass. When a selector does not resolve, `maestro studio` shows the tree the flow is matching
against — fix the selector or add the `testID`, never loosen an assertion to make it pass.

- [ ] **Step 5: Document how to run them**

One line under `## Development` in the README:

```markdown
End-to-end flows (needs a simulator with the app installed and [Maestro](https://maestro.mobile.dev)):
`pnpm --filter mobile exec maestro test maestro/`
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/maestro apps/mobile/src apps/mobile/app README.md
git commit -m "test(mobile): two Maestro flows over the paths every unit test misses"
```

---

## Task 10: Verification and acceptance

- [ ] **Step 1: The three gates, read rather than trusted**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: `pnpm lint` prints no `lint/…` line and no `× Some errors were emitted while running checks.`; typecheck and
test print no failures. Per AGENTS.md, `Checked N files … No fixes applied.` is **not** a pass on its own.

- [ ] **Step 2: Walk the §18 checklist item by item**

For each line of the security checklist, name the file that satisfies it or the task that just did:

| Item | Where |
| --- | --- |
| No telemetry or third-party calls | audit: `grep -rn "fetch(\|axios" apps/mobile/src` — every host is the configured server |
| Tokens in the keychain | `apps/mobile/src/auth/tokenStore.ts` (`expo-secure-store`) |
| Parameterised queries, Zod on every body, per-user scoping, body limits | `apps/web/src/server/**` |
| Auth rate limiting, secure headers, no user enumeration | `apps/web/src/server/auth/auth.ts`, `apps/web/next.config.ts` |
| `redirect_uri` allow-listed, single-use codes | `apps/web/src/server/auth/redirect.ts`, the invite/OTT tests |
| CSV import treats cells as text; export escapes formulas | Task 2 |
| App lock hides content in the switcher | Task 3 |

Anything with no answer is a finding: fix it here or record it in the roadmap as knowingly unmet. Do not tick a line
because it sounds done.

- [ ] **Step 3: Meet the phase's own acceptance criterion**

On a machine that has never built this app (or the closest available thing: a fresh clone in a new directory, with
`~/.gradle/gradle.properties` as the only prepared state), follow `docs/building-android.md` from the top with no
other knowledge, and install the APK on a phone. Then follow `docs/building-ios.md` and run on a device. Both must
reach the sign-in screen and sign in to a self-hosted server.

- [ ] **Step 4: Record the outcome in the roadmap**

Update the `### 11 — Release docs & hardening` section of `docs/superpowers/plans/README.md`: mark it done, list what
was verified and **what was not** (the phase-10 sections are the model — they name the passkey ceremony as unverified
rather than glossing it), and carry forward the §19.4 number from Task 5.

- [ ] **Step 5: Request a review**

Use the **requesting-code-review** skill over the whole phase branch, as AGENTS.md requires at the end of every phase.

- [ ] **Step 6: Commit and merge**

```bash
git add docs/superpowers/plans/README.md
git commit -m "docs(plans): record what phase 11 verified, and what it could not"
git checkout main && git merge --no-ff phase/11-release-hardening
```

---

## Out of scope

The web app UI (§17.1), AI features (§17.2, §17.3), native passkeys (§9.4), pushing aggregation into SQL (a follow-up
if Task 5 says so), the local-row scoping that 10b stands in for, and the backlog in
`2026-09-13-11z-backlog-cleanup.md` — that plan is independent and can run before, after or alongside this one.
