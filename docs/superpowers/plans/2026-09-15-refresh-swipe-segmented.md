# Pull to refresh, no swipe-back under the tabs, and a Segmented that fits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three items from `TODO.md`: a pull on a screen runs a sync and says when it could not; the tab screens
cannot be swiped (or hardware-backed) into a screen that should be gone; and `Segmented` keeps a long label on one
centred line.

**Architecture:** Three independent tasks, one commit each, on `fix/refresh-swipe-segmented`. Navigation gets two small
helpers in `src/navigation/history.ts`, tested against the real router with `expo-router/testing-library`. Pull to
refresh is a hook (`useSyncRefresh`) over the existing scheduler, a `SyncScrollView` that uses it, and an opt-in
`refreshable` prop on `Screen`.

**Tech Stack:** Expo Router 57, React Native 0.86, jest-expo + RNTL 14, `@saldo/i18n` catalogs.

**Branch:** `fix/refresh-swipe-segmented`. Items leave `TODO.md` in the commit that closes them.

---

## What was checked before planning

**Which screen does the swipe reveal?** Neither a device nor Maestro was available, so the question was answered with
`renderRouter` and the real router (`src/navigation/history.test.tsx`, first run as a spike):

| Path | Root stack afterwards |
| --- | --- |
| push `/profile` → `replace('/lock')` (what `useAppLock` does) → `replace('/(tabs)')` (what `lock.tsx` does) | `[(tabs), (tabs)]` |
| `/period` → push `/categories` → `replace('/(tabs)')` (what onboarding does) | `[(tabs)]` |

So the TODO's guess was half right. Onboarding leaves nothing behind. Unlocking does: `replace` at the root stack
swaps only the **focused** route (`StackRouter` `REPLACE` uses `state.index`), so relocking over a pushed screen and
unlocking stacks a **second copy of the tabs** over the first, and that copy is what the edge swipe goes back to. The
same mechanism leaves the signed-in screens under the boot router after "Esci" (`profile/server.tsx`), after a restore
(`profile/restore.tsx`) and after the developer reset (`profile.tsx`). It also makes the lock screen itself
swipeable back to the tabs it is meant to cover.

`jest.config.js` needed `standard-navigation` in its transform allow-list for `expo-router` to be importable unmocked.

**Does "Current account" fit?** Measured with the Geist Medium metrics at the `footnote` size (13pt). A segment of the
four-option control on a 390pt-wide phone is ~78pt (~74pt at 375pt):

| Label | Width | Scale needed |
| --- | --- | --- |
| Current account | 101pt | 0.77 |
| Carta di credito | 96pt | 0.81 |
| Conto corrente | 94pt | 0.83 |

The Italian labels wrap today too. **Decided with the user:** fix the component only, no rename. One line, centred,
shrinking to 80% before truncating; on a 390pt phone that fits both Italian labels and truncates "Current account".

**Decisions where the spec is silent** (recorded here per AGENTS.md):

- The spinner follows **the pull**, not the sync status. The scheduler also syncs every minute on its own, and a
  `RefreshControl` driven by `status.kind === 'syncing'` would pop a spinner at the top of the screen each time.
- A pull that fails says so in a toast: "session expired", the two schema messages, or a generic "could not sync".
  A pull that works says nothing; the rows it brought are already on screen.
- `refreshable` is opt-in: the tabs, Profile, Server, Budgets, the tag list, and the account, category, tag and
  transaction details. Not forms (a sheet already closes on a downward swipe), onboarding, the lock screen, or
  import/export/restore.
- The lock screen is not swipeable either, and anything that must have nothing behind it — the lock, the boot router
  after signing out or restoring — clears the root stack first.

---

## Task 1: `Segmented` keeps a long label on one centred line

**Files:**
- Modify: `apps/mobile/src/components/Segmented.tsx`
- Test: `apps/mobile/src/components/a11y.test.tsx` (the `Segmented` block)
- Modify: `TODO.md` (remove "Account type toggle in onboarding step 2")

- [x] **Step 1: Write the failing test**

In `a11y.test.tsx` (`StyleSheet` is already imported), add to `describe('Segmented')`:

