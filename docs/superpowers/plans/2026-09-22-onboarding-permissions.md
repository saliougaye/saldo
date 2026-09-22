# Onboarding permissions step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a last onboarding step, on both paths, that asks up front for notifications, camera and the biometric app lock, one at a time, each with a sentence and «Attiva» / «Più tardi». Add a Profile screen to see and change them afterwards.

**Architecture:** The step becomes step 5 of 5 on the fresh and the import path. It is `app/(onboarding)/permissions.tsx`, and «Inizia» moves there: the categories screen and the import-balances screen now store what they collected in the draft and push the new step. `finishOnboarding` (new, `src/features/onboarding/finish.ts`) writes everything. The rules (what an OS response means, which row is open, how a later OS read may change an answer) are pure functions in `@saldo/core` (`permissions.ts`). The screen only loads the OS state, calls those rules and renders `PermissionsList` (the "Sequenza" layout). The system prompt is only called from «Attiva»: iOS shows it once, and the in-context requests (`BudgetAlertsGate`, `captureFromCamera`) still rely on it.

**Tech Stack:** Expo SDK 57 (`expo-notifications`, `expo-image-picker`, `expo-local-authentication`, `Linking.openSettings`), react-native-reanimated 4.5 (`LinearTransition`, `FadeIn`, custom entering worklet), jest-expo + `@testing-library/react-native`, vitest for `@saldo/core` and `@saldo/ui`.

**Chosen in the variants round** (`docs/superpowers/mockups/2026-09-22-onboarding-permissions-variants.html`, variant *Sequenza*, 2026-09-22). Decisions taken with it:

- **Placement:** step 5 of 5, after categories (fresh) and after the balances (import). Both paths, because the permissions do not depend on where the data came from. It uses the step chrome («Indietro» + «Inizia», segments).
- **Lock row copy** says «Blocco con biometria» (the Profile's existing label), not «Face ID»: the same build runs on Android.
- **Lock outcomes:** `authenticateAsync` succeeds → on. The user cancels → the row stays open. Any other failure → «Non attivato», with no settings link: the lock is an app setting, and Profile has the toggle.
- **Already decided by the OS** (a reinstall keeps permissions): the row shows the state and is never asked. Returning from the system settings re-reads the state, and it can only upgrade an answer. The rules are in `mergeOsState`.
- **Motion:** as in the harness, with no blur. The row grows in 300ms (`LinearTransition`). The body fades in 80ms later. The status replaces the buttons from scale 0.96 and opacity 0 (better-ui swap curve `0.2,0,0,1`), its icon from 0.25. React Native has no cheap `filter: blur`, and scale + opacity carry the change without it.
- **Correction to the harness notes:** the iOS usage strings are already localised (`apps/mobile/locales/it.json`, wired by `locales` in `app.config.ts`). No change is needed there.

**Out of scope:** changing `BudgetAlertsGate` or `captureFromCamera` (their in-context requests stay as the fallback for «Più tardi»). Asking for biometrics when the Profile toggle is switched on.

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/ui/src/icons.ts` (modify) | `bell` and `scanFace` from Lucide 1.47.0. |
| `packages/ui/src/icons.test.ts` (modify) | Icon count 136 → 138. |
| `packages/ui/src/tokens.ts` (modify) | `expandMs`, `revealDelayMs`, `swapEasing`, `swapFromScale`, `swapIconFromScale`. |
| `packages/ui/src/tokens.test.ts` (modify) | Relationships of the new tokens. |
| `packages/core/src/permissions.ts` (create) | Types and pure rules: `permissionState`, `answerFromRequest`, `answerFromUnlock`, `mergeOsState`, `nextPending`. |
| `packages/core/src/permissions.test.ts` (create) | Tests for the rules. |
| `packages/core/src/index.ts` (modify) | Export `./permissions`. |
| `packages/i18n/src/locales/it.ts`, `en.ts` (modify) | `permissions.*`, `onboarding.permissions*`, `profile.permissions*`. |
| `apps/mobile/src/theme/motion.ts` (modify) | `expanding`, `revealing`, `swapIn()`. |
| `apps/mobile/src/features/permissions/systemPermissions.ts` (create) | OS adapters: request, open settings, `useSystemPermissions` (read on mount and on return to foreground). |
| `apps/mobile/src/features/permissions/systemPermissions.test.tsx` (create) | The hook reads, maps and refreshes on `active`. |
| `apps/mobile/src/features/permissions/PermissionsList.tsx` (create) | The Sequenza card: one open row, a status on the answered ones. |
| `apps/mobile/src/features/permissions/PermissionsList.test.tsx` (create) | Open row, callbacks, statuses, settings link. |
| `apps/mobile/src/features/onboarding/state.tsx` (modify) | `ONBOARDING_STEPS`, draft fields `appLock`, `importBalanceBuffers`. |
| `apps/mobile/src/features/onboarding/finish.ts` (create) | «Inizia»: seed by path, then the lock flag. |
| `apps/mobile/src/features/onboarding/finish.test.ts` (create) | Both paths and the lock flag, on a test database. |
| `apps/mobile/app/(onboarding)/permissions.tsx` (create) | Step 5. |
| `apps/mobile/app/(onboarding)/{period,cycle-day,account-details,balance,categories,import-currency,import-file,import-balances}.tsx` (modify) | `total: ONBOARDING_STEPS`; categories and import-balances push `/permissions`. |
| `apps/mobile/app/profile/permissions.tsx` (create) | Profile → Permessi. |
| `apps/mobile/app/profile.tsx` (modify) | The «Permessi» row. |
| `apps/mobile/maestro/onboarding-and-first-expense.yaml` (modify) | Categories «Continua», then «Più tardi» ×3, then «Inizia». |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (modify) | §6.29 row. |
| `TODO.md` (modify) | Remove the item. |
| `docs/superpowers/mockups/2026-09-22-onboarding-permissions-variants.html` (delete) | Harness, deleted on promotion. |

---

### Task 1: Icons `bell` and `scanFace`

**Files:**
- Modify: `packages/ui/src/icons.ts` (end of `iconMarkup`, after `eyeOff`)
- Modify: `packages/ui/src/icons.test.ts:37`

- [ ] **Step 1: Update the count in the test**

In `packages/ui/src/icons.test.ts` replace `expect(ICON_NAMES).toHaveLength(136);` with:

```ts
    expect(ICON_NAMES).toHaveLength(138);
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @saldo/ui test`
Expected: FAIL — `expected [...] to have a length of 138 but got 136`.

- [ ] **Step 3: Add the icons**

In `packages/ui/src/icons.ts`, after the `eyeOff` entry and before `} as const satisfies`, add:

```ts
  // Lucide 1.47.0 `bell` / `scan-face`, for the onboarding permissions step (2026-09-22 plan).
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  scanFace:
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @saldo/ui test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/icons.ts packages/ui/src/icons.test.ts
git commit -m "feat(ui): bell and scan-face icons for the permissions step"
```

---

### Task 2: Motion tokens

**Files:**
- Modify: `packages/ui/src/tokens.ts` (`motion`, after `stepEnterOffset`)
- Modify: `packages/ui/src/tokens.test.ts` (after the `onboarding step motion` block)

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/tokens.test.ts`:

