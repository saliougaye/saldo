# A first run with no server (local-only), sign-in later — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saldo starts on a phone with no server at all, and the server — when there is one — is an address the user types, not a build input; signing in later adopts or discards what the phone already holds.

**Architecture:** The boot router treats "signed out, with settings on the phone" as a working local-only app instead of a reason to show the welcome. The server address moves from `SALDO_SERVER_URL` (build time) to `kv.serverUrl` (written by a successful sign-in, removed by «Esci»), so `ServerProvider` builds its auth and API clients from state. One shared `ServerSignIn` hook + views (a URL form that swaps in place into a server row, then passkey buttons) serve both the new onboarding screen `/server` and Profile → Server. `ownershipVerdict` gains `unowned-data`, answered by a three-button dialog.

**Tech Stack:** Expo Router, React Native, Reanimated (`swapIn`), Better Auth Expo client, Drizzle/SQLite `kv`, i18next (7 catalogs), Jest (`db` + `app` projects), Vitest (`@saldo/i18n`, `@saldo/ui`).

**Roadmap item:** `ROADMAP.md` → «A first run with no server (local-only), sign-in later».

---

## Decisions (recorded here because the spec is being changed by this plan)

Taken with the user on 2026-09-25 from the variants harness (`.variants/server-url.html`, round 2):

1. **UI: «Due passi».** Welcome = two equal doors in one card (`Solo su questo telefono` / `Con il tuo server Saldo`).
   The server door opens **one** screen, «Il tuo server Saldo»: the address field; after «Continua» the card swaps
   in place into a **server row** (server icon, host, status line, «Cambia») and the passkey buttons appear below.
2. **Failures reuse the server row.** Status line with a **hollow grey ring** instead of the filled green dot, and
   words: «Non raggiungibile» → primary «Riprova» (same address; a second failure adds «Ancora nessuna risposta.»);
   «Non è un server Saldo» → primary «Cambia indirizzo». **No red:** `packages/ui/src/tokens.ts:6-10` keeps
   `positive` the only chromatic signal, and the ring differs from the dot by shape as well as colour.
3. **`SALDO_SERVER_URL` is removed**, not kept as a prefill. The address is typed (Immich-style). This reverses
   phase 08b; nothing about passkeys requires a fixed address, because sign-in runs in the system browser (D13) —
   the server only has to list the app's scheme in `APP_REDIRECT_SCHEMES`.
4. **«Indietro» on «Come vuoi iniziare?»** when it was reached from the phone door (signed out: nothing is saved
   yet). After a sign-in there is still no back — going back would mean leaving the account.
5. **«Esci» now leaves a working local-only app** (data stays, sync stops) instead of returning to the welcome.
   `kv.serverUrl` is removed; `kv.lastServerUrl` stays, only to prefill the field next time.
6. **Sign-in with local rows and no recorded account** (`kv.accountId` null) asks: «Porta nell’account» (keep and
   push them — they merge with whatever the account already holds), «Cancella e usa il server» (wipe, then pull),
   or «Annulla» (sign straight back out). Before this plan that case was silently `keep`.

