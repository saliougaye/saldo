# Phase 08b — The server comes from the build, not from the user

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app knows its server because it was built for one. Sign-in stops asking for an address, and the address
stops being device state.

**Architecture:** `SALDO_SERVER_URL` joins the build env of §15 and reaches the app through `app.config.ts` →
`expo-constants`. A pure `readServerUrl` validates it with the existing `normaliseServerUrl`, so a typo in the build
env fails the same way a typo in the field used to. `ServerProvider` reads that constant instead of `kv.serverUrl`;
`ConnectForm` loses its field and its "Verifica" button and instead checks `/api/health` on mount, only to learn
whether "Crea account" should be offered.

**Tech Stack:** Expo config plugins (`app.config.ts`, `extra`), `expo-constants`, existing `@saldo/i18n` keys.

**Spec:** §9.3 step 1, §6.29 step 0, §6.30, §15.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/app.config.ts` | Reads `SALDO_SERVER_URL` from the build env into `extra.serverUrl`, unvalidated. |
| `apps/mobile/src/auth/serverConfig.ts` (new) | `readServerUrl(extra)` — pure, validates with `normaliseServerUrl`. |
| `apps/mobile/src/auth/buildServer.ts` (new) | The one place that touches `expo-constants`: `BUILD_SERVER_URL`. |
| `apps/mobile/src/auth/ServerProvider.tsx` | Uses `BUILD_SERVER_URL`; `connect(mode)` loses its `url`; no `kv.serverUrl`. |
| `apps/mobile/src/features/server/ConnectForm.tsx` | Health on mount → sign-in buttons; no field, no "Verifica". |
| `apps/mobile/app/profile/server.tsx` | Shows the configured address as read-only text. |
| `apps/mobile/src/db/kv.ts` | `serverUrl` leaves `KvKey`. |
| `packages/i18n/src/locales/{it,en}.ts` | New keys for the read-only address and the misconfigured build; dead keys removed. |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | §15 table, §9.3 step 1, §6.29 step 0, §6.30. |
| `docs/self-hosting.md` | The server is no longer optional, and nobody types its address. |

---

### Task 1: The build carries the server address

**Files:**
- Create: `apps/mobile/src/auth/serverConfig.ts`
- Create: `apps/mobile/src/auth/serverConfig.test.ts`
- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/auth/serverConfig.test.ts`:

```ts
import { readServerUrl } from './serverConfig';

describe('readServerUrl', () => {
  it('normalises the address the build was given', () => {
    expect(readServerUrl({ serverUrl: 'saldo.example.com' })).toBe('https://saldo.example.com');
    expect(readServerUrl({ serverUrl: ' http://localhost:3000 ' })).toBe('http://localhost:3000');
  });

  it('is null when the build has no address, or an unusable one', () => {
    expect(readServerUrl({})).toBeNull();
    expect(readServerUrl({ serverUrl: '' })).toBeNull();
    expect(readServerUrl({ serverUrl: 'not a host' })).toBeNull();
    expect(readServerUrl({ serverUrl: 42 })).toBeNull();
    expect(readServerUrl(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter mobile exec jest src/auth/serverConfig.test.ts`
Expected: FAIL, `Cannot find module './serverConfig'`.

- [ ] **Step 3: Write `serverConfig.ts`**

```ts
import { normaliseServerUrl } from './link';

/**
 * The server address the app was built for (§15). It is read from `expoConfig.extra`, which is
 * plain JSON of unknown shape at runtime, and validated the same way the address field used to be
 * validated: a build with a typo in `SALDO_SERVER_URL` must fail loudly, not point somewhere odd.
 */
export function readServerUrl(extra: unknown): string | null {
  if (typeof extra !== 'object' || extra === null) return null;
  const value = (extra as { serverUrl?: unknown }).serverUrl;
  if (typeof value !== 'string') return null;
  return normaliseServerUrl(value);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter mobile exec jest src/auth/serverConfig.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Put the value in the build**

`apps/mobile/app.config.ts`, after the existing `scheme` line:

```ts
const serverUrl = process.env.SALDO_SERVER_URL ?? '';
```

and inside the config object, after `experiments`:

```ts
  extra: {
    // Validated at runtime by `readServerUrl`: a config file cannot import app code, and failing
    // here would break `expo prebuild` for anyone who has not exported the variable yet.
    serverUrl,
  },
```

- [ ] **Step 6: Write the one module that reads `expo-constants`**

`apps/mobile/src/auth/buildServer.ts`:

```ts
import Constants from 'expo-constants';
import { readServerUrl } from './serverConfig';

/**
 * The server this build talks to (§15), or null when it was built without a usable
 * `SALDO_SERVER_URL`. Kept apart from `serverConfig` so the validation stays testable in plain
 * Node: `expo-constants` cannot load there.
 */
export const BUILD_SERVER_URL: string | null = readServerUrl(Constants.expoConfig?.extra);
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/src/auth/serverConfig.ts \
  apps/mobile/src/auth/serverConfig.test.ts apps/mobile/src/auth/buildServer.ts