```ts
describe('permissions list motion', () => {
  it('reveals the body inside the row growth and swaps within the UI budget', () => {
    expect(motion.revealDelayMs).toBeLessThan(motion.expandMs);
    expect(motion.expandMs).toBeLessThanOrEqual(300);
    // better-ui: a swap never starts from nothing, and the icon travels further than the text.
    expect(motion.swapFromScale).toBeGreaterThanOrEqual(0.95);
    expect(motion.swapIconFromScale).toBeLessThan(motion.swapFromScale);
    expect(motion.swapEasing).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @saldo/ui test`
Expected: FAIL — `motion.revealDelayMs` is undefined (typecheck in the editor, `NaN`/undefined comparison at runtime).

- [ ] **Step 3: Add the tokens**

In `packages/ui/src/tokens.ts`, inside `motion`, after `stepEnterOffset: 12,` add:

```ts
  /**
   * The onboarding permissions list (2026-09-22 plan): one row open at a time. The row grows over
   * `expandMs`, its body fades in `revealDelayMs` later, so the text never appears in a row that is
   * still too short for it.
   */
  expandMs: 300,
  revealDelayMs: 80,
  /**
   * A status replacing the buttons that produced it (better-ui swap): from `swapFromScale` and
   * transparent, the icon from `swapIconFromScale`, on this curve.
   */
  swapEasing: [0.2, 0, 0, 1] as const,
  swapFromScale: 0.96,
  swapIconFromScale: 0.25,
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @saldo/ui test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
git commit -m "feat(ui): motion tokens for the permissions list"
```

---

### Task 3: Permission rules in `@saldo/core`

**Files:**
- Create: `packages/core/src/permissions.ts`
- Create: `packages/core/src/permissions.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/permissions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  answerFromRequest,
  answerFromUnlock,
  mergeOsState,
  nextPending,
  type PermissionAnswer,
  type PermissionKey,
  permissionState,
} from './permissions';

const answers = (
  partial: Partial<Record<PermissionKey, PermissionAnswer>>,
): Record<PermissionKey, PermissionAnswer> => ({
  notifications: 'pending',
  camera: 'pending',
  appLock: 'pending',
  ...partial,
});

describe('permissionState', () => {
  it('reads a granted permission as granted, whatever canAskAgain says', () => {
    expect(permissionState({ granted: true, canAskAgain: false })).toBe('granted');
  });
  it('reads one the OS will still prompt for as askable', () => {
    expect(permissionState({ granted: false, canAskAgain: true })).toBe('askable');
  });
  it('reads one the OS will not prompt for again as denied', () => {
    expect(permissionState({ granted: false, canAskAgain: false })).toBe('denied');
  });
});

describe('answerFromRequest', () => {
  it('is granted or denied: a refused prompt is an answer even when Android could ask again', () => {
    expect(answerFromRequest({ granted: true, canAskAgain: true })).toBe('granted');
    expect(answerFromRequest({ granted: false, canAskAgain: true })).toBe('denied');
  });
});

describe('answerFromUnlock', () => {
  it('turns the lock on after a successful authentication', () => {
    expect(answerFromUnlock({ success: true })).toBe('granted');
  });
  it('leaves the row open when the user or the system cancelled', () => {
    for (const error of ['user_cancel', 'system_cancel', 'app_cancel']) {
      expect(answerFromUnlock({ success: false, error })).toBe('pending');
    }
  });
  it('reads any other failure as denied', () => {
    expect(answerFromUnlock({ success: false, error: 'passcode_not_set' })).toBe('denied');
  });
});

describe('mergeOsState', () => {
  it('fills a pending answer with what the OS already decided', () => {
    expect(mergeOsState('pending', 'granted')).toBe('granted');
    expect(mergeOsState('pending', 'denied')).toBe('denied');
    expect(mergeOsState('pending', 'askable')).toBe('pending');
  });
  it('upgrades any answer to granted — the user switched it on in the settings', () => {
    expect(mergeOsState('denied', 'granted')).toBe('granted');
    expect(mergeOsState('later', 'granted')).toBe('granted');
  });
  it('never reopens an answer the user gave', () => {
    expect(mergeOsState('denied', 'askable')).toBe('denied');
    expect(mergeOsState('later', 'askable')).toBe('later');
    expect(mergeOsState('later', 'denied')).toBe('later');
  });
});

describe('nextPending', () => {
  it('opens the first pending row, in the fixed order', () => {
    expect(nextPending(answers({}))).toBe('notifications');
    expect(nextPending(answers({ notifications: 'later' }))).toBe('camera');
    expect(nextPending(answers({ notifications: 'granted', camera: 'denied' }))).toBe('appLock');
  });
  it('opens nothing once every row is answered', () => {
    expect(
      nextPending(answers({ notifications: 'granted', camera: 'later', appLock: 'denied' })),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @saldo/core test -- permissions`
Expected: FAIL — `Failed to resolve import "./permissions"`.

- [ ] **Step 3: Implement**

Create `packages/core/src/permissions.ts`:

```ts
/**
 * The onboarding permissions step and Profile → Permessi (§6.29). The OS calls live in the app;
 * these are the rules that read their answers.
 */

/** The rows, in the order the step asks them. `appLock` is a setting, not an OS permission. */
export type PermissionKey = 'notifications' | 'camera' | 'appLock';
export const PERMISSION_ORDER: readonly PermissionKey[] = ['notifications', 'camera', 'appLock'];

/** What the step knows about a row. `later` is «Più tardi»: skipped, asked in context instead. */
export type PermissionAnswer = 'pending' | 'granted' | 'denied' | 'later';

/** The two fields every Expo permission response carries. */
export interface OsPermission {
  granted: boolean;
  canAskAgain: boolean;
}

/** What the OS will do if asked: nothing (granted), prompt (askable), or refuse (denied). */
export type PermissionState = 'granted' | 'askable' | 'denied';

export function permissionState(permission: OsPermission): PermissionState {
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'askable' : 'denied';
}

/**
 * The answer after the system prompt. A refusal is final for this step even where Android would
 * prompt once more: asking twice in a row is exactly the nagging the step exists to avoid.
 */
export function answerFromRequest(permission: OsPermission): PermissionAnswer {
  return permission.granted ? 'granted' : 'denied';
}

/** The `error` values of `expo-local-authentication` that mean "nobody decided anything". */
const CANCELLED = new Set(['user_cancel', 'system_cancel', 'app_cancel']);

/** The lock row after `authenticateAsync`: on, still open (cancelled), or not available. */
export function answerFromUnlock(result: { success: boolean; error?: string }): PermissionAnswer {
  if (result.success) return 'granted';
  return result.error !== undefined && CANCELLED.has(result.error) ? 'pending' : 'denied';
}

/**
 * A fresh OS read against the answer on screen. The OS fills a row nobody answered yet (a
 * reinstall keeps its permissions) and may upgrade anything to granted (the user switched it on
 * in the settings), but it never reopens an answer the user gave.
 */
export function mergeOsState(current: PermissionAnswer, state: PermissionState): PermissionAnswer {
  if (state === 'granted') return 'granted';
  if (current !== 'pending') return current;
  return state === 'denied' ? 'denied' : 'pending';
}

/** The row that is open: the first one still pending, or none. */
export function nextPending(
  answers: Readonly<Record<PermissionKey, PermissionAnswer>>,
): PermissionKey | null {
  return PERMISSION_ORDER.find((key) => answers[key] === 'pending') ?? null;
}
```