```tsx
  // "Current account" needs 77% of the footnote size in a four-way segment; wrapping made the
  // selected pill taller than the rest and left the text flush left.
  it('keeps a long label on one centred line, shrinking before it truncates', async () => {
    await showSegmented();
    const label = screen.getByText('Expense');
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(label.props.minimumFontScale).toBe(0.8);
    expect(StyleSheet.flatten(label.props.style).textAlign).toBe('center');
  });
```

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter mobile exec jest src/components/a11y.test.tsx --selectProjects app`
Expected: FAIL — `numberOfLines` is `undefined`.

(The path goes **before** `--selectProjects`: that flag takes several values and would swallow it.)

- [x] **Step 3: Implement**

In `Segmented.tsx`, replace the label:

```tsx
            {/*
              One line, centred, shrinking to 80% before it truncates. Four account types share
              ~78pt each on a 390pt phone: "Carta di credito" needs 81% and fits, "Current account"
              needs 77% and truncates, and neither wraps any more — wrapping is what made the
              selected pill taller than its neighbours and left the text flush left.
            */}
            <Text
              size="footnote"
              weight="medium"
              color={selected ? 'onAccent' : 'textMuted'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ alignSelf: 'stretch', textAlign: 'center' }}
            >
              {option.label}
            </Text>
```

- [x] **Step 4: Run it and watch it pass**

Run: `rtk proxy pnpm --filter mobile exec jest src/components/a11y.test.tsx --selectProjects app`
Expected: PASS.

- [x] **Step 5: Remove the item from `TODO.md` and commit**

```bash
rtk git add apps/mobile/src/components TODO.md
rtk git commit -m "fix(mobile): a segment keeps a long label on one centred line"
```

---

## Task 2: Nothing to swipe back to under the tabs or the lock

**Files:**
- Create: `apps/mobile/src/navigation/history.ts`
- Test: `apps/mobile/src/navigation/history.test.tsx` (replaces the spike)
- Modify: `apps/mobile/jest.config.js` (`standard-navigation` in `RN_PACKAGES`)
- Modify: `apps/mobile/app/_layout.tsx`, `app/lock.tsx`, `app/(onboarding)/categories.tsx`,
  `src/features/lock/useAppLock.ts`, `app/profile/server.tsx`, `app/profile/restore.tsx`, `app/profile.tsx`
- Modify: `TODO.md` (remove "No swipe-back on the tab screens")

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/navigation/history.test.tsx`:

```tsx
import { router, Stack, Tabs } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { enterTabs, startOver } from './history';

const page = (name: string) => () => <Text>{name}</Text>;

/** The shape of the app's navigators, with nothing inside the screens. */
const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: page('boot'),
  '(tabs)/_layout': () => <Tabs />,
  '(tabs)/home': page('home'),
  '(tabs)/accounts': page('accounts'),
  '(onboarding)/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  '(onboarding)/period': page('period'),
  '(onboarding)/categories': page('categories'),
  lock: page('lock'),
  profile: page('profile'),
};

type Rendered = ReturnType<typeof renderRouter>;

/**
 * `renderRouter` hangs its getters on what RNTL's `render` returns, which in RNTL 14 is a promise:
 * awaiting it hands back the plain result without them, so the promise itself is kept.
 */
async function open(initialUrl: string): Promise<Rendered> {
  const rendered = renderRouter(ROUTES, { initialUrl });
  await rendered;
  return rendered;
}

/** Route names in the root stack, bottom first. */
function rootStack(rendered: Rendered): string[] {
  return rendered.getRouterState()?.routes[0]?.state?.routes.map((route) => route.name) ?? [];
}

async function run(navigate: () => void): Promise<void> {
  await act(async () => {
    navigate();
  });
}

describe('enterTabs', () => {
  it('goes back to the tabs underneath instead of stacking a second copy on them', async () => {
    const rendered = await open('/home');
    await run(() => router.push('/profile'));
    await run(() => router.replace('/lock'));
    expect(rootStack(rendered)).toEqual(['(tabs)', 'lock']);

    await run(() => enterTabs(router));

    expect(rootStack(rendered)).toEqual(['(tabs)']);
  });

  it('leaves nothing under the tabs at the end of onboarding', async () => {
    const rendered = await open('/period');
    await run(() => router.push('/categories'));

    await run(() => enterTabs(router));

    expect(rootStack(rendered)).toEqual(['(tabs)']);
  });
});

describe('startOver', () => {
  it('leaves nothing under the lock screen for a swipe to uncover', async () => {
    const rendered = await open('/home');
    await run(() => router.push('/profile'));

    await run(() => startOver(router, '/lock'));

    expect(rootStack(rendered)).toEqual(['lock']);
  });

  it('leaves none of the signed-in screens under the boot router', async () => {
    const rendered = await open('/home');
    await run(() => router.push('/profile'));

    await run(() => startOver(router, '/'));

    expect(rootStack(rendered)).toEqual(['index']);
  });
});
```