git commit -m "feat(mobile): read the server address from the build env"
```

---

### Task 2: `ServerProvider` stops storing an address

**Files:**
- Modify: `apps/mobile/src/auth/ServerProvider.tsx`
- Modify: `apps/mobile/src/db/kv.ts`

- [ ] **Step 1: Change the provider**

- `import { BUILD_SERVER_URL } from './buildServer';`
- Replace the `serverUrl` state with the constant:

```ts
  const serverUrl = BUILD_SERVER_URL;
```

- Initial status: `useState<ServerStatus>(serverUrl === null ? 'signed-out' : 'loading')`.
- `connect` loses its `url` parameter and uses `serverUrl`; it must refuse when there is none:

```ts
  const connect = useCallback(
    async (mode: 'login' | 'register') => {
      if (serverUrl === null) throw new ApiClientError(500, 'no_server', 'No server configured');
      const target = createServerAuthClient(serverUrl);
      const signedIn = await signIn({ serverUrl, client: target, mode });
      setUser(signedIn);
      setStatus('signed-in');
      setSessionExpired(false);
      return signedIn;
    },
    [serverUrl],
  );
```

- `disconnect` no longer removes `serverUrl` from `kv` (it keeps removing `syncCursor`).
- The `ServerValue` interface: `connect(mode: 'login' | 'register'): Promise<SignedInUser>`.
- `kv` is still needed by `disconnect`; keep the `useDatabase()` call.
- Import `ApiClientError` from `../net/apiClient`.

- [ ] **Step 2: Drop the key**

`apps/mobile/src/db/kv.ts`: `KvKey` becomes

```ts
export type KvKey = 'deviceId' | 'syncCursor' | 'appLockEnabled' | 'hlc' | string;
```

and `apps/mobile/src/db/kv.test.ts` uses `'syncCursor'` where it used `'serverUrl'`.

- [ ] **Step 3: Typecheck to find every caller**

Run: `pnpm typecheck`
Expected: errors in `ConnectForm.tsx` and `app/profile/server.tsx` — the callers Task 3 and Task 4 fix.

---

### Task 3: `ConnectForm` asks the server, not the user

**Files:**
- Modify: `apps/mobile/src/features/server/ConnectForm.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useServer } from '../../auth/ServerProvider';
import type { ServerHealth } from '../../auth/session';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { ApiClientError } from '../../net/apiClient';
import { Text } from '../../theme/Text';

/** Error codes with their own wording; anything else falls back to the message. */
const CODE_KEYS: Record<string, string> = {
  unreachable: 'sync.unreachable',
  not_saldo: 'sync.notSaldo',
  cancelled: 'sync.cancelled',
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
  registration_closed: 'sync.registrationClosed',
  display_name_required: 'sync.nameRequired',
};

/**
 * Sign-in for the server this build points at (§9.3 step 1). Shared by onboarding step 0 and
 * §6.30, so the sign-in the app requires and the one Settings offers are the same code.
 *
 * The health check is no longer the user's "Verifica": the address is not in question, so it runs
 * on mount and its only job is to learn whether the server still accepts new accounts.
 */
export function ConnectForm({ onConnected }: { onConnected?: () => void }) {
  const { t } = useTranslation();
  const { serverUrl, connect, check } = useServer();
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [checking, setChecking] = useState(serverUrl !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describe = (caught: unknown): string => {
    const code = caught instanceof ApiClientError ? caught.code : null;
    const key = code === null ? undefined : CODE_KEYS[code];
    if (key !== undefined) return t(key);
    return caught instanceof Error ? caught.message : t('sync.unreachable');
  };

  const probe = useCallback(async () => {
    if (serverUrl === null) return;
    setChecking(true);
    setError(null);
    try {
      setHealth(await check(serverUrl));
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setChecking(false);
    }
    // `describe` closes over `t` only; re-creating it on every render would restart the probe.
  }, [serverUrl, check]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await probe();
    })();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  const signIn = (mode: 'login' | 'register') => () => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await connect(mode);
        onConnected?.();
      } catch (caught) {
        setError(describe(caught));
      } finally {
        setBusy(false);
      }
    })();
  };

  // A build with no usable SALDO_SERVER_URL cannot sign anyone in, and no button would help.
  if (serverUrl === null) {
    return (
      <Text size="footnote" color="accent">
        {t('sync.noServerConfigured')}
      </Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text size="footnote" color="textMuted">
        {serverLabel(serverUrl)}
      </Text>
      {checking ? (
        <Text size="footnote" color="textFaint">
          {t('sync.verifying')}
        </Text>
      ) : null}
      {health === null ? null : (
        <Text size="footnote" color="textFaint">
          {t('sync.serverFound', { version: health.version })}
        </Text>
      )}
      <PrimaryButton
        label={t('sync.signIn')}
        disabled={busy || checking}
        onPress={signIn('login')}
      />
      {health?.registrationAllowed === true ? (
        <SecondaryButton
          label={t('sync.createAccount')}
          disabled={busy}
          onPress={signIn('register')}
        />
      ) : null}
      {error === null ? null : (
        <View style={{ gap: 8 }}>
          <Text size="footnote" color="accent">
            {error}
          </Text>
          <SecondaryButton label={t('common.retry')} disabled={checking} onPress={() => void probe()} />
        </View>
      )}
      <Text size="caption" color="textFaint">
        {t('sync.passkeyNote')}
      </Text>
    </View>
  );
}
```

**Note on the sign-in button:** it stays enabled even when the probe failed. An unreachable server cannot be signed
in to, but the failure may be transient and the ceremony reports its own error; disabling the only way forward on a
cached health check would be worse.

- [ ] **Step 2: Add `serverLabel`**

In `apps/mobile/src/auth/link.ts`, next to `normaliseServerUrl`:

```ts
/** What the user is shown: the host, without the scheme they never typed. */
export function serverLabel(serverUrl: string): string {
  return URL.canParse(serverUrl) ? new URL(serverUrl).host : serverUrl;
}
```

with a test in `apps/mobile/src/auth/link.test.ts`:

```ts
  it('shows a server by its host', () => {
    expect(serverLabel('https://saldo.example.com')).toBe('saldo.example.com');
    expect(serverLabel('http://localhost:3000')).toBe('localhost:3000');
  });