In `packages/core/src/index.ts`, after `export * from './period';` add:

```ts
export * from './permissions';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @saldo/core test -- permissions`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/permissions.ts packages/core/src/permissions.test.ts packages/core/src/index.ts
git commit -m "feat(core): rules for the onboarding permissions step"
```

---

### Task 4: Copy

**Files:**
- Modify: `packages/i18n/src/locales/it.ts` (`onboarding`, `profile`, new `permissions` block after `lock`)
- Modify: `packages/i18n/src/locales/en.ts` (same places)

- [ ] **Step 1: Italian**

In `it.ts`, inside `onboarding`, after `importBalancesBody: …,` add:

```ts
    permissionsTitle: 'Ancora tre cose',
    permissionsBody:
      'Te le chiediamo adesso, così non ti interrompiamo dopo. Ognuna si cambia dal Profilo.',
    permissionsNote: 'Una alla volta. Quello che salti lo ritrovi nel Profilo.',
```

After the `lock: { … },` block add:

```ts
  permissions: {
    notificationsTitle: 'Notifiche',
    notificationsBody: 'Ti avvisiamo quando un budget sta per finire, prima che succeda.',
    notificationsOn: 'Attive',
    notificationsDenied: 'Non consentite',
    cameraTitle: 'Fotocamera',
    cameraBody: 'Per fotografare uno scontrino e allegarlo alla spesa.',
    cameraOn: 'Attiva',
    cameraDenied: 'Non consentita',
    appLockTitle: 'Blocco con biometria',
    appLockBody: 'Saldo si apre solo con il tuo volto o la tua impronta. È un’impostazione, non un permesso.',
    appLockOn: 'Attivo',
    appLockDenied: 'Non attivato',
    appLockPrompt: 'Attiva il blocco di Saldo',
    activate: 'Attiva',
    later: 'Più tardi',
    openSettings: 'Impostazioni',
    openSettingsLabel: 'Apri le Impostazioni di sistema',
  },
```

Inside `profile`, after `appLock: 'Blocco con biometria',` add:

```ts
    permissions: 'Permessi',
    permissionsBody:
      'Cosa può usare Saldo su questo telefono. Quelli negati si riattivano dalle Impostazioni di sistema.',
```

- [ ] **Step 2: English**

In `en.ts`, inside `onboarding`, after `importBalancesBody: …,` add:

```ts
    permissionsTitle: 'Three more things',
    permissionsBody:
      'We ask now so we don’t interrupt you later. You can change each one from your Profile.',
    permissionsNote: 'One at a time. Anything you skip is waiting in your Profile.',
```

After the `lock: { … },` block add:

```ts
  permissions: {
    notificationsTitle: 'Notifications',
    notificationsBody: 'We let you know when a budget is about to run out, before it does.',
    notificationsOn: 'On',
    notificationsDenied: 'Not allowed',
    cameraTitle: 'Camera',
    cameraBody: 'To photograph a receipt and attach it to the expense.',
    cameraOn: 'On',
    cameraDenied: 'Not allowed',
    appLockTitle: 'Biometric lock',
    appLockBody: 'Saldo only opens with your face or fingerprint. It’s a setting, not a permission.',
    appLockOn: 'On',
    appLockDenied: 'Not turned on',
    appLockPrompt: 'Turn on the Saldo lock',
    activate: 'Turn on',
    later: 'Later',
    openSettings: 'Settings',
    openSettingsLabel: 'Open the system Settings',
  },
```

Inside `profile`, after `appLock: 'Biometric lock',` add:

```ts
    permissions: 'Permissions',
    permissionsBody:
      'What Saldo can use on this phone. Anything you denied comes back from the system Settings.',
```

- [ ] **Step 3: Run the parity test**

Run: `pnpm --filter @saldo/i18n test`
Expected: PASS (it and en have the same keys).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/src/locales/it.ts packages/i18n/src/locales/en.ts
git commit -m "feat(i18n): copy for the permissions step and Profile → Permessi"
```

---

### Task 5: Motion builders

**Files:**
- Modify: `apps/mobile/src/theme/motion.ts`

No unit test: these are Reanimated builders with no logic of their own, and their values are covered by Task 2. They are checked on the simulator in Task 12.

- [ ] **Step 1: Add the builders**

In `apps/mobile/src/theme/motion.ts`, extend the Reanimated import to:

```ts
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
```

Append at the end of the file:

```ts
const SWAP_EASE = Easing.bezier(...motion.swapEasing);

/** A row of the permissions list growing or shrinking as it opens and closes. */
export const expanding = LinearTransition.duration(motion.expandMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/** The body of the row that just opened, once the row has started to make room for it. */
export const revealing = FadeIn.duration(motion.fadeMs)
  .delay(motion.revealDelayMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/**
 * A status taking the place of the controls that produced it (better-ui swap): opacity from 0 and
 * scale from `fromScale`, never from nothing. A custom entering because Reanimated's `FadeIn`
 * animates opacity only and `ZoomIn` starts at scale 0.
 */
export function swapIn(fromScale: number, delay = 0) {
  return () => {
    'worklet';
    const config = { duration: motion.fadeMs, easing: SWAP_EASE, reduceMotion: ReduceMotion.System };
    return {
      initialValues: { opacity: 0, transform: [{ scale: fromScale }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, config), ReduceMotion.System),
        transform: [{ scale: withDelay(delay, withTiming(1, config), ReduceMotion.System) }],
      },
    };
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/theme/motion.ts
git commit -m "feat(mobile): motion builders for the permissions list"
```

---

### Task 6: OS adapters and `useSystemPermissions`