The fixture names the first tab `home` rather than `index` so that `/` is unambiguously the boot router.

- [ ] **Step 2: Run them and watch them fail**

Run: `rtk proxy pnpm --filter mobile exec jest src/navigation/history.test.tsx --selectProjects app`
Expected: FAIL — `Cannot find module './history'`.

- [ ] **Step 3: Implement the helpers**

`apps/mobile/src/navigation/history.ts`:

```ts
import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Arrives at the tabs, which are the bottom of the app: nothing may sit under them.
 *
 * Not `replace`. At the root stack that swaps only the top route, so unlocking over a pushed screen
 * — `[tabs, lock]` — ended as `[tabs, tabs]`, and the edge swipe went back to a stale copy of the
 * tabs. `dismissTo` pops back to the tabs already in the history, and replaces only when there
 * are none: after onboarding, or a cold start behind the lock.
 */
export function enterTabs(router: Router): void {
  router.dismissTo('/(tabs)');
}

/**
 * Opens a screen that must have nothing behind it: the lock screen, which a swipe or Android's back
 * must not uncover, and the boot router after signing out or restoring, which would otherwise sit
 * over screens of a session that is gone.
 */
export function startOver(router: Router, href: '/' | '/lock'): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `rtk proxy pnpm --filter mobile exec jest src/navigation/history.test.tsx --selectProjects app`
Expected: PASS, 4 tests.

- [ ] **Step 5: Use them everywhere the app enters the tabs or starts over**

`app/lock.tsx`: `if (result.success) enterTabs(router);` (import from `../src/navigation/history`).

`app/(onboarding)/categories.tsx`: `enterTabs(router);` in place of `router.replace('/(tabs)')`.

`src/features/lock/useAppLock.ts`: `startOver(router, '/lock')` in place of `router.replace('/lock')`.

`app/profile/server.tsx` (sign out), `app/profile/restore.tsx` (after a restore) and `app/profile.tsx` (developer
reset): `startOver(router, '/')` in place of `router.replace('/')`.

`app/(onboarding)/welcome.tsx` keeps `router.replace('/')`: the welcome screen is only ever reached with nothing under
it, by the boot router's own redirect or by `startOver`.

- [ ] **Step 6: Turn the gesture off in the root layout**

In `app/_layout.tsx`, inside the root `Stack`, before the transaction modals:

```tsx
                    {/*
                      The tabs are the bottom of the app and the lock covers it: neither may be
                      swiped away. `enterTabs` and `startOver` already keep anything from being
                      underneath; this is the belt to their braces on iOS, where the edge swipe
                      would otherwise go back to whatever a future navigation leaves there.
                    */}
                    <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
                    <Stack.Screen name="lock" options={{ gestureEnabled: false }} />