Spec silent → followed the harness: the server screen's title does not change between states (it names the
subject, not the outcome), the hint under the field previews the origin («Mi collego a https://…»).

## File structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/src/boot/decide.ts` (modify) | Signed out + settings on the phone → tabs / onboarding, not welcome |
| `apps/mobile/src/auth/deviceOwner.ts` (modify) | `unowned-data` verdict |
| `apps/mobile/src/auth/serverKeys.ts` (create) | The two `kv` keys for the address |
| `apps/mobile/src/auth/ServerProvider.tsx` (modify) | Address from `kv`, `connect(serverUrl, mode, questions)`, «Esci» forgets the address |
| `apps/mobile/src/auth/buildServer.ts`, `serverConfig.ts(+test)`, `app.config.ts` (modify) | Drop `SALDO_SERVER_URL` / `readServerUrl` |
| `apps/mobile/src/features/server/serverProbe.ts(+test)` (create) | Pure: address hint, probe state machine, error → reason |
| `apps/mobile/src/features/server/describeServerError.ts` (create) | One `CODE_KEYS` table instead of two |
| `apps/mobile/src/features/server/useServerSignIn.ts` (create) | Hook: address, probe, sign-in, the two ownership questions |
| `apps/mobile/src/features/server/ServerSignIn.tsx(+test)` (create) | Views: `ServerAddressCard`, `ServerRow`, `ServerActions`, `ServerSignInDialogs` |
| `apps/mobile/src/features/server/ConnectForm.tsx` (delete) | Replaced by the above |
| `apps/mobile/src/components/ConfirmDialog.tsx(+test)` (modify) | Optional third button |
| `apps/mobile/src/features/onboarding/StepFooter.tsx` (modify) | `label` optional → back-only footer |
| `apps/mobile/app/(onboarding)/welcome.tsx`, `server.tsx` (create), `start.tsx` (modify) | The two doors, the server step, back on the chooser |
| `apps/mobile/app/profile/server.tsx`, `app/profile.tsx` (modify) | Sign-in later from Profile; «Esci» stays in the app |
| `packages/ui/src/icons.ts(+test)` (modify) | `server` icon |
| `packages/i18n/src/locales/*.ts` (7 files) | New `server` section, welcome copy, unowned dialog; dead keys removed |
| `apps/mobile/scripts/build-{apk,ipa}.sh`, `docs/*`, `README.md`, spec, `ROADMAP.md`, maestro flow | No server at build time |

Run everything from the worktree root `.worktrees/local-first` unless a step says otherwise. Mobile jest subsets:
`cd apps/mobile && npx jest --selectProjects db --testPathPatterns "<pattern>"` (or `app`). The package name is
`mobile` (`pnpm --filter mobile typecheck`).

---

### Task 1: Boot — a signed-out phone with settings is a local-only app

**Files:**
- Modify: `apps/mobile/src/boot/decide.ts`
- Test: `apps/mobile/src/boot/decide.test.ts`

- [x] **Step 1: Write the failing tests**

In `decide.test.ts`, replace the test `'sends a signed-out device to the welcome screen'` with:

```ts
  describe('a signed-out device', () => {
    const signedOut = (overrides: Partial<BootInput> = {}) =>
      decideBoot(input({ session: 'signed-out', hasScheduler: false, ...overrides }));

    it('shows the welcome when the phone holds nothing yet', () => {
      expect(signedOut({ hasSettings: false, onboardingCompletedAt: null })).toEqual({
        kind: 'welcome',
      });
    });

    it('opens the app on its own data when onboarding was finished here', () => {
      // Started on the phone (§6.29 step 0), or signed out with «Esci» (§6.30): local-only.
      expect(signedOut()).toEqual({ kind: 'tabs' });
    });

    it('resumes an onboarding that was never finished, without a server to ask', () => {
      expect(signedOut({ onboardingCompletedAt: null })).toEqual({ kind: 'onboarding' });
    });

    it('never waits for a sync nobody is signed in to run', () => {
      expect(signedOut({ syncStatus: SYNCING })).toEqual({ kind: 'tabs' });
    });
  });
```

- [x] **Step 2: Run to see them fail**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "boot/decide"`
Expected: FAIL — `opens the app on its own data…` receives `{ kind: 'welcome' }`.

- [x] **Step 3: Implement**

In `decide.ts`, change the doc comment of `'welcome'` and the signed-out branch:

```ts
  /** §6.29 step 0: signed out and nothing on the phone, so the user picks a door. */
  | { kind: 'welcome' }
```

```ts
  if (input.locked) return { kind: 'lock' };
  if (input.session === 'loading' || !input.settingsLoaded) return { kind: 'loading' };
  if (input.session === 'signed-out') {
    // Local-only (§1.1 goal 2): the phone started without a server, or «Esci» left it on its own
    // data (§6.30). Its settings row is the evidence; with none there is nothing to open yet.
    if (!input.hasSettings) return { kind: 'welcome' };
    return completed(input) ? { kind: 'tabs' } : { kind: 'onboarding' };
  }
```

and replace the last statement of `decideBoot` with `return completed(input) ? { kind: 'tabs' } : { kind: 'onboarding' };`,
adding above `decideBoot`:

```ts
function completed(input: BootInput): boolean {
  return input.onboardingCompletedAt !== null && input.onboardingCompletedAt !== undefined;
}
```

Update the `hasScheduler` doc comment in `BootInput` to: `/** False while signed out or before an address is stored: no sync to wait for. */`

- [x] **Step 4: Run to see them pass**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "boot/decide"`
Expected: PASS (all tests in the file).

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/boot/decide.ts apps/mobile/src/boot/decide.test.ts
git commit -m "feat(mobile): a signed-out phone with settings opens on its own data"
```

---

### Task 2: Ownership — local rows that belong to no account

**Files:**
- Modify: `apps/mobile/src/auth/deviceOwner.ts`
- Test: `apps/mobile/src/auth/deviceOwner.test.ts`

- [x] **Step 1: Write the failing test**

Replace the test `'adopts an install that has never recorded an account'` with:

```ts
  it('asks about rows that belong to no account yet', () => {
    // A phone started without a server (§6.29 step 0), and every install that predates this
    // check: the rows are nobody else's, but whether they join this account is the user's call.
    expect(ownershipVerdict(null, 'ada', true)).toBe('unowned-data');
  });

  it('adopts a fresh install silently: there is nothing to decide', () => {
    expect(ownershipVerdict(null, 'ada', false)).toBe('keep');
  });
```

- [x] **Step 2: Run to see it fail**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "deviceOwner"`
Expected: FAIL — received `"keep"`, expected `"unowned-data"`.

- [x] **Step 3: Implement**

```ts
export type OwnershipVerdict =
  /** Same account as last time, or nothing to lose: sign in and keep what is here. */
  | 'keep'
  /** Somebody else's rows are on this phone: they have to go before the new account syncs. */
  | 'foreign-data'
  /**
   * Rows written before any account signed in on this phone (local-only, §6.29 step 0). They can
   * join the account — pushed, merged with what it holds — or be deleted for the server's copy.
   */
  | 'unowned-data';
```

Replace the paragraph of the doc comment that starts with `` `storedAccountId` is null `` with:

```ts
 * `storedAccountId` is null on a fresh install, on a phone that started local-only, and on any
 * install that predates this check. None of that is evidence the rows belong to somebody else, so
 * they are not treated as foreign — but pushing them into an account is not a given either, so
 * the user is asked (`unowned-data`).
```

and the body:

```ts
  if (!hasLocalData) return 'keep';
  if (storedAccountId === null) return 'unowned-data';
  return storedAccountId === incomingAccountId ? 'keep' : 'foreign-data';
```

- [x] **Step 4: Run to see it pass**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "deviceOwner"`
Expected: PASS. (`pnpm --filter mobile typecheck` will fail until Task 6 handles the new case in `ServerProvider`; that is expected.)

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/auth/deviceOwner.ts apps/mobile/src/auth/deviceOwner.test.ts
git commit -m "feat(mobile): name the case of local rows that belong to no account"
```

---

### Task 3: The probe, as pure functions

**Files:**
- Create: `apps/mobile/src/features/server/serverProbe.ts`
- Test: `apps/mobile/src/features/server/serverProbe.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { ApiClientError } from '../../net/apiClient';
import { addressHint, failureReason, initialProbe, probeReducer } from './serverProbe';

const HEALTH = {
  app: 'saldo' as const,
  apiVersion: 1,
  schemaVersion: 12,
  version: '0.3.1',
  registrationAllowed: true,
  attachmentsEnabled: false,
};

describe('addressHint', () => {
  it('shows the example while the field is empty', () => {
    expect(addressHint('')).toEqual({ kind: 'idle' });
    expect(addressHint('   ')).toEqual({ kind: 'idle' });
  });

  it('previews the origin it will connect to', () => {
    expect(addressHint('saldo.example.org')).toEqual({
      kind: 'will-connect',
      origin: 'https://saldo.example.org',
    });
  });

  it('asks for only the address when there is a path', () => {
    expect(addressHint('saldo.example.org/login')).toEqual({ kind: 'invalid' });
  });
});

describe('failureReason', () => {
  it('tells "not Saldo" apart from everything else', () => {
    expect(failureReason(new ApiClientError(502, 'not_saldo', 'x'))).toBe('not_saldo');
    expect(failureReason(new ApiClientError(503, 'unreachable', 'x'))).toBe('unreachable');
    expect(failureReason(new Error('boom'))).toBe('unreachable');
  });
});

describe('probeReducer', () => {
  const origin = 'https://saldo.example.org';

  it('goes from editing to checking to found', () => {
    const checking = probeReducer(initialProbe, { type: 'submit', origin });
    expect(checking).toEqual({ kind: 'checking', origin, attempts: 0 });
    expect(probeReducer(checking, { type: 'answered', health: HEALTH })).toEqual({
      kind: 'found',
      origin,
      health: HEALTH,
    });
  });

  it('keeps the address and counts attempts across retries', () => {
    const failed = probeReducer(
      { kind: 'checking', origin, attempts: 0 },
      { type: 'failed', reason: 'unreachable' },
    );
    expect(failed).toEqual({ kind: 'failed', origin, reason: 'unreachable', attempts: 1 });
    const retrying = probeReducer(failed, { type: 'retry' });
    expect(retrying).toEqual({ kind: 'checking', origin, attempts: 1 });
    expect(probeReducer(retrying, { type: 'failed', reason: 'unreachable' })).toEqual({
      kind: 'failed',
      origin,
      reason: 'unreachable',
      attempts: 2,
    });
  });

  it('goes back to the field on «Cambia», from any state', () => {
    expect(probeReducer({ kind: 'found', origin, health: HEALTH }, { type: 'change' })).toEqual(
      initialProbe,
    );
    expect(
      probeReducer({ kind: 'failed', origin, reason: 'not_saldo', attempts: 1 }, { type: 'change' }),
    ).toEqual(initialProbe);
  });

  it('ignores an answer that arrives after «Cambia»', () => {
    expect(probeReducer(initialProbe, { type: 'answered', health: HEALTH })).toEqual(initialProbe);
    expect(probeReducer(initialProbe, { type: 'failed', reason: 'unreachable' })).toEqual(
      initialProbe,
    );
  });

  it('only retries a failure', () => {
    expect(probeReducer(initialProbe, { type: 'retry' })).toEqual(initialProbe);
  });
});
```

- [x] **Step 2: Run to see them fail**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "server/serverProbe"`
Expected: FAIL — `Cannot find module './serverProbe'`.

- [x] **Step 3: Implement**

```ts
import { normaliseServerUrl } from '../../auth/link';
import type { ServerHealth } from '../../auth/session';
import { ApiClientError } from '../../net/apiClient';

/**
 * The server step of §6.29 (and §6.30), as data. Kept pure so the order of events — an answer
 * landing after «Cambia», a second failure on «Riprova» — is decided here and tested, not in a
 * component.
 */

/** What the line under the address field says while the user types. */
export type AddressHint =
  | { kind: 'idle' }
  | { kind: 'will-connect'; origin: string }
  | { kind: 'invalid' };

export function addressHint(input: string): AddressHint {
  if (input.trim().length === 0) return { kind: 'idle' };
  const origin = normaliseServerUrl(input);
  return origin === null ? { kind: 'invalid' } : { kind: 'will-connect', origin };
}

export type FailureReason = 'unreachable' | 'not_saldo';

/** `checkServer` throws `not_saldo` for an answer that is not Saldo's; anything else is "no answer". */
export function failureReason(caught: unknown): FailureReason {
  return caught instanceof ApiClientError && caught.code === 'not_saldo' ? 'not_saldo' : 'unreachable';
}

export type ProbeState =
  | { kind: 'editing' }
  | { kind: 'checking'; origin: string; attempts: number }
  | { kind: 'found'; origin: string; health: ServerHealth }
  | { kind: 'failed'; origin: string; reason: FailureReason; attempts: number };

export type ProbeEvent =
  | { type: 'submit'; origin: string }
  | { type: 'answered'; health: ServerHealth }
  | { type: 'failed'; reason: FailureReason }
  | { type: 'retry' }
  | { type: 'change' };

export const initialProbe: ProbeState = { kind: 'editing' };

export function probeReducer(state: ProbeState, event: ProbeEvent): ProbeState {
  switch (event.type) {
    case 'submit':
      return { kind: 'checking', origin: event.origin, attempts: 0 };
    case 'answered':
      return state.kind === 'checking'
        ? { kind: 'found', origin: state.origin, health: event.health }
        : state;
    case 'failed':
      return state.kind === 'checking'
        ? { kind: 'failed', origin: state.origin, reason: event.reason, attempts: state.attempts + 1 }
        : state;
    case 'retry':
      return state.kind === 'failed'
        ? { kind: 'checking', origin: state.origin, attempts: state.attempts }
        : state;
    case 'change':
      return initialProbe;
  }
}
```

- [x] **Step 4: Run to see them pass**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "server/serverProbe"`
Expected: PASS. If the `db` project cannot import `../../auth/session` (it imports `expo-crypto` and
`expo-web-browser`), the `import type` is erased by Babel and it will not be loaded — if Jest still reports it, move
`healthSchema`/`ServerHealth` into a new `apps/mobile/src/auth/health.ts` (no Expo imports), re-export them from
`session.ts`, and import the type from `health.ts` here.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/features/server/serverProbe.ts apps/mobile/src/features/server/serverProbe.test.ts
git commit -m "feat(mobile): the server probe as a pure state machine"
```

---

### Task 4: `server` icon

**Files:**
- Modify: `packages/ui/src/icons.ts` (inside `iconMarkup`, after `merge`)
- Test: `packages/ui/src/icons.test.ts:33`

- [x] **Step 1: Update the failing test**

In `icons.test.ts` change `expect(ICON_NAMES).toHaveLength(139);` to `140` and add
`expect(ICON_NAMES).toContain('server');` below the `merge` line.

- [x] **Step 2: Run to see it fail**

Run: `pnpm --filter @saldo/ui test`
Expected: FAIL — length 139, expected 140.

- [x] **Step 3: Implement**

```ts
  // Lucide 1.47.0 `server`, with its dots as paths (the parser ignores <line>): the server door of
  // the welcome and the server row of §6.29 / §6.30 (2026-09-25 local-first plan).
  server:
    '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
```

- [x] **Step 4: Run to see it pass**

Run: `pnpm --filter @saldo/ui test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ui/src/icons.ts packages/ui/src/icons.test.ts
git commit -m "feat(ui): server icon"
```

---

### Task 5: Copy in all seven catalogs

**Files:** `packages/i18n/src/locales/{it,en,de,es,fr,pt,sv}.ts`
Test: `packages/i18n/src/locales.test.ts` (existing parity test: every catalog must have `it`'s key structure).

- [x] **Step 1: Confirm the dead keys really are dead**

Run: `git grep -n "welcomeOffline\|noServerConfigured\|sync.verifying\|sync.serverFound\|sync.serverIs" -- apps`
Expected: hits only in `apps/mobile/src/features/server/ConnectForm.tsx`, `app/(onboarding)/welcome.tsx`
and `app/profile/server.tsx` (`serverIs`). `serverIs` **stays** (Profile keeps using it). The other four go.

- [x] **Step 2: Edit `it.ts` (the source)**

In `onboarding`: replace `welcomeBody` and `welcomeOffline` with:

```ts
    welcomeBody: 'Tieni le spese periodo per periodo. Scegli dove vivono i tuoi dati: puoi cambiare idea dopo.',
    welcomePhone: 'Solo su questo telefono',
    welcomePhoneHint: 'Nessun account, niente da configurare.',
    welcomeServer: 'Con il tuo server Saldo',
    welcomeServerHint: 'Sincronizza più dispositivi. Ti serve il suo indirizzo.',
    welcomeLater:
      'Se inizi solo su questo telefono, potrai collegare un server dal Profilo senza perdere nulla.',
```

In `sync`: delete `verifying`, `noServerConfigured`, `serverFound`; add after `foreignDeviceData`:

```ts
    unownedTitle: 'Dati su questo telefono',
    unownedBody:
      'Questi dati non sono ancora in nessun account. Puoi portarli in questo, insieme a quello che contiene già, oppure cancellarli e usare solo quelli del server.',
    unownedAdopt: 'Porta nell’account',
    unownedDiscard: 'Cancella e usa il server',
```

Add a new top-level section `server` right after `sync`:

```ts
  server: {
    title: 'Il tuo server Saldo',
    body: 'L’indirizzo con cui apri Saldo nel browser, poi entri con una passkey. Te l’ha dato chi gestisce il server, se non sei tu.',
    address: 'Indirizzo del server',
    placeholder: 'saldo.esempio.it',
    hintIdle: 'Per esempio saldo.esempio.it',
    hintConnect: 'Mi collego a {{origin}}',
    hintInvalid: 'Scrivi solo l’indirizzo, per esempio saldo.esempio.it',
    checking: 'Controllo il server…',
    version: 'Saldo {{version}}',
    unreachable: 'Non raggiungibile',
    notSaldo: 'Non è un server Saldo',
    change: 'Cambia',
    changeServer: 'Cambia server',
    changeAddress: 'Cambia indirizzo',
    retry: 'Riprova',
    stillNothing: 'Ancora nessuna risposta.',
    helpUnreachable:
      'Controlla di essere in rete e che il server sia acceso. Se lo gestisce qualcun altro, chiediglielo.',
    helpNotSaldo: 'Serve l’indirizzo con cui apri Saldo nel browser, per esempio saldo.esempio.it.',
  },
```

- [x] **Step 3: Same keys in the other six catalogs**

Delete the same five keys (`onboarding.welcomeOffline`, `sync.verifying`, `sync.noServerConfigured`, `sync.serverFound`
and replace `onboarding.welcomeBody`) and add the same structure. Values:

`en.ts`
```ts
    welcomeBody: 'Track spending period by period. Choose where your data lives: you can change your mind later.',
    welcomePhone: 'Only on this phone',
    welcomePhoneHint: 'No account, nothing to set up.',
    welcomeServer: 'With your Saldo server',
    welcomeServerHint: 'Syncs several devices. You need its address.',
    welcomeLater: 'If you start on this phone only, you can connect a server from Profile later without losing anything.',
    // sync
    unownedTitle: 'Data on this phone',
    unownedBody: 'This data is not in any account yet. You can bring it into this one, together with what it already holds, or delete it and use only the server’s.',
    unownedAdopt: 'Bring into the account',
    unownedDiscard: 'Delete and use the server',
  server: {
    title: 'Your Saldo server',
    body: 'The address you open Saldo at in a browser, then you sign in with a passkey. Whoever runs the server gave it to you, if that is not you.',
    address: 'Server address',
    placeholder: 'saldo.example.com',
    hintIdle: 'For example saldo.example.com',
    hintConnect: 'Connecting to {{origin}}',
    hintInvalid: 'Type just the address, for example saldo.example.com',
    checking: 'Checking the server…',
    version: 'Saldo {{version}}',
    unreachable: 'Not reachable',
    notSaldo: 'Not a Saldo server',
    change: 'Change',
    changeServer: 'Change server',
    changeAddress: 'Change address',
    retry: 'Try again',
    stillNothing: 'Still no answer.',
    helpUnreachable: 'Check that you are online and the server is running. If someone else runs it, ask them.',
    helpNotSaldo: 'You need the address you open Saldo at in a browser, for example saldo.example.com.',
  },
```

`de.ts`
```ts
    welcomeBody: 'Behalte deine Ausgaben Zeitraum für Zeitraum im Blick. Wähle, wo deine Daten liegen – du kannst es später ändern.',
    welcomePhone: 'Nur auf diesem Telefon',
    welcomePhoneHint: 'Kein Konto, nichts einzurichten.',
    welcomeServer: 'Mit deinem Saldo-Server',
    welcomeServerHint: 'Synchronisiert mehrere Geräte. Du brauchst seine Adresse.',
    welcomeLater: 'Wenn du nur auf diesem Telefon beginnst, kannst du später im Profil einen Server verbinden, ohne etwas zu verlieren.',
    unownedTitle: 'Daten auf diesem Telefon',
    unownedBody: 'Diese Daten gehören noch zu keinem Konto. Du kannst sie in dieses übernehmen, zusammen mit dem, was es schon enthält, oder sie löschen und nur die des Servers verwenden.',
    unownedAdopt: 'Ins Konto übernehmen',
    unownedDiscard: 'Löschen, Server verwenden',
  server: {
    title: 'Dein Saldo-Server',
    body: 'Die Adresse, unter der du Saldo im Browser öffnest; danach meldest du dich mit einem Passkey an. Wer den Server betreibt, hat sie dir gegeben, falls nicht du selbst.',
    address: 'Serveradresse',
    placeholder: 'saldo.beispiel.de',
    hintIdle: 'Zum Beispiel saldo.beispiel.de',
    hintConnect: 'Verbinde mit {{origin}}',
    hintInvalid: 'Gib nur die Adresse ein, zum Beispiel saldo.beispiel.de',
    checking: 'Prüfe den Server…',
    version: 'Saldo {{version}}',
    unreachable: 'Nicht erreichbar',
    notSaldo: 'Kein Saldo-Server',
    change: 'Ändern',
    changeServer: 'Server ändern',
    changeAddress: 'Adresse ändern',
    retry: 'Erneut versuchen',
    stillNothing: 'Immer noch keine Antwort.',
    helpUnreachable: 'Prüfe, ob du online bist und der Server läuft. Betreibt ihn jemand anderes, frag nach.',
    helpNotSaldo: 'Du brauchst die Adresse, unter der du Saldo im Browser öffnest, zum Beispiel saldo.beispiel.de.',
  },
```

`es.ts`
```ts
    welcomeBody: 'Controla tus gastos periodo a periodo. Elige dónde viven tus datos: puedes cambiar de idea después.',
    welcomePhone: 'Solo en este teléfono',
    welcomePhoneHint: 'Sin cuenta, nada que configurar.',
    welcomeServer: 'Con tu servidor Saldo',
    welcomeServerHint: 'Sincroniza varios dispositivos. Necesitas su dirección.',
    welcomeLater: 'Si empiezas solo en este teléfono, podrás conectar un servidor desde el Perfil sin perder nada.',
    unownedTitle: 'Datos en este teléfono',
    unownedBody: 'Estos datos aún no están en ninguna cuenta. Puedes llevarlos a esta, junto con lo que ya contiene, o borrarlos y usar solo los del servidor.',
    unownedAdopt: 'Llevar a la cuenta',
    unownedDiscard: 'Borrar y usar el servidor',
  server: {
    title: 'Tu servidor Saldo',
    body: 'La dirección con la que abres Saldo en el navegador; luego entras con una passkey. Te la dio quien gestiona el servidor, si no eres tú.',
    address: 'Dirección del servidor',
    placeholder: 'saldo.ejemplo.es',
    hintIdle: 'Por ejemplo saldo.ejemplo.es',
    hintConnect: 'Me conecto a {{origin}}',
    hintInvalid: 'Escribe solo la dirección, por ejemplo saldo.ejemplo.es',
    checking: 'Compruebo el servidor…',
    version: 'Saldo {{version}}',
    unreachable: 'No accesible',
    notSaldo: 'No es un servidor Saldo',
    change: 'Cambiar',
    changeServer: 'Cambiar servidor',
    changeAddress: 'Cambiar dirección',
    retry: 'Reintentar',
    stillNothing: 'Sigue sin responder.',
    helpUnreachable: 'Comprueba que tienes conexión y que el servidor está encendido. Si lo gestiona otra persona, pregúntale.',
    helpNotSaldo: 'Necesitas la dirección con la que abres Saldo en el navegador, por ejemplo saldo.ejemplo.es.',
  },
```

`fr.ts`
```ts
    welcomeBody: 'Suivez vos dépenses période par période. Choisissez où vivent vos données : vous pourrez changer d’avis plus tard.',
    welcomePhone: 'Seulement sur ce téléphone',
    welcomePhoneHint: 'Pas de compte, rien à configurer.',
    welcomeServer: 'Avec votre serveur Saldo',
    welcomeServerHint: 'Synchronise plusieurs appareils. Il vous faut son adresse.',
    welcomeLater: 'Si vous commencez seulement sur ce téléphone, vous pourrez connecter un serveur depuis le Profil sans rien perdre.',
    unownedTitle: 'Données sur ce téléphone',
    unownedBody: 'Ces données ne sont encore dans aucun compte. Vous pouvez les apporter dans celui-ci, avec ce qu’il contient déjà, ou les supprimer et n’utiliser que celles du serveur.',
    unownedAdopt: 'Apporter dans le compte',
    unownedDiscard: 'Supprimer et utiliser le serveur',
  server: {
    title: 'Votre serveur Saldo',
    body: 'L’adresse à laquelle vous ouvrez Saldo dans le navigateur, puis vous vous connectez avec une passkey. La personne qui gère le serveur vous l’a donnée, si ce n’est pas vous.',
    address: 'Adresse du serveur',
    placeholder: 'saldo.exemple.fr',
    hintIdle: 'Par exemple saldo.exemple.fr',
    hintConnect: 'Connexion à {{origin}}',
    hintInvalid: 'Saisissez seulement l’adresse, par exemple saldo.exemple.fr',
    checking: 'Vérification du serveur…',
    version: 'Saldo {{version}}',
    unreachable: 'Injoignable',
    notSaldo: 'Pas un serveur Saldo',
    change: 'Changer',
    changeServer: 'Changer de serveur',
    changeAddress: 'Changer d’adresse',
    retry: 'Réessayer',
    stillNothing: 'Toujours pas de réponse.',
    helpUnreachable: 'Vérifiez que vous êtes en ligne et que le serveur est allumé. Si quelqu’un d’autre le gère, demandez-lui.',
    helpNotSaldo: 'Il faut l’adresse à laquelle vous ouvrez Saldo dans le navigateur, par exemple saldo.exemple.fr.',
  },
```

`pt.ts`
```ts
    welcomeBody: 'Acompanhe os gastos período a período. Escolha onde vivem os seus dados: pode mudar de ideia depois.',
    welcomePhone: 'Só neste telemóvel',
    welcomePhoneHint: 'Sem conta, nada para configurar.',
    welcomeServer: 'Com o seu servidor Saldo',
    welcomeServerHint: 'Sincroniza vários dispositivos. Precisa do endereço dele.',
    welcomeLater: 'Se começar só neste telemóvel, pode ligar um servidor no Perfil mais tarde sem perder nada.',
    unownedTitle: 'Dados neste telemóvel',
    unownedBody: 'Estes dados ainda não estão em nenhuma conta. Pode trazê-los para esta, junto com o que ela já tem, ou apagá-los e usar só os do servidor.',
    unownedAdopt: 'Trazer para a conta',
    unownedDiscard: 'Apagar e usar o servidor',
  server: {
    title: 'O seu servidor Saldo',
    body: 'O endereço com que abre o Saldo no navegador; depois entra com uma passkey. Quem gere o servidor deu-lho, se não for você.',
    address: 'Endereço do servidor',
    placeholder: 'saldo.exemplo.pt',
    hintIdle: 'Por exemplo saldo.exemplo.pt',
    hintConnect: 'A ligar a {{origin}}',
    hintInvalid: 'Escreva só o endereço, por exemplo saldo.exemplo.pt',
    checking: 'A verificar o servidor…',
    version: 'Saldo {{version}}',
    unreachable: 'Inacessível',
    notSaldo: 'Não é um servidor Saldo',
    change: 'Mudar',
    changeServer: 'Mudar de servidor',
    changeAddress: 'Mudar endereço',
    retry: 'Tentar de novo',
    stillNothing: 'Continua sem resposta.',
    helpUnreachable: 'Confirme que tem rede e que o servidor está ligado. Se outra pessoa o gere, pergunte-lhe.',
    helpNotSaldo: 'Precisa do endereço com que abre o Saldo no navegador, por exemplo saldo.exemplo.pt.',
  },
```

`sv.ts`
```ts
    welcomeBody: 'Håll koll på utgifterna period för period. Välj var dina data finns: du kan ändra dig senare.',
    welcomePhone: 'Bara på den här telefonen',
    welcomePhoneHint: 'Inget konto, inget att ställa in.',
    welcomeServer: 'Med din Saldo-server',
    welcomeServerHint: 'Synkar flera enheter. Du behöver dess adress.',
    welcomeLater: 'Om du bara börjar på den här telefonen kan du ansluta en server från Profil senare utan att förlora något.',
    unownedTitle: 'Data på den här telefonen',
    unownedBody: 'Dessa data finns inte i något konto ännu. Du kan ta med dem till det här, tillsammans med det som redan finns där, eller radera dem och bara använda serverns.',
    unownedAdopt: 'Ta med till kontot',
    unownedDiscard: 'Radera och använd servern',
  server: {
    title: 'Din Saldo-server',
    body: 'Adressen du öppnar Saldo på i webbläsaren, sedan loggar du in med en passkey. Den som driver servern gav dig den, om det inte är du.',
    address: 'Serveradress',
    placeholder: 'saldo.exempel.se',
    hintIdle: 'Till exempel saldo.exempel.se',
    hintConnect: 'Ansluter till {{origin}}',
    hintInvalid: 'Skriv bara adressen, till exempel saldo.exempel.se',
    checking: 'Kontrollerar servern…',
    version: 'Saldo {{version}}',
    unreachable: 'Går inte att nå',
    notSaldo: 'Inte en Saldo-server',
    change: 'Ändra',
    changeServer: 'Byt server',
    changeAddress: 'Ändra adress',
    retry: 'Försök igen',
    stillNothing: 'Fortfarande inget svar.',
    helpUnreachable: 'Kontrollera att du är online och att servern är igång. Om någon annan driver den, fråga dem.',
    helpNotSaldo: 'Du behöver adressen du öppnar Saldo på i webbläsaren, till exempel saldo.exempel.se.',
  },
```

(Match each catalog's existing quoting style — several use `’` inside single-quoted strings; keep them.)

- [x] **Step 4: Run the parity test**

Run: `pnpm --filter @saldo/i18n test`
Expected: PASS (`… has the key structure of it`, `… keeps the interpolation variables of it`).

- [x] **Step 5: Commit**

```bash
git add packages/i18n/src/locales
git commit -m "feat(i18n): copy for the two doors, the server step and unowned data"
```

---

### Task 6: `ServerProvider` — the address comes from `kv`, not the build

**Files:**
- Create: `apps/mobile/src/auth/serverKeys.ts`
- Modify: `apps/mobile/src/auth/ServerProvider.tsx`, `apps/mobile/src/auth/buildServer.ts`,
  `apps/mobile/src/auth/serverConfig.ts`, `apps/mobile/src/auth/serverConfig.test.ts`, `apps/mobile/app.config.ts`

No unit test: `ServerProvider` has none and needs SQLite + SecureStore; its decisions live in the tested pure
functions (Tasks 1–3). It is exercised by the component tests of Task 8 through a mocked `useServer`, and by the
device check in Task 12.

- [x] **Step 1: `serverKeys.ts`**

```ts
/**
 * The server this phone signs in to, typed by the user (§6.29 step 0, §6.30) — not a build input
 * any more. Written by a successful sign-in, removed by «Esci»: its presence is what makes a
 * scheduler exist. Device-local, never synced, emptied by a device reset like the rest of `kv`.
 */
export const SERVER_URL_KEY = 'serverUrl';

/** The last address that worked, kept past «Esci» only to prefill the field. */
export const LAST_SERVER_URL_KEY = 'lastServerUrl';
```

- [x] **Step 2: Drop the build input**

`buildServer.ts` — delete `BUILD_SERVER_URL` and its import of `readServerUrl`; keep `BUILD_REDIRECT_URI`. New file:

```ts
import Constants from 'expo-constants';
import { redirectUri } from './link';
import { readScheme } from './serverConfig';

/**
 * The redirect this build can actually receive: the scheme `SALDO_SCHEME` registered, not a fixed
 * `saldo://`. It lives apart from `serverConfig` because `expo-constants` cannot load in plain
 * Node, so the two functions it composes stay testable and this line does not.
 */
export const BUILD_REDIRECT_URI: string = redirectUri(readScheme(Constants.expoConfig));
```

`serverConfig.ts` — delete `readServerUrl` and the `normaliseServerUrl` import. `serverConfig.test.ts` — delete
the `describe('readServerUrl', …)` block (and its import).

`app.config.ts` — delete `const serverUrl = process.env.SALDO_SERVER_URL ?? '';` and the `serverUrl,` entry of
`extra` (line ~125). If `extra` is left empty except for `eas`/`router` keys, leave those as they are.

- [x] **Step 3: `ServerProvider.tsx`**

Imports: remove `BUILD_SERVER_URL`; add `import { LAST_SERVER_URL_KEY, SERVER_URL_KEY } from './serverKeys';`.

Replace the `ServerValue` fields `serverUrl` doc, `connect` and add `lastServerUrl`:

```ts
export interface OwnershipQuestions {
  /** Rows of a **different** account are here: yes deletes them, no signs straight back out. */
  confirmForeignData?: (pending: number) => Promise<boolean>;
  /** Rows of **no** account are here (local-only): join the account, make way for it, or stop. */
  decideUnownedData?: () => Promise<'adopt' | 'discard' | 'cancel'>;
}

export interface ServerValue {
  /** The server this phone is signed in to (or whose session expired); null when local-only. */
  serverUrl: string | null;
  /** The last address that worked, to prefill the field after «Esci». */
  lastServerUrl: string | null;
  …(user, api, status, sessionExpired, check unchanged)…
  /**
   * Both questions are asked before the session is installed — see `ownershipVerdict`. A missing
   * answer is a refusal: the account is signed back out and the phone is left as it was found.
   */
  connect(
    serverUrl: string,
    mode: 'login' | 'register',
    questions?: OwnershipQuestions,
  ): Promise<SignedInUser>;
  disconnect(): Promise<void>;
}
```

Replace the component doc comment and the first lines of the body:

```ts
/**
 * Owns the server connection: which server (typed by the user and kept in `kv`, §6.30), whether
 * there is a session (Better Auth's, in SecureStore, scoped by server), and the API client the
 * sync layer uses. No address means local-only: no client, no API, no scheduler.
 */
export function ServerProvider({ children }: { children: ReactNode }) {
  const { kv } = useDatabase();
  const [serverUrl, setServerUrl] = useState<string | null>(() => kv.get(SERVER_URL_KEY));
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [status, setStatus] = useState<ServerStatus>(serverUrl === null ? 'signed-out' : 'loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  const client = useMemo<ServerAuthClient | null>(
    () => (serverUrl === null ? null : createServerAuthClient(serverUrl)),
    [serverUrl],
  );

  const api = useMemo<ApiClient | null>(() => {
    if (serverUrl === null || client === null) return null;
    return createApiClient({ …unchanged body… });
  }, [serverUrl, client]);
```

Replace `connect`:

```ts
  const connect = useCallback(
    async (url: string, mode: 'login' | 'register', questions: OwnershipQuestions = {}) => {
      const target = createServerAuthClient(url);
      log('auth', 'opening the ceremony', { mode });
      const signedIn = await signIn({ serverUrl: url, client: target, mode });
      log('auth', 'ceremony finished', { account: shortId(signedIn.id) });

      /** …keep the existing comment about ordering before `setUser`… */
      const stored = kv.get(DEVICE_ACCOUNT_KEY);
      const verdict = ownershipVerdict(stored, signedIn.id, hasLocalData(db));
      log('auth', 'whose data is on this phone', {
        stored: shortId(stored),
        incoming: shortId(signedIn.id),
        verdict,
      });

      /** Saying no must leave the phone exactly as it was found: the ceremony already succeeded. */
      const refuse = async (code: string, message: string): Promise<never> => {
        log('auth', 'refused, signing the new account back out', { code });
        await signOut(target);
        throw new ApiClientError(409, code, message);
      };
      const wipe = () => {
        log('auth', 'deleting the attachment files');
        deleteAllAttachmentFiles();
        log('auth', 'emptying the database');
        wipeDevice(db);
        log('auth', 'phone is clear');
      };

      if (verdict === 'foreign-data') {
        const pending = pendingCount(db);
        log('auth', 'asking before deleting another account data', { pending });
        const accepted = (await questions.confirmForeignData?.(pending)) ?? false;
        if (!accepted) await refuse('foreign_device_data', 'This phone holds another account data');
        wipe();
      }
      if (verdict === 'unowned-data') {
        log('auth', 'asking what to do with rows that belong to no account');
        const answer = (await questions.decideUnownedData?.()) ?? 'cancel';
        log('auth', 'unowned data', { answer });
        if (answer === 'cancel') await refuse('cancelled', 'Sign-in was cancelled');
        // «Porta nell'account»: nothing to do — the rows are pending, and the first cycle pushes them.
        if (answer === 'discard') wipe();
      }
      // After the wipe, never before: `wipeDevice` empties `kv` too.
      kv.set(DEVICE_ACCOUNT_KEY, signedIn.id);
      kv.set(SERVER_URL_KEY, url);
      kv.set(LAST_SERVER_URL_KEY, url);

      log('auth', 'installing the session, sync can start now');
      setServerUrl(url);
      setUser(signedIn);
      setStatus('signed-in');
      setSessionExpired(false);
      return signedIn;
    },
    [kv],
  );
```

Replace `disconnect`:

```ts
  const disconnect = useCallback(async () => {
    if (client !== null) await signOut(client);
    // §6.30 «Esci»: the phone keeps its data and carries on local-only. The address goes — it is
    // what makes a scheduler exist — and the next sign-in starts from an empty cursor, because
    // that account's rows may not be the ones it pulls next.
    kv.remove('syncCursor');
    kv.remove(SERVER_URL_KEY);
    setServerUrl(null);
    setUser(null);
    setStatus('signed-out');
    setSessionExpired(false);
  }, [client, kv]);
```

In `value`, add `lastServerUrl: kv.get(LAST_SERVER_URL_KEY),` and add `serverUrl` to the dependency list:
`[serverUrl, user, api, status, sessionExpired, connect, disconnect, kv]`.

- [x] **Step 4: Typecheck (expect only the callers to fail)**

Run: `pnpm --filter mobile typecheck`
Expected: errors only in `src/features/server/ConnectForm.tsx` and `app/profile/server.tsx` (`connect` signature),
which Tasks 8 and 10 replace. No error in `ServerProvider.tsx`, `deviceOwner.ts`, `buildServer.ts`, `session.ts`.

- [x] **Step 5: Run the auth tests**

Run: `cd apps/mobile && npx jest --selectProjects db --testPathPatterns "auth/"`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/auth apps/mobile/app.config.ts
git commit -m "feat(mobile): the server address is typed and kept on the phone, not built in"
```

---

### Task 7: `ConfirmDialog` third button, `StepFooter` without a primary

**Files:**
- Modify: `apps/mobile/src/components/ConfirmDialog.tsx`, `apps/mobile/src/features/onboarding/StepFooter.tsx`
- Test: `apps/mobile/src/components/ConfirmDialog.test.tsx` (create), `apps/mobile/src/features/onboarding/StepFooter.test.tsx` (create)

- [x] **Step 1: Write the failing tests**

`ConfirmDialog.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ConfirmDialog } from './ConfirmDialog';

async function renderDialog(extra: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    visible: true,
    title: 'Data on this phone',
    confirmLabel: 'Bring into the account',
    cancelLabel: 'Cancel',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...extra,
  };
  await render(
    <ThemeProvider preference="dark">
      <ConfirmDialog {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('ConfirmDialog', () => {
  it('offers two answers by default', async () => {
    await renderDialog();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('offers a third answer between the two when asked to', async () => {
    const onAlternative = jest.fn();
    await renderDialog({ alternativeLabel: 'Delete and use the server', onAlternative });
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await userEvent.press(screen.getByText('Delete and use the server'));
    expect(onAlternative).toHaveBeenCalledTimes(1);
  });
});
```

`StepFooter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepFooter } from './StepFooter';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('../../components/keypad/AmountKeypadProvider', () => ({
  useAmountKeypad: () => ({ session: null }),
}));

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function renderFooter(label?: string) {
  await render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <StepFooter label={label} onPress={jest.fn()} />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('StepFooter', () => {
  it('draws «Back» and the primary action', async () => {
    await renderFooter('Continue');
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('is only the way back when there is no action to offer', async () => {
    await renderFooter();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run to see them fail**

Run: `cd apps/mobile && npx jest --selectProjects app --testPathPatterns "ConfirmDialog|StepFooter"`
Expected: FAIL — three buttons expected, two found (the dialog ignores `alternativeLabel`); and `StepFooter`
without a label still draws an empty primary button (two buttons, one expected).

- [x] **Step 3: Implement**

`ConfirmDialog.tsx` — add to the props interface and the destructuring:

```ts
  /** A third answer, drawn between the two: for a question with two ways forward and one way out. */
  alternativeLabel?: string;
  onAlternative?: () => void;
```

and render it between the two buttons:

```tsx
          <View style={{ gap: 8, marginTop: 4 }}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            {alternativeLabel === undefined ? null : (
              <SecondaryButton label={alternativeLabel} onPress={onAlternative} />
            )}
            <SecondaryButton label={cancelLabel} onPress={onCancel} />
          </View>
```

`StepFooter.tsx` — make the label optional and draw the primary only with one:

```tsx
/** …keep the existing comment, adding:… Without a `label` it is the way back alone. */
export function StepFooter({ label, ...rest }: Omit<ButtonProps, 'label'> & { label?: string }) {
```

```tsx
      {session === null && label !== undefined ? (
        <View style={{ flex: 1 }}>
          <PrimaryButton label={label} {...rest} />
        </View>
      ) : null}
```

- [x] **Step 4: Run to see them pass**

Run: `cd apps/mobile && npx jest --selectProjects app --testPathPatterns "ConfirmDialog|StepFooter"`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/components/ConfirmDialog.tsx apps/mobile/src/components/ConfirmDialog.test.tsx apps/mobile/src/features/onboarding/StepFooter.tsx apps/mobile/src/features/onboarding/StepFooter.test.tsx
git commit -m "feat(mobile): a third answer on dialogs and a back-only step footer"
```

---

### Task 8: `ServerSignIn` — hook and views (replaces `ConnectForm`)

**Files:**
- Create: `apps/mobile/src/features/server/describeServerError.ts`
- Create: `apps/mobile/src/features/server/useServerSignIn.ts`
- Create: `apps/mobile/src/features/server/ServerSignIn.tsx`
- Test: `apps/mobile/src/features/server/ServerSignIn.test.tsx`
- Delete: `apps/mobile/src/features/server/ConnectForm.tsx`

- [x] **Step 1: `describeServerError.ts`** (the table `ConnectForm` and `profile/server.tsx` both carried)

```ts
import type { TFunction } from 'i18next';
import { ApiClientError } from '../../net/apiClient';

/** Error codes with their own wording; anything else falls back to the message. */
export const SERVER_ERROR_KEYS: Record<string, string> = {
  unreachable: 'sync.unreachable',
  not_saldo: 'sync.notSaldo',
  cancelled: 'sync.cancelled',
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
  registration_closed: 'sync.registrationClosed',
  display_name_required: 'sync.nameRequired',
  foreign_device_data: 'sync.foreignDeviceData',
};

export function describeServerError(t: TFunction, caught: unknown): string {
  const code = caught instanceof ApiClientError ? caught.code : null;
  const key = code === null ? undefined : SERVER_ERROR_KEYS[code];
  if (key !== undefined) return t(key);
  return caught instanceof Error ? caught.message : t('sync.unreachable');
}
```

- [x] **Step 2: `useServerSignIn.ts`**

```ts
import { useCallback, useReducer, useState } from 'react';
import { normaliseServerUrl } from '../../auth/link';
import { useServer } from '../../auth/ServerProvider';
import { failureReason, initialProbe, type ProbeState, probeReducer } from './serverProbe';

type Answer<T> = { resolve: (value: T) => void } | null;

/**
 * The server step (§6.29 step 0, §6.30): an address, a probe of `/api/health`, then the passkey
 * ceremony and the two ownership questions `connect` may ask. Shared by onboarding and Profile so
 * the sign-in the app offers first and the one it offers later are one piece of code.
 */
export function useServerSignIn({ onConnected }: { onConnected?: () => void } = {}) {
  const { connect, check, lastServerUrl } = useServer();
  const [address, setAddress] = useState(() =>
    lastServerUrl === null ? '' : new URL(lastServerUrl).host,
  );
  const [probe, dispatch] = useReducer(probeReducer, initialProbe);
  const [busy, setBusy] = useState(false);
  // Kept raw and worded at render time, so a change of language does not need a new attempt.
  const [failure, setFailure] = useState<unknown>(null);
  /**
   * Open only while `connect` waits for an answer. Each holds the `resolve` of the promise it
   * handed out, which is what lets a dialog answer a question asked deep inside the sign-in — and
   * why both must be resolved on every button, never dropped.
   */
  const [foreignData, setForeignData] = useState<
    ({ pending: number } & NonNullable<Answer<boolean>>) | null
  >(null);
  const [unowned, setUnowned] = useState<Answer<'adopt' | 'discard' | 'cancel'>>(null);

  const run = useCallback(
    async (origin: string) => {
      try {
        dispatch({ type: 'answered', health: await check(origin) });
      } catch (caught) {
        dispatch({ type: 'failed', reason: failureReason(caught) });
      }
    },
    [check],
  );

  const origin = normaliseServerUrl(address);

  const submit = useCallback(() => {
    if (origin === null) return;
    setFailure(null);
    dispatch({ type: 'submit', origin });
    void run(origin);
  }, [origin, run]);

  const retry = useCallback(() => {
    if (probe.kind !== 'failed') return;
    dispatch({ type: 'retry' });
    void run(probe.origin);
  }, [probe, run]);

  const change = useCallback(() => {
    setFailure(null);
    dispatch({ type: 'change' });
  }, []);

  const signIn = useCallback(
    (mode: 'login' | 'register') => {
      if (probe.kind !== 'found') return;
      setBusy(true);
      setFailure(null);
      void (async () => {
        try {
          await connect(probe.origin, mode, {
            confirmForeignData: (pending) =>
              new Promise<boolean>((resolve) => setForeignData({ pending, resolve })),
            decideUnownedData: () =>
              new Promise<'adopt' | 'discard' | 'cancel'>((resolve) => setUnowned({ resolve })),
          });
          onConnected?.();
        } catch (caught) {
          setFailure(caught);
        } finally {
          setBusy(false);
        }
      })();
    },
    [probe, connect, onConnected],
  );

  const answerForeignData = (accepted: boolean) => {
    foreignData?.resolve(accepted);
    setForeignData(null);
  };
  const answerUnowned = (answer: 'adopt' | 'discard' | 'cancel') => {
    unowned?.resolve(answer);
    setUnowned(null);
  };

  return {
    address,
    setAddress,
    probe,
    canSubmit: origin !== null && probe.kind === 'editing',
    busy,
    failure,
    submit,
    retry,
    change,
    signIn,
    foreignData,
    answerForeignData,
    unownedOpen: unowned !== null,
    answerUnowned,
  };
}

export type ServerSignIn = ReturnType<typeof useServerSignIn>;
export type { ProbeState };
```

- [x] **Step 3: Write the failing component tests**

`ServerSignIn.test.tsx`:

```tsx
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ApiClientError } from '../../net/apiClient';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ServerSignInPanel } from './ServerSignIn';

const mockCheck = jest.fn();
const mockConnect = jest.fn();
jest.mock('../../auth/ServerProvider', () => ({
  useServer: () => ({ check: mockCheck, connect: mockConnect, lastServerUrl: null }),
}));

const HEALTH = {
  app: 'saldo',
  apiVersion: 1,
  schemaVersion: 12,
  version: '0.3.1',
  registrationAllowed: true,
  attachmentsEnabled: false,
};

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('en', []);
});
beforeEach(() => {
  mockCheck.mockReset();
  mockConnect.mockReset();
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderPanel(onConnected = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <ServerSignInPanel onConnected={onConnected} />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return onConnected;
}

async function typeAndContinue(address: string) {
  await userEvent.type(screen.getByLabelText('Server address'), address);
  await userEvent.press(screen.getByText('Continue'));
}

describe('ServerSignInPanel', () => {
  it('previews the origin and keeps «Continue» off until the address is usable', async () => {
    await renderPanel();
    expect(screen.getByText('For example saldo.example.com')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Server address'), 'saldo.rossi.example.org');
    expect(screen.getByText('Connecting to https://saldo.rossi.example.org')).toBeTruthy();
  });

  it('swaps the field for the server row and offers the passkey', async () => {
    mockCheck.mockResolvedValue(HEALTH);
    await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    expect(await screen.findByText('saldo.rossi.example.org')).toBeTruthy();
    expect(screen.getByText('Saldo 0.3.1')).toBeTruthy();
    expect(screen.getByText('Sign in with passkey')).toBeTruthy();
    expect(screen.getByText('Create account')).toBeTruthy();
    expect(screen.queryByLabelText('Server address')).toBeNull();
  });

  it('says in words that the server is not reachable, and tries the same address again', async () => {
    mockCheck.mockRejectedValue(new ApiClientError(503, 'unreachable', 'x'));
    await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    expect(await screen.findByText('Not reachable')).toBeTruthy();
    await userEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText(/Still no answer\./)).toBeTruthy();
    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockCheck).toHaveBeenLastCalledWith('https://saldo.rossi.example.org');
  });

  it('sends a non-Saldo address back to the field, still typed', async () => {
    mockCheck.mockRejectedValue(new ApiClientError(502, 'not_saldo', 'x'));
    await renderPanel();
    await typeAndContinue('example.org');
    expect(await screen.findByText('Not a Saldo server')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    await userEvent.press(screen.getByText('Change address'));
    expect(screen.getByLabelText('Server address').props.value).toBe('example.org');
  });

  it('signs in to the address it checked and hands over', async () => {
    mockCheck.mockResolvedValue(HEALTH);
    mockConnect.mockResolvedValue({ id: 'ada', displayName: 'Ada' });
    const onConnected = await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    await userEvent.press(await screen.findByText('Sign in with passkey'));
    expect(mockConnect).toHaveBeenCalledWith(
      'https://saldo.rossi.example.org',
      'login',
      expect.objectContaining({ decideUnownedData: expect.any(Function) }),
    );
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it('asks what to do with the phone’s own rows, and passes the answer on', async () => {
    mockCheck.mockResolvedValue(HEALTH);
    let answer: Promise<string> | undefined;
    mockConnect.mockImplementation(async (_url, _mode, questions) => {
      answer = questions.decideUnownedData();
      return { id: 'ada', displayName: 'Ada', answer: await answer };
    });
    await renderPanel();
    await typeAndContinue('saldo.rossi.example.org');
    await userEvent.press(await screen.findByText('Sign in with passkey'));
    await userEvent.press(await screen.findByText('Delete and use the server'));
    await act(async () => {
      await expect(answer).resolves.toBe('discard');
    });
  });
});
```

Run: `cd apps/mobile && npx jest --selectProjects app --testPathPatterns "server/ServerSignIn"`
Expected: FAIL — `Cannot find module './ServerSignIn'`.

- [x] **Step 4: `ServerSignIn.tsx`**

The views are split so the onboarding screen can put «Continua» in its `StepFooter` while Profile keeps it in the card.

```tsx
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { serverLabel } from '../../auth/link';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconBox } from '../../components/ListRow';
import { TextField } from '../../components/TextField';
import { swapIn } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { describeServerError } from './describeServerError';
import { addressHint } from './serverProbe';
import { type ServerSignIn, useServerSignIn } from './useServerSignIn';

/** The status mark of the server row: a filled green dot when it answered, a grey ring when not. */
function StatusMark({ ok }: { ok: boolean }) {
  const theme = useTheme();
  // No red in the palette (tokens.ts): the ring differs from the dot by shape, and the words say it.
  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: ok ? theme.palette.positive : 'transparent',
        borderWidth: ok ? 0 : 1.5,
        borderColor: theme.palette.textMuted,
      }}
    />
  );
}

/** The server, once asked: host, what it answered, and the way to change it. */
export function ServerRow({ s }: { s: ServerSignIn }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { probe } = s;
  if (probe.kind !== 'found' && probe.kind !== 'failed') return null;
  const status =
    probe.kind === 'found'
      ? t('server.version', { version: probe.health.version })
      : probe.reason === 'not_saldo'
        ? t('server.notSaldo')
        : t('server.unreachable');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconBox name="server" colour={theme.palette.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="medium" numberOfLines={1}>
          {serverLabel(probe.origin)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <StatusMark ok={probe.kind === 'found'} />
          <Text size="caption" color={probe.kind === 'found' ? 'textFaint' : 'textMuted'}>
            {status}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('server.changeServer')}
        hitSlop={8}
        onPress={s.change}
        style={({ pressed }) => ({
          minHeight: theme.layout.minHitTarget,
          justifyContent: 'center',
          paddingLeft: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text weight="medium" color="textMuted">
          {t('server.change')}
        </Text>
      </Pressable>
    </View>
  );
}

/** The card: the address field while editing or checking, the server row afterwards. */
export function ServerAddressCard({ s, onSubmitEditing }: { s: ServerSignIn; onSubmitEditing?: () => void }) {
  const { t } = useTranslation();
  const hint = addressHint(s.address);
  const editing = s.probe.kind === 'editing' || s.probe.kind === 'checking';
  return (
    <Card>
      {editing ? (
        <Animated.View key="field" entering={swapIn(0.98)} style={{ gap: 8 }}>
          <TextField
            testID="server-address"
            label={t('server.address')}
            placeholder={t('server.placeholder')}
            value={s.address}
            onChangeText={s.setAddress}
            editable={s.probe.kind === 'editing'}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="go"
            onSubmitEditing={onSubmitEditing ?? s.submit}
          />
          <Text size="caption" color="textFaint" accessibilityLiveRegion="polite">
            {s.probe.kind === 'checking'
              ? t('server.checking')
              : hint.kind === 'will-connect'
                ? t('server.hintConnect', { origin: hint.origin })
                : hint.kind === 'invalid'
                  ? t('server.hintInvalid')
                  : t('server.hintIdle')}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View key="row" entering={swapIn(0.98)}>
          <ServerRow s={s} />
        </Animated.View>
      )}
    </Card>
  );
}

/** Below the card: the passkey once the server answered, the way forward when it did not. */
export function ServerActions({ s }: { s: ServerSignIn }) {
  const { t } = useTranslation();
  const { probe } = s;
  if (probe.kind === 'failed') {
    const help = probe.reason === 'not_saldo' ? t('server.helpNotSaldo') : t('server.helpUnreachable');
    return (
      <Animated.View entering={swapIn(0.98)} style={{ gap: 12 }}>
        {probe.reason === 'unreachable' ? (
          <PrimaryButton label={t('server.retry')} onPress={s.retry} />
        ) : (
          <PrimaryButton label={t('server.changeAddress')} onPress={s.change} />
        )}
        <Text size="caption" color="textFaint" accessibilityLiveRegion="polite">
          {probe.attempts > 1 ? `${t('server.stillNothing')} ${help}` : help}
        </Text>
      </Animated.View>
    );
  }
  if (probe.kind === 'checking' && probe.attempts > 0) {
    // «Riprova» in flight: the same place, busy, so the row does not jump.
    return <PrimaryButton label={t('server.retry')} loading />;
  }
  if (probe.kind !== 'found') return null;
  return (
    <Animated.View entering={swapIn(0.98)} style={{ gap: 12 }}>
      <PrimaryButton
        testID="server-sign-in"
        label={t('sync.signIn')}
        loading={s.busy}
        onPress={() => s.signIn('login')}
      />
      {probe.health.registrationAllowed ? (
        <SecondaryButton
          label={t('sync.createAccount')}
          disabled={s.busy}
          onPress={() => s.signIn('register')}
        />
      ) : null}
      {s.failure === null ? null : (
        <Text size="footnote" color="accent">
          {describeServerError(t, s.failure)}
        </Text>
      )}
      <Text size="caption" color="textFaint">
        {t('sync.passkeyNote')}
      </Text>
    </Animated.View>
  );
}

/** The two questions `connect` may ask before it installs the session. */
export function ServerSignInDialogs({ s }: { s: ServerSignIn }) {
  const { t } = useTranslation();
  return (
    <>
      <ConfirmDialog
        visible={s.foreignData !== null}
        title={t('sync.foreignDataTitle')}
        body={t('sync.foreignDataBody', { count: s.foreignData?.pending ?? 0 })}
        confirmLabel={t('sync.foreignDataConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => s.answerForeignData(true)}
        onCancel={() => s.answerForeignData(false)}
      />
      <ConfirmDialog
        visible={s.unownedOpen}
        title={t('sync.unownedTitle')}
        body={t('sync.unownedBody')}
        confirmLabel={t('sync.unownedAdopt')}
        alternativeLabel={t('sync.unownedDiscard')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => s.answerUnowned('adopt')}
        onAlternative={() => s.answerUnowned('discard')}
        onCancel={() => s.answerUnowned('cancel')}
      />
    </>
  );
}

/** Profile's version (§6.30): everything in one column, «Continua» under the field. */
export function ServerSignInPanel({ onConnected }: { onConnected?: () => void }) {
  const { t } = useTranslation();
  const s = useServerSignIn({ onConnected });
  return (
    <View style={{ gap: 16 }}>
      <ServerAddressCard s={s} />
      {s.probe.kind === 'editing' || (s.probe.kind === 'checking' && s.probe.attempts === 0) ? (
        <PrimaryButton
          label={t('common.continue')}
          disabled={!s.canSubmit}
          loading={s.probe.kind === 'checking'}
          onPress={s.submit}
        />
      ) : (
        <ServerActions s={s} />
      )}
      <ServerSignInDialogs s={s} />
    </View>
  );
}
```

Then delete `ConnectForm.tsx`: `git rm apps/mobile/src/features/server/ConnectForm.tsx`.

- [x] **Step 5: Run to see them pass**

Run: `cd apps/mobile && npx jest --selectProjects app --testPathPatterns "server/ServerSignIn"`
Expected: PASS. If `userEvent.type` does not reach a `TextInput` whose `editable` prop is set, check RNTL's docs for
the installed version (`pnpm --filter mobile list @testing-library/react-native`) and use `fireEvent.changeText`
instead — follow the library, fix this plan in the same commit (AGENTS.md).

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/features/server
git commit -m "feat(mobile): the server step — address, server row, passkey, ownership questions"
```

---

### Task 9: Onboarding — two doors, the server step, back on the chooser

**Files:**
- Modify: `apps/mobile/app/(onboarding)/welcome.tsx`
- Create: `apps/mobile/app/(onboarding)/server.tsx`
- Modify: `apps/mobile/app/(onboarding)/start.tsx`

- [x] **Step 1: `welcome.tsx`**

```tsx
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.29 step 0. Two doors of equal weight: the phone alone (local-only, §1.1 goal 2), or a
 * server the user names. Nothing is written by either — the phone door only opens the chooser,
 * and the boot router decides the rest once onboarding saves something.
 */
export default function Welcome() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const lead = (name: 'phone' | 'server') => <IconBox name={name} colour={theme.palette.textMuted} />;

  return (
    <Screen>
      <StepHeader title={t('onboarding.welcomeTitle')} body={t('onboarding.welcomeBody')} />
      <StepChunk>
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            <View style={{ paddingVertical: 5 }}>
              <ListRow
                testID="welcome-phone"
                title={t('onboarding.welcomePhone')}
                subtitle={t('onboarding.welcomePhoneHint')}
                leading={lead('phone')}
                onPress={() => router.push('/start')}
                chevron
              />
            </View>
            <View style={{ height: 1, backgroundColor: theme.palette.border }} />
            <View style={{ paddingVertical: 5 }}>
              <ListRow
                testID="welcome-server"
                title={t('onboarding.welcomeServer')}
                subtitle={t('onboarding.welcomeServerHint')}
                subtitleLines={2}
                leading={lead('server')}
                onPress={() => router.push('/server')}
                chevron
              />
            </View>
          </View>
        </Card>
      </StepChunk>
      <StepChunk index={CHUNK.content + 1}>
        <Text size="caption" color="textFaint">
          {t('onboarding.welcomeLater')}
        </Text>
      </StepChunk>
    </Screen>
  );
}
```

- [x] **Step 2: `server.tsx`** («Due passi»: one screen finds the server and signs in)

```tsx
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import {
  ServerActions,
  ServerAddressCard,
  ServerSignInDialogs,
} from '../../src/features/server/ServerSignIn';
import { useServerSignIn } from '../../src/features/server/useServerSignIn';

/**
 * §6.29 step 0, the server door. The field swaps in place for the server it found, and the
 * passkey appears under it; a failure is the same row with its own words. «Continua» lives in the
 * footer while there is an address to try, and steps aside once there is not (the buttons are in
 * the body then) — «Indietro» stays either way.
 */
export default function ServerStep() {
  const router = useRouter();
  const { t } = useTranslation();
  // Where to go next is the boot router's call: an account with settings skips onboarding (§6.29).
  const s = useServerSignIn({ onConnected: () => router.replace('/') });
  const asking = s.probe.kind === 'editing' || (s.probe.kind === 'checking' && s.probe.attempts === 0);

  return (
    <Screen
      footer={
        asking ? (
          <StepFooter
            testID="server-continue"
            label={t('common.continue')}
            disabled={!s.canSubmit}
            loading={s.probe.kind === 'checking'}
            onPress={s.submit}
          />
        ) : (
          <StepFooter />
        )
      }
    >
      <StepHeader title={t('server.title')} body={t('server.body')} />
      <StepChunk>
        <ServerAddressCard s={s} />
      </StepChunk>
      <StepChunk index={CHUNK.content + 1}>
        <View style={{ marginTop: 16 }}>
          <ServerActions s={s} />
        </View>
      </StepChunk>
      <ServerSignInDialogs s={s} />
    </Screen>
  );
}
```

- [x] **Step 3: `start.tsx` — back when reached from the phone door**

Add imports `import { useServer } from '../../src/auth/ServerProvider';` and
`import { StepFooter } from '../../src/features/onboarding/StepFooter';`, read `const { status } = useServer();`
in the component, and change `<Screen>` to:

```tsx
    <Screen
      // Reached from the phone door (signed out, nothing saved yet), the way back to the welcome
      // stays open. After a sign-in there is none: going back would mean leaving the account.
      footer={status === 'signed-out' ? <StepFooter /> : undefined}
    >
```

- [x] **Step 4: Typecheck and run the onboarding tests**

Run: `pnpm --filter mobile typecheck`
Expected: errors only in `app/profile/server.tsx` (Task 10).
Run: `cd apps/mobile && npx jest --selectProjects app --testPathPatterns "onboarding"`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add "apps/mobile/app/(onboarding)"
git commit -m "feat(mobile): welcome with two doors and a server step that signs in"
```

---

### Task 10: Profile — sign in later, «Esci» stays in the app

**Files:**
- Modify: `apps/mobile/app/profile/server.tsx`, `apps/mobile/app/profile.tsx:151-161`

- [x] **Step 1: `profile/server.tsx`**

1. Replace the local `CODE_KEYS` and `describe` with `import { describeServerError, SERVER_ERROR_KEYS } from '../../src/features/server/describeServerError';`
   — `describe(caught)` becomes `describeServerError(t, caught)`, `CODE_KEYS[status.code]` becomes
   `SERVER_ERROR_KEYS[status.code]`.
2. Replace `import { ConnectForm } …` with `import { ServerSignInPanel } from '../../src/features/server/ServerSignIn';`
   and the not-connected card `<Card><ConnectForm /></Card>` with `<ServerSignInPanel />` (the panel draws its own card).
3. The session-expired row: `connect('login')` → `connect(serverUrl, 'login')`, guarded:
   ```tsx
            {sessionExpired && serverUrl !== null ? (
              <ListRow
                title={t('sync.signIn')}
                onPress={() => void run(async () => void (await connect(serverUrl, 'login')))}
              />
            ) : null}
   ```
4. «Esci» no longer returns to the welcome. Replace the `onConfirm` body's comment and navigation:
   ```tsx
          void run(async () => {
            // §6.30: the data stays and the app carries on local-only, so there is nowhere to go —
            // this screen now shows the sign-in again, prefilled with the address that worked.
            await disconnect();
          });
   ```
   and delete the now-unused `startOver` and `useRouter` imports/`router` constant if nothing else uses them.

- [x] **Step 2: `profile.tsx` trailing text**

```tsx
            trailing={
              <Text color="textMuted">{user?.displayName ?? t('sync.notConnected')}</Text>
            }
```

Remove `serverUrl` from the `useServer()` destructuring there if it is now unused.

- [x] **Step 3: Typecheck, lint, all mobile tests**

Run: `pnpm --filter mobile typecheck`
Expected: no errors.
Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted` (see AGENTS.md — exit code alone is not a pass).
Run: `cd apps/mobile && npx jest`
Expected: PASS, except the known `NewTagSheet` failure that also fails on `main` (check it against `main` before
attributing it to this branch).

- [x] **Step 4: Commit**

```bash
git add apps/mobile/app/profile apps/mobile/app/profile.tsx
git commit -m "feat(mobile): sign in later from Profile; «Esci» leaves a local-only app"
```

---

### Task 11: No server at build time — scripts, docs, spec, roadmap

**Files:** `apps/mobile/scripts/build-apk.sh`, `apps/mobile/scripts/build-ipa.sh`,
`apps/mobile/maestro/onboarding-and-first-expense.yaml`, `docs/building-android.md`, `docs/building-ios.md`,
`docs/self-hosting.md`, `README.md`, `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`, `ROADMAP.md`,
`docs/superpowers/plans/README.md`

- [x] **Step 1: Build scripts**

In both scripts:
- Header usage lines become `pnpm --filter mobile build:android [bundle.id]` / `build:ipa [bundle.id]` (drop the
  `SALDO_SERVER_URL=…` example line).
- Delete the `SERVER_URL=…` line, the `if [ -z "$SERVER_URL" ] … fi` block and `echo "==> server …"`.
- `BUNDLE_ID="${1:-${SALDO_BUNDLE_ID:-io.github.saldo.app}}"` (was `$2`).
- Delete `SALDO_SERVER_URL="$SERVER_URL" \` from the prebuild invocation and
  `echo "export SALDO_SERVER_URL=$SERVER_URL"` from the `.xcode.env.local` block (ipa) / its `export` (apk).
- In `build-ipa.sh` the default-bundle-id note: `pnpm --filter mobile build:ipa com.yourname.saldo`.
- Replace the comment `# The server is a build input, not something typed on the phone (§15)…` with
  `# The server is typed on the phone (§6.29 step 0), so the only per-person input here is the bundle id.`

Check: `SALDO_DRY_RUN=1 bash apps/mobile/scripts/build-ipa.sh` and `SALDO_DRY_RUN=1 bash apps/mobile/scripts/build-apk.sh`
Expected: both print bundle/scheme/output and `dry run: stopping before prebuild.`, exit 0, no mention of a server.

- [x] **Step 2: Docs and README**

Run: `git grep -n "SALDO_SERVER_URL" -- docs README.md apps/mobile/maestro ':!docs/superpowers/plans/2026-09-1*'`
For every hit outside dated plans (dated plans are history — leave them): remove the variable from commands, and
where a paragraph explains that the address is baked into the build, replace it with: «The app asks for the server
address on first run (or later, from Profile → Server). It must be the HTTPS address you open Saldo at in a browser,
and the server must list the app's scheme in `APP_REDIRECT_SCHEMES`.» In `README.md`'s quick start, reorder so a user
can install the app and start **without** a server, and the server section reads as the optional second step.
In the maestro flow header, drop `SALDO_SERVER_URL=…` from the install line and note that the flow now starts by
tapping `welcome-server` and typing the address into `server-address` (update the flow's steps accordingly if it
drives the welcome; if it assumes an already signed-in app, only the comment changes).

- [x] **Step 3: Spec**

In `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`:
- §1.1 goal 2 → «**Local-first, one account when you want one.** Every read and write is local, so the app is fully
  usable offline — and usable with no server at all: the first run offers «Solo su questo telefono» next to signing
  in (§6.29 step 0). An account on the user's own server, signed in to then or later from Profile (§6.30), adds sync;
  the account and the database are the user's, so it is not a hosted dependency.»
- §1.2, the bullet «A first run with no network…» → «A first run with no network can still start on the phone;
  only the server door needs one, and it says so in the server row (§6.29 step 0).»
- §6.29 step 0: replace from «the app needs an account on the user's own server…» through «…a first run offline
  cannot proceed.» with: «two doors of equal weight in one card: **Solo su questo telefono** (straight to the chooser;
  nothing is saved until onboarding finishes, and the chooser offers «Indietro» back here) and **Con il tuo server
  Saldo**, a step of its own: the address field (hint previews the origin); «Continua» calls `GET /api/health`; the card
  swaps in place into a server row — host, a filled green dot with «Saldo {version}», «Cambia» — and «Accedi con
  passkey» (plus «Crea account» when allowed) appears below. A failure is the same row with a hollow grey ring and
  words: «Non raggiungibile» → «Riprova», «Non è un server Saldo» → «Cambia indirizzo». On success it pulls; if the
  server already has settings with `onboardingCompletedAt`, the rest is skipped. After a sign-in the chooser has no
  «Indietro».»
- §6.30 → «The server address (typed, stored on the phone), status (…unchanged…), "Sincronizza ora", "Esci", pending
  changes count, attachment upload queue count. Not connected, the screen is the §6.29 server step, prefilled with the
  last address that worked. «Esci» keeps the data and leaves the app local-only.»
- §8.6 (line ~976): «A build with no server deletes the phone only.» → «A phone with no server (local-only, or signed
  out) deletes the phone only.»
- §9.3 step 1 → «App: the user types the server address (§6.29 step 0, §6.30); `normaliseServerUrl` turns it into an
  origin. «Continua» calls `GET /api/health`, which must return `app: "saldo"` and `apiVersion: 1`; it also returns
  `schemaVersion` (§8.1) and `registrationAllowed`, which decides whether "Crea account" is offered. The address is
  stored (`kv.serverUrl`) only after a sign-in succeeds.»
- §9.5 / ownership: add after the foreign-data paragraph: «Rows with **no** recorded account (a phone started local-only)
  are not foreign: signing in asks «Porta nell’account» (the rows stay pending and the first cycle pushes them, merging
  with what the account holds), «Cancella e usa il server» (wipe, then pull) or «Annulla» (sign back out).»
- §15: delete the `SALDO_SERVER_URL` row and the paragraph under the table; remove `SALDO_SERVER_URL=…` from the
  Android step 2 and iOS step 2 commands.
- §18 first bullet → «…except the server the user typed and signed in to (§6.29 step 0, §6.30) and, in the future,
  the user-configured AI provider.»

- [x] **Step 4: Roadmap and plans index**

`ROADMAP.md`: mark «A first run with no server (local-only), sign-in later» done with a one-line pointer to this plan
and the 2026-09-25 decisions (typed address, `SALDO_SERVER_URL` removed); in the AI item that says «The local-only mode
(0.1…) has no AI. Write that down…», leave the checkbox as it is. `docs/superpowers/plans/README.md`: in the 08b entry,
add «Reversed 2026-09-25 by `2026-09-25-local-first.md`: the address is typed again.»

- [x] **Step 5: Commit**

```bash
git add apps/mobile/scripts apps/mobile/maestro docs README.md ROADMAP.md
git commit -m "docs: the app starts without a server and asks for its address"
```

---

### Task 12: Verification

- [x] **Step 1: Gates** (read the output, not the exit code — AGENTS.md)

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines; no type errors; all tests pass except the known `NewTagSheet` failure (confirm on `main`).

- [x] **Step 2: Leftovers**

Run: `git grep -n "SALDO_SERVER_URL\|BUILD_SERVER_URL\|readServerUrl\|ConnectForm\|noServerConfigured\|welcomeOffline" -- ':!docs/superpowers/plans/2026-09-1*' ':!docs/superpowers/plans/2026-09-2[0-4]*'`
Expected: only this plan file.

- [x] **Step 3: Acceptance (user checks on a device; do not drive the simulator unless asked)** — checked by the user on the iOS simulator, 2026-09-25

1. Fresh install → welcome shows the two doors. «Solo su questo telefono» → «Come vuoi iniziare?» with «Indietro»
   → back to the welcome → again → «Da zero» → finish → tabs. Kill and reopen: tabs, no welcome.
2. Profile → Server: sign-in panel. A wrong host → «Non raggiungibile» + «Riprova»; `example.com` → «Non è un server
   Saldo» + «Cambia indirizzo». The real server → row with the green dot → «Accedi con passkey» → the unowned dialog
   → «Porta nell’account» → the rows appear on the web app after the first cycle.
3. «Esci» → the app stays on its tabs; Profile → Server shows the panel prefilled with the host.
4. Fresh install → «Con il tuo server Saldo» → sign in to an account that already has data → pulls → tabs (no
   onboarding, no unowned dialog: the phone was empty).

- [x] **Step 4: Review and hand-off** — reviewed; fixes in `bc2b467`, `4aff23b`, `9f08ffb`; merged to `main`

Use **requesting-code-review**, then delete the variants harness (`.variants/server-url.html`,
`.variants/local-first-welcome.html` in the main checkout — git-excluded, local only), and use
**finishing-a-development-branch**.