**Files:**
- Create: `apps/mobile/src/features/permissions/systemPermissions.ts`
- Create: `apps/mobile/src/features/permissions/systemPermissions.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/permissions/systemPermissions.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useSystemPermissions } from './systemPermissions';

let mockNotifications = { granted: false, canAskAgain: true };
let mockCamera = { granted: false, canAskAgain: false };

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => Promise.resolve(mockNotifications),
  requestPermissionsAsync: () => Promise.resolve(mockNotifications),
}));
jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: () => Promise.resolve(mockCamera),
  requestCameraPermissionsAsync: () => Promise.resolve(mockCamera),
}));

type ChangeHandler = (status: AppStateStatus) => void;
const handlers: ChangeHandler[] = [];

beforeEach(() => {
  mockNotifications = { granted: false, canAskAgain: true };
  mockCamera = { granted: false, canAskAgain: false };
  handlers.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    handlers.push(handler as ChangeHandler);
    return { remove: () => handlers.splice(handlers.indexOf(handler as ChangeHandler), 1) };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useSystemPermissions', () => {
  it('starts unknown, then maps what the OS reports', async () => {
    const { result } = await renderHook(() => useSystemPermissions());
    await waitFor(() => expect(result.current.states).not.toBeNull());
    expect(result.current.states).toEqual({ notifications: 'askable', camera: 'denied' });
  });

  it('reads again when the app comes back from the system settings', async () => {
    const { result } = await renderHook(() => useSystemPermissions());
    await waitFor(() => expect(result.current.states?.camera).toBe('denied'));
    mockCamera = { granted: true, canAskAgain: false };
    await act(async () => {
      for (const handler of handlers) handler('active');
    });
    await waitFor(() => expect(result.current.states?.camera).toBe('granted'));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter mobile test -- systemPermissions`
Expected: FAIL — `Cannot find module './systemPermissions'`.

- [ ] **Step 3: Implement**

Create `apps/mobile/src/features/permissions/systemPermissions.ts`:

```ts
import { type OsPermission, type PermissionState, permissionState } from '@saldo/core';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

/** The rows that are OS permissions; the app lock is a setting and is not in here. */
export type SystemPermission = 'notifications' | 'camera';
export const SYSTEM_PERMISSIONS: readonly SystemPermission[] = ['notifications', 'camera'];

const READ: Record<SystemPermission, () => Promise<OsPermission>> = {
  notifications: () => Notifications.getPermissionsAsync(),
  camera: () => ImagePicker.getCameraPermissionsAsync(),
};

const REQUEST: Record<SystemPermission, () => Promise<OsPermission>> = {
  notifications: () => Notifications.requestPermissionsAsync(),
  camera: () => ImagePicker.requestCameraPermissionsAsync(),
};

/** Shows the system prompt. Only «Attiva» calls this: iOS shows the prompt once per install. */
export async function requestSystemPermission(kind: SystemPermission): Promise<OsPermission> {
  const response = await REQUEST[kind]();
  return { granted: response.granted, canAskAgain: response.canAskAgain };
}

/** The app's page in the system settings, the only place a denied permission comes back from. */
export function openSystemSettings(): void {
  void Linking.openSettings();
}

/**
 * What the OS says about each permission, read on mount and again whenever the app returns to the
 * foreground — the way back from `openSystemSettings`. Null until the first read lands.
 */
export function useSystemPermissions(): {
  states: Record<SystemPermission, PermissionState> | null;
  refresh: () => Promise<void>;
} {
  const [states, setStates] = useState<Record<SystemPermission, PermissionState> | null>(null);

  const refresh = useCallback(async () => {
    const [notifications, camera] = await Promise.all([READ.notifications(), READ.camera()]);
    setStates({ notifications: permissionState(notifications), camera: permissionState(camera) });
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { states, refresh };
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter mobile test -- systemPermissions`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/permissions/systemPermissions.ts apps/mobile/src/features/permissions/systemPermissions.test.tsx
git commit -m "feat(mobile): read and request the system permissions"
```

---

### Task 7: `PermissionsList` (the Sequenza card)

**Files:**
- Create: `apps/mobile/src/features/permissions/PermissionsList.tsx`
- Create: `apps/mobile/src/features/permissions/PermissionsList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/permissions/PermissionsList.test.tsx`:

```tsx
import type { PermissionAnswer, PermissionKey } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PermissionsList } from './PermissionsList';

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('it', []);
});

const PENDING: Record<PermissionKey, PermissionAnswer> = {
  notifications: 'pending',
  camera: 'pending',
  appLock: 'pending',
};