```

- [ ] **Step 7: Remove the item from `TODO.md`, run the app tests, commit**

Run: `rtk proxy pnpm --filter mobile exec jest src/navigation src/components --selectProjects app`
Expected: PASS.

```bash
rtk git add apps/mobile TODO.md
rtk git commit -m "fix(mobile): nothing left under the tabs or the lock screen to swipe back to"
```

---

## Task 3: Pull to refresh

**Files:**
- Create: `apps/mobile/src/sync/pullFeedback.ts`, test `pullFeedback.test.ts`
- Create: `apps/mobile/src/sync/useSyncRefresh.ts`, test `useSyncRefresh.test.tsx`
- Create: `apps/mobile/src/components/SyncScrollView.tsx`
- Modify: `apps/mobile/src/components/Screen.tsx`, test `Screen.test.tsx`
- Modify: `apps/mobile/app/(tabs)/transactions.tsx` and the `refreshable` screens listed above
- Modify: `packages/i18n/src/locales/en.ts`, `it.ts` (`sync.pullFailed`)
- Modify: spec §8.5, `TODO.md` (remove "Pull to refresh"), `docs/superpowers/plans/README.md`

- [ ] **Step 1: Write the failing test for what a pull says**

`apps/mobile/src/sync/pullFeedback.test.ts`:

```ts
import { pullFeedbackKey } from './pullFeedback';