```

Import it in `ConnectForm` from `../../auth/link`.

- [ ] **Step 3: Run the auth tests**

Run: `pnpm --filter mobile exec jest src/auth`
Expected: PASS.

---

### Task 4: §6.30 shows the address instead of asking for it

**Files:**
- Modify: `apps/mobile/app/profile/server.tsx`

- [ ] **Step 1: Show the address on the status card**

Under the status line inside the first `<Card>`:

```tsx
        {serverUrl === null ? null : (
          <Text size="footnote" color="textFaint" style={{ marginTop: 4 }}>
            {t('sync.serverIs', { server: serverLabel(serverUrl) })}
          </Text>
        )}
```

- [ ] **Step 2: Fix the expired-session row**

`connect` no longer takes a URL:

```tsx
              <ListRow
                title={t('sync.signIn')}
                onPress={() => void run(async () => void (await connect('login')))}
              />
```

- [ ] **Step 3: Import `serverLabel`** from `../../src/auth/link`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src apps/mobile/app packages/i18n
git commit -m "feat(mobile): sign in to the server the app was built for"
```

---

### Task 5: Strings

**Files:**
- Modify: `packages/i18n/src/locales/it.ts`, `packages/i18n/src/locales/en.ts`

- [ ] **Step 1: Add, in `sync`**

it:
```ts
    serverIs: 'Server: {{server}}',
    noServerConfigured:
      'Questa build non ha un server configurato. Ricostruisci l’app con SALDO_SERVER_URL.',
```
en:
```ts
    serverIs: 'Server: {{server}}',
    noServerConfigured:
      'This build has no server configured. Rebuild the app with SALDO_SERVER_URL.',
```

- [ ] **Step 2: Remove the dead keys** `sync.serverUrl` and `sync.serverUrlPlaceholder` (the field is gone) and
`sync.verify` (nothing is verified by hand any more). `sync.verifying` stays: it is the probe's own label.

- [ ] **Step 3: Check `common.retry` exists**; add it to both locales if it does not.

- [ ] **Step 4: Update the welcome copy** — `onboarding.welcomeBody` must stop implying an address is typed.

- [ ] **Step 5: Run the parity test**

Run: `pnpm --filter @saldo/i18n test`
Expected: PASS.

---

### Task 6: Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`
- Modify: `docs/self-hosting.md`
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: §15 table** gains a row:

```
| `SALDO_SERVER_URL` | — (**required**: the app signs in to this server) |
```

and the iOS/Android build steps mention it in their example command lines.

- [ ] **Step 2: §9.3 step 1** becomes: the app knows its server from the build and calls `GET /api/health` on the
sign-in screen; the answer decides whether "Crea account" is offered. Nobody types an address.

- [ ] **Step 3: §6.29 step 0 and §6.30** lose the URL field: step 0 is one screen with one or two buttons; §6.30 shows
the address as read-only text.

- [ ] **Step 4: `docs/self-hosting.md`** — the server is required, not optional (§6.29), and the address is a build
input, not something typed on the phone.

- [ ] **Step 5: Roadmap** — mark 08b done.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: the mobile app is built for one server"
```

---

### Task 7: Verification

- [ ] **Step 1:** `pnpm lint` — read the output, not the exit code (AGENTS.md).
- [ ] **Step 2:** `pnpm typecheck` — 5/5.
- [ ] **Step 3:** `pnpm test` — everything green; the mobile suite gains the `readServerUrl` and `serverLabel` tests.
- [ ] **Step 4:** Run the app with `SALDO_SERVER_URL` unset and confirm the welcome screen says the build has no
server, then with it set and confirm the screen offers sign-in without a field.
- [ ] **Step 5:** `git grep "kv.get('serverUrl')\|kv.set('serverUrl'\|kv.remove('serverUrl')"` returns nothing.