function renderList(
  answers: Record<PermissionKey, PermissionAnswer>,
  handlers: Partial<{
    onActivate: (key: PermissionKey) => void;
    onLater: (key: PermissionKey) => void;
    onOpenSettings: () => void;
  }> = {},
) {
  return render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <PermissionsList
          answers={answers}
          onActivate={handlers.onActivate ?? jest.fn()}
          onLater={handlers.onLater ?? jest.fn()}
          onOpenSettings={handlers.onOpenSettings ?? jest.fn()}
        />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('PermissionsList', () => {
  it('opens only the first pending row', async () => {
    await renderList(PENDING);
    expect(screen.getByText(/budget sta per finire/)).toBeTruthy();
    expect(screen.queryByText(/fotografare uno scontrino/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Attiva' })).toHaveLength(1);
  });

  it('reports «Attiva» and «Più tardi» for the open row', async () => {
    const onActivate = jest.fn();
    const onLater = jest.fn();
    await renderList({ ...PENDING, notifications: 'later' }, { onActivate, onLater });
    await userEvent.press(screen.getByRole('button', { name: 'Attiva' }));
    expect(onActivate).toHaveBeenCalledWith('camera');
    await userEvent.press(screen.getByRole('button', { name: 'Più tardi' }));
    expect(onLater).toHaveBeenCalledWith('camera');
  });

  it('says what each answered row became', async () => {
    await renderList({ notifications: 'granted', camera: 'later', appLock: 'denied' });
    expect(screen.getByText('Attive')).toBeTruthy();
    expect(screen.getByText('Più tardi')).toBeTruthy();
    expect(screen.getByText('Non attivato')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Attiva' })).toBeNull();
  });

  it('links a denied permission to the system settings, but not the lock', async () => {
    const onOpenSettings = jest.fn();
    await renderList({ notifications: 'denied', camera: 'granted', appLock: 'denied' }, { onOpenSettings });
    const links = screen.getAllByRole('button', { name: 'Apri le Impostazioni di sistema' });
    expect(links).toHaveLength(1);
    const [link] = links;
    if (link === undefined) throw new Error('no settings link');
    await userEvent.press(link);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter mobile test -- PermissionsList`
Expected: FAIL — `Cannot find module './PermissionsList'`.

- [ ] **Step 3: Implement**

Create `apps/mobile/src/features/permissions/PermissionsList.tsx`:

```tsx
import {
  nextPending,
  PERMISSION_ORDER,
  type PermissionAnswer,
  type PermissionKey,
} from '@saldo/core';
import { type IconName, motion } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { expanding, leaving, revealing, swapIn } from '../../theme/motion';

export const PERMISSION_ICONS: Record<PermissionKey, IconName> = {
  notifications: 'bell',
  camera: 'camera',
  appLock: 'scanFace',
};

export interface PermissionsListProps {
  answers: Readonly<Record<PermissionKey, PermissionAnswer>>;
  onActivate: (key: PermissionKey) => void;
  onLater: (key: PermissionKey) => void;
  onOpenSettings: () => void;
}

/**
 * The onboarding permissions step (§6.29, variant "Sequenza"): one card, one row open at a time —
 * the first still pending — with its sentence and «Attiva» / «Più tardi». An answered row closes
 * to its title and a status, so the card always shows how many are left.
 */
export function PermissionsList({ answers, onActivate, onLater, onOpenSettings }: PermissionsListProps) {
  const theme = useTheme();
  const open = nextPending(answers);
  return (
    <Card padded={false}>
      <View style={{ paddingHorizontal: theme.layout.cardPadding }}>
        {PERMISSION_ORDER.map((key, index) => (
          <PermissionRow
            key={key}
            kind={key}
            answer={answers[key]}
            open={open === key}
            first={index === 0}
            onActivate={() => onActivate(key)}
            onLater={() => onLater(key)}
            onOpenSettings={onOpenSettings}
          />
        ))}
      </View>
    </Card>
  );
}

function PermissionRow({
  kind,
  answer,
  open,
  first,
  onActivate,
  onLater,
  onOpenSettings,
}: {
  kind: PermissionKey;
  answer: PermissionAnswer;
  open: boolean;
  first: boolean;
  onActivate: () => void;
  onLater: () => void;
  onOpenSettings: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Animated.View
      layout={expanding}
      style={{
        overflow: 'hidden',
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.palette.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 60,
          paddingVertical: 14,
        }}
      >
        <IconBox name={PERMISSION_ICONS[kind]} colour={theme.palette.textMuted} />
        <Text
          weight="medium"
          tracking="tight"
          color={open ? 'text' : 'textMuted'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {t(`permissions.${kind}Title`)}
        </Text>
        {answer === 'pending' ? null : (
          // Keyed on the answer so a change (denied → granted from the settings) swaps in again.
          <Animated.View key={answer} entering={swapIn(motion.swapFromScale)}>
            <Status kind={kind} answer={answer} onOpenSettings={onOpenSettings} />
          </Animated.View>
        )}
      </View>
      {open ? (
        <Animated.View entering={revealing} exiting={leaving} style={{ paddingStart: 44, paddingBottom: 16 }}>
          <Text size="footnote" color="textMuted" style={{ lineHeight: 18 }}>
            {t(`permissions.${kind}Body`)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
            <Pressable
              testID={`permission-${kind}-activate`}
              accessibilityRole="button"
              accessibilityLabel={t('permissions.activate')}
              hitSlop={6}
              onPress={onActivate}
              style={({ pressed }) => ({
                minHeight: 32,
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: theme.palette.accent,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" weight="medium" color="onAccent">
                {t('permissions.activate')}
              </Text>
            </Pressable>
            <Pressable
              testID={`permission-${kind}-later`}
              accessibilityRole="button"
              accessibilityLabel={t('permissions.later')}
              hitSlop={6}
              onPress={onLater}
              style={({ pressed }) => ({
                minHeight: 32,
                paddingHorizontal: 10,
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text size="footnote" weight="medium" color="textMuted">
                {t('permissions.later')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Status({
  kind,
  answer,
  onOpenSettings,
}: {
  kind: PermissionKey;
  answer: Exclude<PermissionAnswer, 'pending'>;
  onOpenSettings: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const label =
    answer === 'granted'
      ? t(`permissions.${kind}On`)
      : answer === 'denied'
        ? t(`permissions.${kind}Denied`)
        : t('permissions.later');
  const icon: IconName = answer === 'granted' ? 'check' : answer === 'denied' ? 'x' : 'clock';
  // The lock is Saldo's own setting: nothing in the system settings turns it on (Profile does).
  const settings = answer === 'denied' && kind !== 'appLock';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View entering={swapIn(motion.swapIconFromScale, motion.pressMs / 2)}>
        <Icon
          name={icon}
          size={14}
          color={answer === 'granted' ? theme.palette.positive : theme.palette.textMuted}
        />
      </Animated.View>
      <Text size="footnote" color={answer === 'granted' ? 'text' : 'textMuted'}>
        {label}
      </Text>
      {settings ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('permissions.openSettingsLabel')}
          hitSlop={10}
          onPress={onOpenSettings}
        >
          <Text size="footnote" style={{ textDecorationLine: 'underline' }}>
            {t('permissions.openSettings')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter mobile test -- PermissionsList`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/permissions/PermissionsList.tsx apps/mobile/src/features/permissions/PermissionsList.test.tsx
git commit -m "feat(mobile): the permissions list, one row open at a time"
```

---

### Task 8: Draft fields and `finishOnboarding`

**Files:**
- Modify: `apps/mobile/src/features/onboarding/state.tsx`
- Create: `apps/mobile/src/features/onboarding/finish.ts`
- Create: `apps/mobile/src/features/onboarding/finish.test.ts`

- [ ] **Step 1: Draft fields**

In `apps/mobile/src/features/onboarding/state.tsx`, add after the imports:

```ts
/** Every numbered step on either path: period, two of the path's own, balance(s), permissions. */
export const ONBOARDING_STEPS = 5;
```

In `OnboardingDraft`, after `selectedCategoryKeys: string[];` add:

```ts
  /** Import step 4: what each imported account holds now, as keypad buffers by account name. */
  importBalanceBuffers: Record<string, string>;
  /** Step 5: the biometric lock, turned on after a successful authentication. Device-only (kv). */
  appLock: boolean;
```

In `INITIAL`, after `selectedCategoryKeys: [],` add:

```ts
  importBalanceBuffers: {},
  appLock: false,
```

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/features/onboarding/finish.test.ts`:

```ts
import { mappingFor, parseCsv, planImport } from '@saldo/core';
import { createRepositories } from '../../db/repositories';
import { createTestDatabase } from '../../db/testing';
import { finishOnboarding } from './finish';
import type { OnboardingDraft } from './state';

const COMPLETED_AT = '2026-09-22T10:00:00.000Z';

const CSV = [
  'Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author',
  '2026-08-12T16:23:13+00:00,"My Money",Expense,Travel,-5.00000000,EUR,"aperitivo ",,"A Person"',
].join('\n');

const DRAFT: OnboardingDraft = {
  path: 'fresh',
  importPlan: null,
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  accountName: 'Banca',
  accountType: 'checking',
  balanceBuffer: '10.00',
  selectedCategoryKeys: ['groceries'],
  importBalanceBuffers: {},
  appLock: false,
};

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => COMPLETED_AT);
  const kv = { set: jest.fn() };
  const input = {
    translate: (key: string) => `t:${key}`,
    today: '2026-09-22',
    completedAt: COMPLETED_AT,
  } as const;
  return { db, repos, kv, input };
}

describe('finishOnboarding', () => {
  it('writes the fresh path: settings, the account and the kept categories', () => {
    const { db, repos, kv, input } = setup();
    finishOnboarding(db, repos, kv, { ...input, draft: DRAFT });
    expect(repos.settings.get()?.onboardingCompletedAt).toBe(COMPLETED_AT);
    expect(repos.accounts.list().map((account) => [account.name, account.openingBalance])).toEqual([
      ['Banca', 1000],
    ]);
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('writes the import path with the balances step 4 left in the draft', () => {
    const { db, repos, kv, input } = setup();
    const { rows } = parseCsv(CSV);
    const plan = planImport(rows.slice(1), mappingFor(rows[0] ?? [], 'spendee'), {
      currency: 'EUR',
      accounts: [],
      categories: [],
      tags: [],
      existingFingerprints: new Set(),
    });
    finishOnboarding(db, repos, kv, {
      ...input,
      draft: { ...DRAFT, path: 'import', importPlan: plan, importBalanceBuffers: { 'My Money': '20.00' } },
    });
    // The history adds up to −5,00 €; the user says 20,00 € now.
    expect(repos.accounts.list()[0]?.openingBalance).toBe(2500);
    expect(repos.transactions.list()).toHaveLength(1);
  });

  it('turns the lock on for this device when step 5 did', () => {
    const { db, repos, kv, input } = setup();
    finishOnboarding(db, repos, kv, { ...input, draft: { ...DRAFT, appLock: true } });
    expect(kv.set).toHaveBeenCalledWith('appLockEnabled', 'true');
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter mobile test -- finish`
Expected: FAIL — `Cannot find module './finish'`.

- [ ] **Step 4: Implement**

Create `apps/mobile/src/features/onboarding/finish.ts`:

```ts
import { amountBufferToMinor, getCurrency, type LocalDate } from '@saldo/core';
import type { KvStore } from '../../db/kv';
import type { Repositories } from '../../db/repositories';
import type { RepositoryDatabase } from '../../db/repositories/support';
import { seedFromOnboarding } from '../../db/seed';
import { ACCOUNT_TYPE_ICONS } from '../accounts/accountTypeIcon';
import { seedFromImport } from './importOnboarding';
import type { OnboardingDraft } from './state';

export interface FinishInput {
  draft: OnboardingDraft;
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
  today: LocalDate;
  completedAt: string;
}

/**
 * «Inizia» on step 5 (§6.29): everything the steps collected, written in one go. Nothing before
 * this writes a row. The seeders return false when a sync delivered the account's own settings
 * meanwhile, and those rows win (§8.3); the app is ready either way, so the caller goes on.
 *
 * The lock flag is device state, not account data, so it is set whatever the seeders decided.
 */
export function finishOnboarding(
  db: RepositoryDatabase,
  repos: Repositories,
  kv: Pick<KvStore, 'set'>,
  { draft, translate, today, completedAt }: FinishInput,
): void {
  const { minorDigits } = getCurrency(draft.currency);
  const settings = {
    periodKind: draft.periodKind,
    cycleStartDay: draft.cycleStartDay,
    currency: draft.currency,
    language: 'system',
    theme: 'system',
    translate,
    completedAt,
  } as const;

  if (draft.path === 'import') {
    // Step 4 of the import path cannot continue without a plan, so this only guards the type.
    if (draft.importPlan !== null) {
      seedFromImport(db, repos, {
        ...settings,
        plan: draft.importPlan,
        today,
        currentBalances: new Map(
          Object.entries(draft.importBalanceBuffers).map(([name, buffer]) => [
            name,
            amountBufferToMinor(buffer, minorDigits),
          ]),
        ),
      });
    }
  } else {
    seedFromOnboarding(repos, {
      ...settings,
      account: {
        name: draft.accountName.length > 0 ? draft.accountName : translate('firstAccount'),
        type: draft.accountType,
        openingBalance: amountBufferToMinor(draft.balanceBuffer, minorDigits),
        icon: ACCOUNT_TYPE_ICONS[draft.accountType],
      },
      selectedCategoryKeys: draft.selectedCategoryKeys,
    });
  }

  if (draft.appLock) kv.set('appLockEnabled', 'true');
}
```

Note: `translate('firstAccount')` resolves through the same `seed.*` translator as the categories, which is what `categories.tsx` did with `t('seed.firstAccount')`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter mobile test -- finish`
Expected: PASS (3 tests). The buffers are decimal strings (`amountBufferToMinor('10.00', 2) === 1000`, `packages/core/src/money.ts:82`).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/onboarding/state.tsx apps/mobile/src/features/onboarding/finish.ts apps/mobile/src/features/onboarding/finish.test.ts
git commit -m "feat(mobile): finish onboarding from one place, lock flag included"
```

---

### Task 9: Step 5 screen and the path changes

**Files:**
- Create: `apps/mobile/app/(onboarding)/permissions.tsx`
- Modify: `apps/mobile/app/(onboarding)/categories.tsx`
- Modify: `apps/mobile/app/(onboarding)/import-balances.tsx`
- Modify: `apps/mobile/app/(onboarding)/{period,cycle-day,account-details,balance,import-currency,import-file}.tsx`

- [ ] **Step 1: Step totals**

In each of `period.tsx`, `cycle-day.tsx`, `account-details.tsx`, `balance.tsx`, `import-currency.tsx`, `import-file.tsx`, `categories.tsx`, `import-balances.tsx`, replace `total: 4` with `total: ONBOARDING_STEPS`, and add `ONBOARDING_STEPS` to the existing import from `'../../src/features/onboarding/state'` (add the import where the file does not have one yet: `import { ONBOARDING_STEPS } from '../../src/features/onboarding/state';`).

- [ ] **Step 2: Categories hands over instead of finishing**

Replace `apps/mobile/app/(onboarding)/categories.tsx` with:

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { PICKABLE_SEED_CATEGORIES } from '../../src/db/seed';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.29 step 4: the 12-tile grid, all selected by default. «Inizia» is on step 5 now. */
export default function CategoriesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { setDraft } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(
    PICKABLE_SEED_CATEGORIES.map((category) => category.nameKey),
  );

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-categories-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ selectedCategoryKeys: selected });
            router.push('/permissions');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 4, total: ONBOARDING_STEPS }}
        title={t('onboarding.categoriesTitle')}
        body={t('onboarding.categoriesBody')}
      />
      <StepChunk>
        <Text size="footnote" color="textFaint">
          {t('onboarding.categoriesSelected', { count: selected.length })}
        </Text>
      </StepChunk>
      <StepChunk index={CHUNK.content + 1}>
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PICKABLE_SEED_CATEGORIES.map((category) => {
              const isSelected = selected.includes(category.nameKey);
              const colour = theme.categoryColor(category.colorIndex);
              return (
                <Pressable
                  key={category.nameKey}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={t(`seed.${category.nameKey}`)}
                  onPress={() => toggle(category.nameKey)}
                  style={{
                    width: '31%',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 12,
                    borderRadius: theme.radii.input,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.palette.borderStrong : theme.palette.border,
                    backgroundColor: isSelected ? theme.tint(colour, 0.14) : 'transparent',
                    opacity: isSelected ? 1 : 0.45,
                  }}
                >
                  <Icon name={category.icon} size={20} color={colour} />
                  <Text size="caption" numberOfLines={1}>
                    {t(`seed.${category.nameKey}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </StepChunk>
    </Screen>
  );
}
```

- [ ] **Step 3: Import balances hands over instead of finishing**

In `apps/mobile/app/(onboarding)/import-balances.tsx`:

1. Delete the imports of `amountBufferToMinor` (from the `@saldo/core` list), `db`, `useRepositories`, `seedFromImport` and `enterTabs`.
2. Change `const { draft } = useOnboarding();` to `const { draft, setDraft } = useOnboarding();`.
3. Delete `const repos = useRepositories();`, the `saving` state and the whole `finish` function.
4. Replace the `footer` prop with:

```tsx
      footer={
        <StepFooter
          testID="onboarding-import-balances-continue"
          label={t('common.continue')}
          disabled={plan === null}
          onPress={() => {
            setDraft({ importBalanceBuffers: buffers });
            router.push('/permissions');
          }}
        />
      }
```

5. Update the doc comment's last sentence to: `so «Continua» untouched keeps the file as the whole story; a different number becomes the opening balance that reaches it (§6.22), written by «Inizia» on step 5.`

- [ ] **Step 4: The step 5 screen**

Create `apps/mobile/app/(onboarding)/permissions.tsx`:

```tsx
import {
  answerFromRequest,
  answerFromUnlock,
  mergeOsState,
  type PermissionAnswer,
  type PermissionKey,
  todayLocal,
} from '@saldo/core';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { finishOnboarding } from '../../src/features/onboarding/finish';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { PermissionsList } from '../../src/features/permissions/PermissionsList';
import {
  openSystemSettings,
  requestSystemPermission,
  SYSTEM_PERMISSIONS,
  useSystemPermissions,
} from '../../src/features/permissions/systemPermissions';
import { enterTabs } from '../../src/navigation/history';
import { Text } from '../../src/theme/Text';

/**
 * §6.29 step 5, on both paths: notifications, camera and the app lock, one at a time. Our sentence
 * comes first and the system prompt only on «Attiva», because iOS shows it once per install and
 * the in-context requests rely on it for everyone who chose «Più tardi». «Inizia» writes
 * everything the steps collected.
 */
export default function PermissionsStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { repos, kv } = useDatabase();
  const { draft, setDraft } = useOnboarding();
  const system = useSystemPermissions();
  const [answers, setAnswers] = useState<Record<PermissionKey, PermissionAnswer>>({
    notifications: 'pending',
    camera: 'pending',
    appLock: draft.appLock ? 'granted' : 'pending',
  });
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  // What the OS already decided fills the rows, and a return from the settings may upgrade them.
  useEffect(() => {
    const states = system.states;
    if (states === null) return;
    setAnswers((current) => {
      let next = current;
      for (const kind of SYSTEM_PERMISSIONS) {
        const merged = mergeOsState(current[kind], states[kind]);
        if (merged !== current[kind]) next = { ...next, [kind]: merged };
      }
      return next;
    });
  }, [system.states]);

  const answer = (kind: PermissionKey, value: PermissionAnswer) =>
    setAnswers((current) => ({ ...current, [kind]: value }));

  const activate = async (kind: PermissionKey) => {
    if (asking) return;
    setAsking(true);
    try {
      if (kind === 'appLock') {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('permissions.appLockPrompt'),
          // As on the lock screen: the passcode keeps the app reachable without biometrics.
          disableDeviceFallback: false,
        });
        const value = answerFromUnlock(result);
        answer('appLock', value);
        if (value === 'granted') setDraft({ appLock: true });
      } else {
        answer(kind, answerFromRequest(await requestSystemPermission(kind)));
      }
    } finally {
      setAsking(false);
    }
  };

  const finish = () => {
    setSaving(true);
    finishOnboarding(db, repos, kv, {
      draft,
      translate: (key) => t(`seed.${key}`),
      today: todayLocal(),
      completedAt: new Date().toISOString(),
    });
    enterTabs(router);
  };

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-start"
          label={t('common.start')}
          loading={saving}
          onPress={finish}
        />
      }
    >
      <StepHeader
        step={{ current: 5, total: ONBOARDING_STEPS }}
        title={t('onboarding.permissionsTitle')}
        body={t('onboarding.permissionsBody')}
      />
      {/* Nothing until the first OS read: a granted row must not open for a frame first. */}
      {system.states === null ? null : (
        <>
          <StepChunk>
            <PermissionsList
              answers={answers}
              onActivate={(kind) => {
                void activate(kind);
              }}
              onLater={(kind) => answer(kind, 'later')}
              onOpenSettings={openSystemSettings}
            />
          </StepChunk>
          <StepChunk index={CHUNK.content + 1}>
            <Text size="caption" color="textFaint" style={{ marginTop: 12 }}>
              {t('onboarding.permissionsNote')}
            </Text>
          </StepChunk>
        </>
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Regenerate the typed routes and typecheck**

`typedRoutes` is on (`app.config.ts`), so `/permissions` and `/profile/permissions` (Task 10) only type once the route types are regenerated. From `apps/mobile`, start Metro (`npx expo start`), wait until it is ready, then stop it: that rewrites `.expo/types/router.d.ts`.

Run: `pnpm --filter mobile typecheck`
Expected: no errors.

- [ ] **Step 6: Run the mobile tests**

Run: `rtk proxy pnpm --filter mobile test`
Expected: every suite passes.

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/(onboarding)"
git commit -m "feat(mobile): step 5 of onboarding asks for the permissions"
```

---

### Task 10: Profile → Permessi

**Files:**
- Create: `apps/mobile/app/profile/permissions.tsx`
- Modify: `apps/mobile/app/profile.tsx` (before the `profile.appLock` row)

- [ ] **Step 1: The screen**

Create `apps/mobile/app/profile/permissions.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { PERMISSION_ICONS } from '../../src/features/permissions/PermissionsList';
import {
  openSystemSettings,
  requestSystemPermission,
  SYSTEM_PERMISSIONS,
  useSystemPermissions,
} from '../../src/features/permissions/systemPermissions';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * Profile → Permessi (§6.29): what onboarding's step 5 asked, afterwards. A permission never asked
 * is asked from here; a denied one can only come back from the system settings, so its row goes
 * there. The biometric lock is not here: it is the Profile's own toggle.
 */
export default function PermissionsSetting() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { states, refresh } = useSystemPermissions();

  return (
    <SettingScreen title={t('profile.permissions')} subtitle={t('profile.permissionsBody')}>
      {SYSTEM_PERMISSIONS.map((kind) => {
        const state = states?.[kind] ?? null;
        const trailing =
          state === null ? null : (
            <Text color={state === 'askable' ? 'text' : 'textMuted'}>
              {state === 'granted'
                ? t(`permissions.${kind}On`)
                : state === 'denied'
                  ? t(`permissions.${kind}Denied`)
                  : t('permissions.activate')}
            </Text>
          );
        const onPress =
          state === 'denied'
            ? openSystemSettings
            : state === 'askable'
              ? () => {
                  void requestSystemPermission(kind).then(refresh);
                }
              : undefined;
        return (
          <ListRow
            key={kind}
            testID={`profile-permission-${kind}`}
            title={t(`permissions.${kind}Title`)}
            subtitle={t(`permissions.${kind}Body`)}
            subtitleLines={2}
            leading={<IconBox name={PERMISSION_ICONS[kind]} colour={theme.palette.textMuted} small />}
            trailing={trailing}
            onPress={onPress}
            chevron={state === 'denied'}
          />
        );
      })}
    </SettingScreen>
  );
}
```

- [ ] **Step 2: The Profile row**

In `apps/mobile/app/profile.tsx`, immediately before `<ListRow title={t('profile.appLock')}`, add:

```tsx
          <ListRow
            title={t('profile.permissions')}
            leading={lead('bell')}
            onPress={() => router.push('/profile/permissions')}
            chevron
          />
```

- [ ] **Step 3: Typecheck and tests**

Run: `pnpm --filter mobile typecheck && rtk proxy pnpm --filter mobile test`
Expected: no type errors; every suite passes. (If `/profile/permissions` does not type, regenerate the route types as in Task 9 Step 5.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/profile/permissions.tsx apps/mobile/app/profile.tsx
git commit -m "feat(mobile): Profile → Permessi"
```

---

### Task 11: Maestro, spec, TODO, harness

**Files:**
- Modify: `apps/mobile/maestro/onboarding-and-first-expense.yaml`
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (§6.29 row, line 602)
- Modify: `TODO.md`
- Delete: `docs/superpowers/mockups/2026-09-22-onboarding-permissions-variants.html`

- [ ] **Step 1: Maestro**

In the flow, rename every `Step n of 4` comment to `Step n of 5`. Replace the block that starts `# Step 4 of 4 — the category grid` and ends at `id: "onboarding-start"` with:

```yaml
# Step 4 of 5 — the category grid, every tile selected by default.
- tapOn:
    id: "onboarding-categories-continue"

# Step 5 of 5 — the permissions, one row open at a time. «Più tardi» on each: the flow must not
# depend on a system prompt it cannot answer. "Inizia" writes settings, the account and the
# categories, then replaces the route with the tabs.
- tapOn:
    id: "permission-notifications-later"
- tapOn:
    id: "permission-camera-later"
- tapOn:
    id: "permission-appLock-later"
- tapOn:
    id: "onboarding-start"
```

Note: on a simulator whose notifications or camera were already decided, those rows start closed and their «Più tardi» is not there. The flow runs on a fresh install, so they are pending.

- [ ] **Step 2: Spec §6.29**

In the §6.29 row of `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`:

- Replace `*Da zero* is **four steps**:` with `*Da zero* is **five steps**:`.
- Replace `, 4 categories. Steps 2 and 3` with `, 4 categories, 5 **permissions** (below). Steps 2 and 3`.
- Replace `The **import path** is four steps too:` with `The **import path** is five steps too:`.
- Replace `each starting at what its imported history adds up to. It has no category grid` with `each starting at what its imported history adds up to, 5 **permissions**. It has no category grid`.
- After `Progress bar 2px.` insert: ` Step 5, **permissions**, is the same on both paths: notifications (budget alerts, §5.8), camera (attachments, §10) and the biometric app lock (§6.32), one row open at a time with a sentence, «Attiva» and «Più tardi». The system prompt is called only from «Attiva», so the one prompt iOS allows is never spent before the user has read why; a permission the OS already decided shows its state instead of asking, and a denied one links to the system settings. «Più tardi» leaves the in-context request as it was (§5.8, §10). «Inizia» is on this step. Profile → **Permessi** shows and changes notifications and camera afterwards.`
- Replace `"Inizia" writes settings + account + categories.` with `"Inizia" (step 5) writes settings + account + categories, and the lock flag when step 5 turned it on.`

- [ ] **Step 3: TODO**

In `TODO.md`, delete the whole `### Onboarding: a step for the system permissions` section (heading, the checkbox item, the three bullets and the "Open points" paragraph).

- [ ] **Step 4: Delete the harness**

```bash
git rm docs/superpowers/mockups/2026-09-22-onboarding-permissions-variants.html
```

(If it was never committed: `rm docs/superpowers/mockups/2026-09-22-onboarding-permissions-variants.html`.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/maestro/onboarding-and-first-expense.yaml docs/superpowers/specs/2026-09-10-saldo-poc-spec.md TODO.md docs/superpowers/plans/2026-09-22-onboarding-permissions.md
git commit -m "docs: §6.29 step 5, permissions; the TODO item leaves the list"
```

---

### Task 12: Verification

- [ ] **Step 1: Gates**

Run from the repository root, through `rtk proxy` so the output is not filtered:

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines and no `× Some errors were emitted`; typecheck clean; every package's tests pass.

- [ ] **Step 2: Simulator — fresh path**

Wipe the simulator's app data or start from "Elimina tutti i dati" → onboarding. Walk *Da zero* to step 4: the segments say 4 of 5, «Continua» leads to step 5. On step 5:

- The notifications row is open. «Attiva» shows the iOS prompt (Italian copy); «Consenti» → the row closes with «✓ Attive» and the camera row opens (row growth 300ms, body fading in after it).
- Camera «Non consentire» → «Non consentita · Impostazioni»; the link opens the Settings app; switch the camera on there, come back: the row reads «Attiva».
- Lock «Attiva» → Face ID (or passcode) → «Attivo». «Inizia» → tabs. Kill and relaunch the app: the lock screen appears.
- Settings → Accessibility → Reduce Motion on: the rows change with no growth or scale, only the instant state change.

- [ ] **Step 3: Simulator — import path and Profile**

Walk the import path with the sample CSV to step 5 (5 of 5); «Più tardi» ×3, «Inizia» → the imported accounts show the balances entered on step 4. Profile → Permessi lists both permissions with their state; an «Attiva» row prompts, a denied row opens Settings.

- [ ] **Step 4: Review**

Use **requesting-code-review** on the branch. Then tick this plan's checkboxes and merge `feat/onboarding-permissions` into `main` when accepted.