describe('pullFeedbackKey', () => {
  it('says nothing when the cycle worked: what it brought is already on screen', () => {
    expect(pullFeedbackKey({ kind: 'idle', lastSyncAt: 1 })).toBeNull();
  });

  it('says the sync failed when the server could not be reached', () => {
    expect(
      pullFeedbackKey({ kind: 'error', code: 'network_error', message: 'offline', retryAt: 5 }),
    ).toBe('sync.pullFailed');
  });

  it('names a schema mismatch, which no amount of pulling will fix', () => {
    expect(
      pullFeedbackKey({ kind: 'error', code: 'schema_too_old', message: '', retryAt: 5 }),
    ).toBe('sync.schemaTooOld');
    expect(
      pullFeedbackKey({ kind: 'error', code: 'schema_too_new', message: '', retryAt: 5 }),
    ).toBe('sync.schemaTooNew');
  });

  it('tells an expired session apart from a failure', () => {
    expect(pullFeedbackKey({ kind: 'session-expired' })).toBe('sync.sessionExpired');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter mobile exec jest src/sync/pullFeedback.test.ts --selectProjects db`
Expected: FAIL — `Cannot find module './pullFeedback'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/sync/pullFeedback.ts`:

```ts
import type { SyncStatus } from './scheduler';

/** Error codes a retry cannot fix, which get their own wording. */
const CODE_KEYS: Record<string, string> = {
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
};

/**
 * What a pull to refresh says once its cycle is over, as a catalog key, or null for nothing.
 *
 * A cycle that worked says nothing: the rows it brought are already on screen. One that did not has
 * to say so, because Saldo carries on locally either way and a spinner that simply stops reads as
 * success.
 */
export function pullFeedbackKey(status: SyncStatus): string | null {
  switch (status.kind) {
    case 'idle':
    case 'syncing':
      return null;
    case 'session-expired':
      return 'sync.sessionExpired';
    case 'error':
      return CODE_KEYS[status.code] ?? 'sync.pullFailed';
  }
}
```

Add to the `sync` block of both catalogues, after `syncing`:

- `en.ts`: `pullFailed: 'Could not sync. Everything stays on this phone until it can.',`
- `it.ts`: `pullFailed: 'Sincronizzazione non riuscita. Tutto resta su questo telefono finché non ci riesce.',`

- [ ] **Step 4: Run it and watch it pass**

Run: `rtk proxy pnpm --filter mobile exec jest src/sync/pullFeedback.test.ts --selectProjects db`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing test for the hook**

`apps/mobile/src/sync/useSyncRefresh.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n';
import type { Scheduler, SyncStatus } from './scheduler';
import { useSyncRefresh } from './useSyncRefresh';

const mockShow = jest.fn();
let mockScheduler: Scheduler | null = null;
let mockUser: { displayName: string } | null = null;

jest.mock('../components/Toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('./SyncProvider', () => ({ useSync: () => ({ scheduler: mockScheduler }) }));
jest.mock('../auth/ServerProvider', () => ({ useServer: () => ({ user: mockUser }) }));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockShow.mockClear();
  mockUser = { displayName: 'Ada' };
});

function wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/** A scheduler whose one cycle ends, in `ending`, only when the test says so. */
function schedulerEndingIn(ending: SyncStatus) {
  let status: SyncStatus = { kind: 'syncing' };
  let finish = () => {};
  const scheduler: Scheduler = {
    start: jest.fn(),
    stop: jest.fn(),
    requestSync: jest.fn(),
    subscribe: () => () => undefined,
    status: () => status,
    syncNow: jest.fn(
      () =>
        new Promise<null>((resolve) => {
          finish = () => {
            status = ending;
            resolve(null);
          };
        }),
    ),
  };
  return { scheduler, finish: () => finish() };
}

describe('useSyncRefresh', () => {
  it('offers no pull on a build with nothing to sync with', async () => {
    mockScheduler = null;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('offers no pull while signed out', async () => {
    mockScheduler = schedulerEndingIn({ kind: 'idle', lastSyncAt: 1 }).scheduler;
    mockUser = null;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('spins from the pull until the cycle is over, and says nothing when it worked', async () => {
    const fake = schedulerEndingIn({ kind: 'idle', lastSyncAt: 1 });
    mockScheduler = fake.scheduler;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });

    await act(async () => result.current?.onRefresh());
    expect(result.current?.refreshing).toBe(true);
    expect(fake.scheduler.syncNow).toHaveBeenCalledTimes(1);

    await act(async () => fake.finish());
    expect(result.current?.refreshing).toBe(false);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('says it could not sync when the server was out of reach', async () => {
    const fake = schedulerEndingIn({
      kind: 'error',
      code: 'network_error',
      message: 'offline',
      retryAt: 5,
    });
    mockScheduler = fake.scheduler;
    const { result } = await renderHook(() => useSyncRefresh(), { wrapper });

    await act(async () => result.current?.onRefresh());
    await act(async () => fake.finish());

    expect(mockShow).toHaveBeenCalledWith(
      'Could not sync. Everything stays on this phone until it can.',
    );
    expect(result.current?.refreshing).toBe(false);
  });
});
```

- [ ] **Step 6: Run it and watch it fail**

Run: `rtk proxy pnpm --filter mobile exec jest src/sync/useSyncRefresh.test.tsx --selectProjects app`
Expected: FAIL — `Cannot find module './useSyncRefresh'`.

- [ ] **Step 7: Implement the hook**

`apps/mobile/src/sync/useSyncRefresh.ts`:

```ts
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServer } from '../auth/ServerProvider';
import { useToast } from '../components/Toast';
import { pullFeedbackKey } from './pullFeedback';
import { useSync } from './SyncProvider';

export interface SyncRefresh {
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Pull to refresh (§8.5). A pull runs a cycle now, or joins the one already running, and the
 * spinner stays until that cycle is over. Null when there is nothing to sync with — a local-only
 * build, or signed out — so the screen offers no pull rather than one that does nothing.
 *
 * The spinner follows the pull, not the sync status: the scheduler also syncs every minute on its
 * own, and a spinner that appeared at the top of the screen each time would push the content down
 * under the user's thumb. Nothing is refetched afterwards; `useLiveQuery` already redraws on the
 * rows the cycle wrote.
 */
export function useSyncRefresh(): SyncRefresh | null {
  const { scheduler } = useSync();
  const { user } = useServer();
  const toast = useToast();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    if (scheduler === null) return;
    setRefreshing(true);
    scheduler
      .syncNow()
      .then(() => {
        const key = pullFeedbackKey(scheduler.status());
        if (key !== null) toast.show(t(key));
      })
      // The cycle publishes its own failures, so this is only for one that escaped even that.
      .catch(() => toast.show(t('sync.pullFailed')))
      .finally(() => setRefreshing(false));
  }, [scheduler, toast, t]);

  if (scheduler === null || user === null) return null;
  return { refreshing, onRefresh };
}
```

- [ ] **Step 8: Run it and watch it pass**

Run: `rtk proxy pnpm --filter mobile exec jest src/sync/useSyncRefresh.test.tsx --selectProjects app`
Expected: PASS, 4 tests.

- [ ] **Step 9: Write the failing `Screen` tests**

In `Screen.test.tsx`, mock the hook at the top (after the imports) and add two tests:

```tsx
const mockOnRefresh = jest.fn();

// The hook needs the server, sync and toast providers; what `Screen` owes it is only the wiring.
jest.mock('../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: mockOnRefresh }),
}));
```

```tsx
  it('lets a refreshable screen be pulled to sync', async () => {
    await render(
      <Host>
        <Screen refreshable>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    const control = screen.getByTestId('screen-scroll').props.refreshControl;
    expect(control.props.onRefresh).toBe(mockOnRefresh);
  });

  it('offers no pull on any other screen: a sheet already closes on that gesture', async () => {
    await render(
      <Host>
        <Screen>
          <RNText>body</RNText>
        </Screen>
      </Host>,
    );
    expect(screen.getByTestId('screen-scroll').props.refreshControl).toBeUndefined();
  });
```

- [ ] **Step 10: Run them and watch the first fail**

Run: `rtk proxy pnpm --filter mobile exec jest src/components/Screen.test.tsx --selectProjects app`
Expected: FAIL — `refreshControl` is undefined on the refreshable screen (and a type error on `refreshable`).

- [ ] **Step 11: Implement `SyncScrollView` and the prop**

`apps/mobile/src/components/SyncScrollView.tsx`:

```tsx
import { RefreshControl, ScrollView, type ScrollViewProps } from 'react-native';
import { useSyncRefresh } from '../sync/useSyncRefresh';
import { useTheme } from '../theme/ThemeProvider';

/** A `ScrollView` a pull can sync (§8.5); with nothing to sync with, a plain one. */
export function SyncScrollView(props: Omit<ScrollViewProps, 'refreshControl'>) {
  const theme = useTheme();
  const refresh = useSyncRefresh();
  return (
    <ScrollView
      {...props}
      refreshControl={
        refresh === null ? undefined : (
          <RefreshControl
            refreshing={refresh.refreshing}
            onRefresh={refresh.onRefresh}
            tintColor={theme.palette.textMuted}
            colors={[theme.palette.accent]}
            progressBackgroundColor={theme.palette.raised}
          />
        )
      }
    />
  );
}
```

In `Screen.tsx`, add the prop to `ScreenProps`:

```tsx
  /**
   * Pulling the content down runs a sync (§8.5). For screens that show synced data and hold nothing
   * half-typed: a form's sheet already closes on a downward swipe, and onboarding has no account to
   * sync with yet.
   */
  refreshable?: boolean;
```

destructure it (`refreshable = false`), pick the scroller once — `const Scroller = refreshable ? SyncScrollView :
ScrollView;` — and render `<Scroller …>` where `<ScrollView …>` was, with the same props.

- [ ] **Step 12: Run them and watch them pass**

Run: `rtk proxy pnpm --filter mobile exec jest src/components/Screen.test.tsx --selectProjects app`
Expected: PASS, 5 tests.

- [ ] **Step 13: Opt the screens in**

Add `refreshable` to the main `<Screen>` of: `app/(tabs)/index.tsx`, `app/(tabs)/accounts.tsx`, `app/(tabs)/stats.tsx`,
`app/profile.tsx`, `app/profile/server.tsx`, `app/budgets.tsx`, `app/settings/tags.tsx`, `app/account/[id].tsx`,
`app/category/[id].tsx`, `app/tag/[id].tsx`, `app/transaction/[id].tsx`.

In `app/(tabs)/transactions.tsx` the list is its own `ScrollView`; make it a `SyncScrollView` with the same props (the
chip row stays a horizontal `ScrollView`).

- [ ] **Step 14: Spec, roadmap, TODO**

Spec §8.5, triggers: "pull-to-refresh on the Server screen" becomes "pull-to-refresh on the tabs, the Server screen
and the other screens that show synced data (never a form); the spinner follows the pull, and a pull that could not
sync says so in a toast". Remove "Pull to refresh" from `TODO.md`. Add this plan to the roadmap's backlog section.

- [ ] **Step 15: Verify and commit**

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines and no "Some errors were emitted"; typecheck clean; every suite passing (the i18n parity
test included).

```bash
rtk git add apps/mobile packages/i18n docs TODO.md
rtk git commit -m "feat(mobile): pull to refresh runs a sync and says when it could not"
```
