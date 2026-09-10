# Mobile shell & local database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Create `apps/mobile` — an Expo Router app that boots into a themed, localised tab shell backed by a migrated SQLite database, with repositories that stamp HLC timestamps, onboarding steps 1–3, an app lock and a demo-data seeder.

**Architecture:** Screens read through `useLiveQuery` hooks over Drizzle/`expo-sqlite` (change listener on) and write only through repositories, which validate with `@saldo/core` Zod schemas, stamp `updatedAt` from an HLC clock and mark rows pending. Repositories are factory functions taking a Drizzle handle and a clock, so tests drive them with `better-sqlite3` in Node while the app passes the Expo driver. Nothing computes business numbers in a component: screens call `@saldo/core` inside `useMemo`.

**Tech Stack:** Expo SDK 57. The template pins **React Native 0.86.3 and React 19.2.3** — these are the versions SDK 57 supports, not the newest on npm (0.87.1 / 19.3.0); never bump them by hand. `expo-sqlite` + `drizzle-orm` 0.45.2 / `drizzle-kit` 0.31.10, `react-i18next` 17 + `i18next` 26, `react-native-svg` 15, `react-native-reanimated` 4 + `react-native-gesture-handler` 3, `@gorhom/bottom-sheet` 5, `@expo-google-fonts/geist` 0.4.2, tests with `jest-expo` 57 + `@testing-library/react-native` 14 and `better-sqlite3` 13. Everything Expo manages is installed with `expo install`, which resolves the SDK-compatible version.

**Spec:** `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (§3.2, §3.3, §4.2, §6 navigation tree, §6.14, §6.29 steps 1–3, §6.32, §7, §8.2, §12, §13, §15 `app.config.ts` only).

**Versions:** checked against the npm registry on 2026-09-10. Install SDK-managed packages with `expo install` (never a bare `pnpm add`) so Metro, Reanimated and the native modules stay on versions the SDK supports. If a library's API differs from this plan, follow the library docs and fix the plan in the same commit.

---

## File structure

```
packages/core/src/
├─ sync/hlc.ts                pure hybrid logical clock state machine (§8.2)
└─ sync/hlc.test.ts

apps/mobile/
├─ app.config.ts              env-driven identity (§15)
├─ metro.config.js            monorepo watchFolders + nodeModulesPaths
├─ babel.config.js            babel-preset-expo + reanimated plugin
├─ drizzle.config.ts          drizzle-kit: sqlite / expo driver
├─ jest.config.js             jest-expo preset, two projects (node + rn)
├─ tsconfig.json
├─ drizzle/                   generated migrations + migrations.js
├─ assets/
├─ app/
│  ├─ _layout.tsx             provider stack + boot gate
│  ├─ index.tsx               boot router: lock / onboarding / tabs
│  ├─ lock.tsx                §6.32
│  ├─ (onboarding)/_layout.tsx
│  ├─ (onboarding)/cycle-day.tsx
│  ├─ (onboarding)/first-account.tsx
│  ├─ (onboarding)/categories.tsx
│  └─ (tabs)/_layout.tsx      custom tab bar + FAB (§6.14)
│     ├─ index.tsx            Home placeholder (phase 03)
│     ├─ transactions.tsx     placeholder (phase 03)
│     ├─ stats.tsx            placeholder (phase 04)
│     └─ accounts.tsx         placeholder (phase 05)
└─ src/
   ├─ theme/
   │  ├─ ThemeProvider.tsx    resolves settings.theme, exposes palette + tokens
   │  ├─ Text.tsx             typography primitive (tracking in px, tabular nums)
   │  └─ Icon.tsx             renders @saldo/ui icon nodes with react-native-svg
   ├─ i18n/index.ts           i18next init from @saldo/i18n resources
   ├─ db/
   │  ├─ schema.ts            all §4 entities + kv, snake_case, indexes
   │  ├─ client.ts            openDatabase + drizzle handle
   │  ├─ DatabaseProvider.tsx useMigrations + blocking error screen
   │  ├─ kv.ts                device-local key/value helpers
   │  ├─ clock.ts             HLC clock persisted in kv
   │  ├─ rows.ts              row <-> core entity mapping
   │  ├─ repositories/*.ts    the only writers
   │  ├─ hooks.ts             useLiveQuery wrappers
   │  └─ seed.ts              onboarding seed + __DEV__ demo data
   └─ components/             Card, ListRow, SectionLabel, Toggle, Segmented,
                              Chip, PrimaryButton, SecondaryButton, TextField,
                              Keypad, Sheet, Toast, ConfirmDialog, ProgressBar,
                              AmountText, TabBar, Fab
```

---

### Task 1: Hybrid logical clock in `@saldo/core`

Spec §8.2. Pulled forward from phase 07 because repositories cannot stamp `updatedAt` without it.

§3.2 forbids hidden `Date.now()` inside core, so this is a **pure state machine**: `hlcNow(state, wallMs)` and
`hlcReceive(state, remoteHlc, wallMs)` take the wall clock as an argument and return the next state. The mobile
wrapper in Task 9 supplies `Date.now()` and persists the state.

**Files:**
- Create: `packages/core/src/sync/hlc.ts`
- Test: `packages/core/src/sync/hlc.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: Write the failing test `packages/core/src/sync/hlc.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  compareHlc,
  formatHlc,
  hlcNow,
  hlcReceive,
  initialHlcState,
  parseHlc,
} from './hlc';

const DEVICE = '7f3a1b2c';
const OTHER = '0a0b0c0d';

describe('formatHlc / parseHlc', () => {
  it('pads the wall clock to 15 digits and the counter to base36 4', () => {
    expect(formatHlc({ wallMs: 1775000000000, counter: 0, deviceId: DEVICE })).toBe(
      `001775000000000-0000-${DEVICE}`,
    );
    expect(formatHlc({ wallMs: 1, counter: 36, deviceId: DEVICE })).toBe(
      `000000000000001-0010-${DEVICE}`,
    );
  });

  it('round-trips', () => {
    const hlc = { wallMs: 1775000000123, counter: 41, deviceId: DEVICE };
    expect(parseHlc(formatHlc(hlc))).toEqual(hlc);
  });

  it('rejects malformed strings', () => {
    expect(() => parseHlc('nope')).toThrow(RangeError);
    expect(() => parseHlc('1775000000000-0000-dev')).toThrow(RangeError);
  });
});

describe('hlcNow', () => {
  it('uses the wall clock when it moved forward', () => {
    const first = hlcNow(initialHlcState(DEVICE), 1000);
    expect(first.hlc).toBe(`000000000001000-0000-${DEVICE}`);
    const second = hlcNow(first.state, 2000);
    expect(second.hlc).toBe(`000000000002000-0000-${DEVICE}`);
  });

  it('bumps the counter within the same millisecond', () => {
    const a = hlcNow(initialHlcState(DEVICE), 1000);
    const b = hlcNow(a.state, 1000);
    const c = hlcNow(b.state, 1000);
    expect([a.hlc, b.hlc, c.hlc].map((h) => parseHlc(h).counter)).toEqual([0, 1, 2]);
  });

  it('never goes backwards when the device clock does', () => {
    const a = hlcNow(initialHlcState(DEVICE), 5000);
    const b = hlcNow(a.state, 1000);
    expect(parseHlc(b.hlc).wallMs).toBe(5000);
    expect(parseHlc(b.hlc).counter).toBe(1);
    expect(a.hlc < b.hlc).toBe(true);
  });
});

describe('hlcReceive', () => {
  it('adopts a remote wall clock that is ahead', () => {
    const state = initialHlcState(DEVICE);
    const received = hlcReceive(state, `000000000009000-0003-${OTHER}`, 1000);
    expect(parseHlc(received.hlc).wallMs).toBe(9000);
    expect(parseHlc(received.hlc).counter).toBe(4);
    expect(parseHlc(received.hlc).deviceId).toBe(DEVICE);
  });

  it('keeps the local wall clock when it is ahead of the remote', () => {
    const local = hlcNow(initialHlcState(DEVICE), 9000);
    const received = hlcReceive(local.state, `000000000001000-0000-${OTHER}`, 2000);
    expect(parseHlc(received.hlc).wallMs).toBe(9000);
    expect(parseHlc(received.hlc).counter).toBe(1);
  });

  it('takes the highest counter when both sides share a millisecond', () => {
    const local = hlcNow(initialHlcState(DEVICE), 1000);
    const received = hlcReceive(local.state, `000000000001000-0007-${OTHER}`, 1000);
    expect(parseHlc(received.hlc).counter).toBe(8);
  });

  it('always moves forward, so merges stay causal', () => {
    let state = initialHlcState(DEVICE);
    let previous = '';
    for (const [remoteWall, localWall] of [
      [5000, 1000],
      [1000, 6000],
      [6000, 6000],
      [2000, 2000],
    ] as const) {
      const step = hlcReceive(state, formatHlc({ wallMs: remoteWall, counter: 3, deviceId: OTHER }), localWall);
      expect(step.hlc > previous).toBe(true);
      previous = step.hlc;
      state = step.state;
    }
  });
});

describe('compareHlc', () => {
  it('orders lexicographically, breaking ties by device', () => {
    expect(compareHlc(`000000000001000-0000-${DEVICE}`, `000000000002000-0000-${DEVICE}`)).toBe(-1);
    expect(compareHlc(`000000000002000-0000-${DEVICE}`, `000000000001000-0000-${DEVICE}`)).toBe(1);
    expect(compareHlc(`000000000001000-0000-${DEVICE}`, `000000000001000-0000-${DEVICE}`)).toBe(0);
    expect(compareHlc(`000000000001000-0000-${OTHER}`, `000000000001000-0000-${DEVICE}`)).toBe(-1);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @saldo/core exec vitest run src/sync/hlc.test.ts`
Expected: FAIL, because Vitest can't resolve the import `./hlc`.

- [x] **Step 3: Implement `packages/core/src/sync/hlc.ts`**

```ts
/**
 * Hybrid logical clock (§8.2). `{wallMs padded to 15}-{counter base36 padded to 4}-{deviceId}`,
 * so lexicographic order is causal order and `deviceId` breaks ties.
 *
 * Pure by design (§3.2): the wall clock is an argument, never read inside. The caller owns
 * persistence — on mobile the state lives in the `kv` table so it survives restarts.
 */
export interface Hlc {
  wallMs: number;
  counter: number;
  deviceId: string;
}

/** Serialised HLC, as stored in `updatedAt`. */
export type HlcString = string;

export interface HlcState {
  wallMs: number;
  counter: number;
  deviceId: string;
}

export interface HlcStep {
  hlc: HlcString;
  state: HlcState;
}

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 4;
const HLC_RE = /^(\d{15})-([0-9a-z]{4})-([0-9A-Za-z_-]+)$/;

export function initialHlcState(deviceId: string): HlcState {
  return { wallMs: 0, counter: 0, deviceId };
}

export function formatHlc(hlc: Hlc): HlcString {
  const wall = String(hlc.wallMs).padStart(WALL_DIGITS, '0');
  const counter = hlc.counter.toString(36).padStart(COUNTER_DIGITS, '0');
  return `${wall}-${counter}-${hlc.deviceId}`;
}

export function parseHlc(value: HlcString): Hlc {
  const match = HLC_RE.exec(value);
  if (!match) throw new RangeError(`Invalid HLC: ${value}`);
  const [, wall, counter, deviceId] = match as unknown as [string, string, string, string];
  return { wallMs: Number(wall), counter: Number.parseInt(counter, 36), deviceId };
}

/** Next timestamp for a local write. */
export function hlcNow(state: HlcState, wallMs: number): HlcStep {
  const wall = Math.max(wallMs, state.wallMs);
  const counter = wall === state.wallMs ? state.counter + 1 : 0;
  const next: HlcState = { wallMs: wall, counter, deviceId: state.deviceId };
  return { hlc: formatHlc(next), state: next };
}

/** Merges a remote timestamp into the local clock, then returns the next local timestamp. */
export function hlcReceive(state: HlcState, remote: HlcString, wallMs: number): HlcStep {
  const parsed = parseHlc(remote);
  const wall = Math.max(wallMs, state.wallMs, parsed.wallMs);
  let counter: number;
  if (wall === state.wallMs && wall === parsed.wallMs) {
    counter = Math.max(state.counter, parsed.counter) + 1;
  } else if (wall === state.wallMs) {
    counter = state.counter + 1;
  } else if (wall === parsed.wallMs) {
    counter = parsed.counter + 1;
  } else {
    counter = 0;
  }
  const next: HlcState = { wallMs: wall, counter, deviceId: state.deviceId };
  return { hlc: formatHlc(next), state: next };
}

export function compareHlc(a: HlcString, b: HlcString): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @saldo/core exec vitest run src/sync/hlc.test.ts`
Expected: PASS.

- [x] **Step 5: Export it from the package**

Add to `packages/core/src/index.ts`, keeping the list alphabetical:

```ts
export * from './stats';
export * from './sync/hlc';
```

- [x] **Step 6: Verify the package**

Run: `pnpm --filter @saldo/core test && pnpm --filter @saldo/core typecheck && pnpm lint`
Expected: all green.

- [x] **Step 7: Commit**

```bash
git add packages/core/src/sync packages/core/src/index.ts
git commit -m "feat(core): add the hybrid logical clock"
```

---

### Task 2: Scaffold `apps/mobile` and wire it to the monorepo

Spec §3.1, §15. Metro must watch the workspace root, resolve the hoisted pnpm store and transform the
TypeScript source that `packages/*` export directly.

**Files:**
- Create: `apps/mobile/` (from the Expo template), then replace/create `app.config.ts`, `metro.config.js`,
  `babel.config.js`, `tsconfig.json`, `package.json` scripts
- Delete: the template's `app/` contents (this plan writes its own routes in Task 12)

- [x] **Step 1: Scaffold with the Expo template**

```bash
cd apps
pnpm create expo-app mobile --template blank-typescript --no-install
cd ..
```

Expected: `apps/mobile` with `package.json`, `App.tsx`, `index.ts`, `app.json`, `tsconfig.json`, `assets/`,
and — as of SDK 57 — a `.claude/` directory plus its own `AGENTS.md`, `CLAUDE.md` and `LICENSE`. Delete those
four: the repo root already carries them, and a second `AGENTS.md` inside the app would give coding agents
conflicting instructions.

```bash
rm -rf apps/mobile/.claude apps/mobile/AGENTS.md apps/mobile/CLAUDE.md apps/mobile/LICENSE
```

The workspace already globs `apps/*`, so no `pnpm-workspace.yaml` change is needed.

- [x] **Step 2: Rename the package and set its scripts**

Replace `apps/mobile/package.json` with:

```json
{
  "name": "mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate"
  }
}
```

`main` points at `expo-router/entry`, which replaces the template's `App.tsx`.

- [x] **Step 3: Install runtime dependencies with `expo install`**

```bash
cd apps/mobile
pnpm add expo@57
pnpm exec expo install \
  expo-router expo-sqlite expo-font expo-local-authentication expo-application \
  expo-splash-screen expo-status-bar expo-constants expo-linking \
  react-native-svg react-native-reanimated react-native-gesture-handler \
  react-native-safe-area-context react-native-screens
pnpm add drizzle-orm i18next react-i18next @gorhom/bottom-sheet @expo-google-fonts/geist
pnpm add '@saldo/core@workspace:*' '@saldo/i18n@workspace:*' '@saldo/ui@workspace:*'
pnpm add -D drizzle-kit jest jest-expo @testing-library/react-native better-sqlite3 \
  @types/react @types/better-sqlite3 typescript
cd ../..
```

`expo install` picks SDK-57-compatible versions; the bare `pnpm add` lines are for packages Expo does not
manage. Expected: `apps/mobile/package.json` lists all of them and `pnpm-lock.yaml` updates.

- [x] **Step 4: Delete the template entry point**

`expo-router/entry` replaces both, and `app.config.ts` replaces `app.json`.

```bash
rm apps/mobile/App.tsx apps/mobile/index.ts apps/mobile/app.json
```

- [x] **Step 5: Create `apps/mobile/app.config.ts`**

SDK 57 removed `newArchEnabled` and `android.edgeToEdgeEnabled` from `ExpoConfig` — both are now
always on — so setting either fails the typecheck.

```ts
import type { ExpoConfig } from 'expo/config';

const name = process.env.SALDO_APP_NAME ?? 'Saldo';
const bundleId = process.env.SALDO_BUNDLE_ID ?? 'io.github.saldo.app';
const scheme = process.env.SALDO_SCHEME ?? 'saldo';

const config: ExpoConfig = {
  name,
  slug: 'saldo',
  scheme,
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      NSFaceIDUsageDescription: 'Unlock Saldo with Face ID.',
    },
  },
  android: {
    // SDK 57 is edge-to-edge by default, so there is no flag to set here.
    package: bundleId,
  },
  plugins: [
    'expo-router',
    'expo-font',
    ['expo-sqlite', { enableFTS: false }],
    'expo-local-authentication',
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
```

- [x] **Step 6: Create `apps/mobile/metro.config.js`**

```js
// Monorepo Metro config: watch the workspace root so changes in packages/* reload,
// and resolve modules from both the app and the hoisted pnpm store.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup stays ON. It is disabled in Yarn/npm monorepos where everything is hoisted,
// but pnpm gives each package its own node_modules, so walking up is exactly how a dependency
// finds its own dependencies — turning it off makes expo-router fail to resolve
// @expo/metro-runtime.

// drizzle-kit's expo output imports the migration files as source, so Metro must treat .sql as a
// source extension (§7).
config.resolver.sourceExts.push('sql');

module.exports = config;
```

Three things here are load-bearing, and each was found by bundling rather than by reading docs:

- **`disableHierarchicalLookup` must stay off.** Every Yarn/npm monorepo guide sets it, because there
  everything is hoisted to the root. pnpm is the opposite: each package gets its own `node_modules`,
  so walking up the tree is precisely how a dependency finds *its* dependencies. With it on,
  `expo-router/entry-classic.js` cannot resolve `@expo/metro-runtime` and the bundle dies at 2 modules.
- **`.sql` must be a resolver source extension**, because `drizzle-kit`'s expo output imports each
  migration file directly.
- **`babel-plugin-inline-import` must inline those `.sql` files** (see the babel step), or Metro
  reaches them and parses SQL as JavaScript: `SyntaxError: Missing semicolon. (1:6)`.

Verify with a real bundle, not the exit code — `expo export` has been observed to exit 0 on a failed
bundle:

```bash
pnpm --filter mobile exec expo export --platform ios --output-dir /tmp/saldo-export
ls /tmp/saldo-export/_expo/static/js/ios/
```

Expected: an `entry-*.hbc` of a few MB. An empty directory means the bundle failed; scroll up for
the resolver error.

- [x] **Step 7: Create `apps/mobile/babel.config.js`**

```js
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // drizzle-kit's expo output imports each migration as a .sql file; this inlines it as a
      // string so Metro does not try to parse SQL as JavaScript (§7).
      ['inline-import', { extensions: ['.sql'] }],
      // Reanimated 4 ships its worklets transform here; it must stay last.
      'react-native-worklets/plugin',
    ],
  };
};
```

Install the inline-import plugin: `pnpm --filter mobile add -D babel-plugin-inline-import`.
Reanimated 4 ships its worklets plugin as `react-native-worklets/plugin`; it must stay last.

- [x] **Step 8: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules"]
}
```

It extends Expo's base rather than `tsconfig.base.json`, because the app needs the React Native lib and JSX
settings; the strict flags of §"Non-negotiable conventions" are repeated explicitly.

- [x] **Step 9: Check the app typechecks and Metro starts**

```bash
pnpm install
pnpm --filter mobile typecheck
```

Expected: typecheck passes (there are no sources yet beyond config). Metro is exercised in Task 12.

- [x] **Step 10: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "chore(mobile): scaffold the Expo app and wire it to the monorepo"
```

---

### Task 3: Theme provider and typography

Spec §13. `settings.theme` resolves `system` through `useColorScheme`; the status bar follows.

**Files:**
- Create: `apps/mobile/src/theme/ThemeProvider.tsx`, `apps/mobile/src/theme/Text.tsx`,
  `apps/mobile/src/theme/Icon.tsx`, `apps/mobile/src/theme/index.ts`
- Test: `apps/mobile/src/theme/theme.test.tsx`

- [x] **Step 1: Create `apps/mobile/jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|@gorhom/.*|@saldo/.*)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [x] **Step 2: Create `apps/mobile/jest.setup.js`**

```js
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
```

- [x] **Step 3: Write the failing test `apps/mobile/src/theme/theme.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react-native';
import { palettes } from '@saldo/ui';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { Text } from './Text';

function Probe() {
  const { palette, name } = useTheme();
  return <Text testID="probe" style={{ color: palette.accent }}>{name}</Text>;
}

describe('ThemeProvider', () => {
  it('uses the explicit preference', () => {
    render(
      <ThemeProvider preference="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('light');
    expect(screen.getByTestId('probe')).toHaveStyle({ color: palettes.light.accent });
  });

  it('falls back to dark when the system scheme is unknown', () => {
    render(
      <ThemeProvider preference="system">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(/dark|light/);
  });
});

describe('Text', () => {
  it('applies the token size and converts tracking to px', () => {
    render(
      <ThemeProvider preference="dark">
        <Text testID="t" size="title" tracking="tighter">
          Saldo
        </Text>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: 24, letterSpacing: -0.48 });
  });
});
```

- [x] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter mobile test`
Expected: FAIL, because `./ThemeProvider` does not exist.

- [x] **Step 5: Implement `apps/mobile/src/theme/ThemeProvider.tsx`**

```tsx
import {
  categoryColors,
  gestures,
  layout,
  motion,
  type Palette,
  palettes,
  radii,
  type ThemeName,
  fontSize as tokenFontSize,
  fontWeight as tokenFontWeight,
  tracking as tokenTracking,
  withAlpha,
} from '@saldo/ui';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | ThemeName;

export interface Theme {
  name: ThemeName;
  palette: Palette;
  radii: typeof radii;
  layout: typeof layout;
  motion: typeof motion;
  gestures: typeof gestures;
  fontSize: typeof tokenFontSize;
  fontWeight: typeof tokenFontWeight;
  tracking: typeof tokenTracking;
  categoryColor(index: number): string;
  tint(hex: string, alpha: number): string;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: ThemePreference;
  children: ReactNode;
}) {
  const scheme = useColorScheme();
  const name: ThemeName = preference === 'system' ? (scheme === 'light' ? 'light' : 'dark') : preference;
  const theme = useMemo<Theme>(
    () => ({
      name,
      palette: palettes[name],
      radii,
      layout,
      motion,
      gestures,
      fontSize: tokenFontSize,
      fontWeight: tokenFontWeight,
      tracking: tokenTracking,
      categoryColor: (index) => categoryColors[index % categoryColors.length] ?? categoryColors[0],
      tint: withAlpha,
    }),
    [name],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) throw new Error('useTheme must be used inside a ThemeProvider');
  return theme;
}
```

- [x] **Step 6: Implement `apps/mobile/src/theme/Text.tsx`**

```tsx
import { fontSize as sizes, trackingPx, tracking as trackings } from '@saldo/ui';
import { Text as RnText, type TextProps as RnTextProps, type TextStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

type SizeToken = keyof typeof sizes;
type TrackingToken = keyof typeof trackings;
type ColorToken = 'text' | 'textMuted' | 'textFaint' | 'accent' | 'positive' | 'onAccent';

export interface TextProps extends RnTextProps {
  size?: SizeToken;
  weight?: 'regular' | 'medium' | 'semibold';
  tracking?: TrackingToken;
  color?: ColorToken;
  /** Numbers must line up in columns; the design uses tabular figures everywhere. */
  tabular?: boolean;
}

const FAMILIES = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
} as const;

export function Text({
  size = 'body',
  weight = 'regular',
  tracking,
  color = 'text',
  tabular = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const fontSize = theme.fontSize[size];
  const base: TextStyle = {
    fontFamily: FAMILIES[weight],
    fontSize,
    color: theme.palette[color],
  };
  if (tracking !== undefined) base.letterSpacing = trackingPx(theme.tracking[tracking], fontSize);
  if (tabular) base.fontVariant = ['tabular-nums'];
  return <RnText {...rest} style={[base, style]} />;
}
```

- [x] **Step 7: Implement `apps/mobile/src/theme/Icon.tsx`**

```tsx
import { type IconName, iconDefaults, type IconNode, iconNodes } from '@saldo/ui';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { useTheme } from './ThemeProvider';

const ELEMENTS = { path: Path, circle: Circle, rect: Rect } as const;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Any colour string; defaults to the current text colour. */
  color?: string;
  strokeWidth?: number;
}

function renderNode(node: IconNode, index: number, color: string) {
  const Element = ELEMENTS[node.tag];
  return <Element key={index} {...node.attrs} stroke={node.attrs.stroke ?? color} fill={node.attrs.fill === 'currentColor' ? color : (node.attrs.fill ?? 'none')} />;
}

export function Icon({ name, size = iconDefaults.size, color, strokeWidth }: IconProps) {
  const theme = useTheme();
  const resolved = color ?? theme.palette.text;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={iconDefaults.viewBox}
      fill="none"
      stroke={resolved}
      strokeWidth={strokeWidth ?? iconDefaults.strokeWidth}
      strokeLinecap={iconDefaults.strokeLinecap}
      strokeLinejoin={iconDefaults.strokeLinejoin}
    >
      {iconNodes[name].map((node, index) => renderNode(node, index, resolved))}
    </Svg>
  );
}
```

- [x] **Step 8: Create `apps/mobile/src/theme/index.ts`**

```ts
export * from './Icon';
export * from './Text';
export * from './ThemeProvider';
```

- [x] **Step 9: Run the tests and typecheck**

Run: `pnpm --filter mobile test && pnpm --filter mobile typecheck`
Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add apps/mobile/src/theme apps/mobile/jest.config.js apps/mobile/jest.setup.js
git commit -m "feat(mobile): add theme provider, text and icon primitives"
```

---

### Task 4: i18next initialisation

Spec §12. The catalogs and `resolveLocale` already exist in `@saldo/i18n`; this only wires them to React Native.

**Files:**
- Create: `apps/mobile/src/i18n/index.ts`
- Test: `apps/mobile/src/i18n/i18n.test.ts`

- [x] **Step 1: Write the failing test `apps/mobile/src/i18n/i18n.test.ts`**

```ts
import { createI18n, deviceLanguages } from './index';

describe('createI18n', () => {
  it('starts in the resolved language and translates', async () => {
    const i18n = await createI18n('it', ['en-US']);
    expect(i18n.language).toBe('it');
    expect(i18n.t('tabs.home')).toBe('Home');
    expect(i18n.t('home.remaining')).toBe('Rimasto da spendere');
  });

  it('follows the device language when the preference is system', async () => {
    const i18n = await createI18n('system', ['en-GB', 'it-IT']);
    expect(i18n.language).toBe('en');
    expect(i18n.t('home.remaining')).toBe('Left to spend');
  });

  it('interpolates and pluralises', async () => {
    const i18n = await createI18n('it', []);
    expect(i18n.t('home.dayOf', { elapsed: 23, length: 31 })).toBe('giorno 23 di 31');
    expect(i18n.t('home.overPace', { count: 1 })).toBe('1 oltre il ritmo');
    expect(i18n.t('home.overPace', { count: 3 })).toBe('3 oltre il ritmo');
  });

  it('reports device languages as a plain array', () => {
    expect(Array.isArray(deviceLanguages())).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/i18n`
Expected: FAIL, because `./index` does not exist.

- [x] **Step 3: Implement `apps/mobile/src/i18n/index.ts`**

```ts
import { type AppLocale, type LanguagePreference, resolveLocale, resources } from '@saldo/i18n';
import i18next, { type i18n as I18nInstance } from 'i18next';
import { NativeModules, Platform } from 'react-native';

/** Device languages, most preferred first. */
export function deviceLanguages(): string[] {
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings;
    const languages: unknown = settings?.AppleLanguages;
    if (Array.isArray(languages)) return languages.filter((l): l is string => typeof l === 'string');
    const locale: unknown = settings?.AppleLocale;
    return typeof locale === 'string' ? [locale] : [];
  }
  const locale: unknown = NativeModules.I18nManager?.localeIdentifier;
  return typeof locale === 'string' ? [locale.replace('_', '-')] : [];
}

export async function createI18n(
  preference: LanguagePreference,
  languages: readonly string[] = deviceLanguages(),
): Promise<I18nInstance> {
  const language: AppLocale = resolveLocale(preference, languages);
  const instance = i18next.createInstance();
  await instance.init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/i18n`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n
git commit -m "feat(mobile): initialise i18next from the shared catalogs"
```

---

### Task 5: Drizzle schema

Spec §7 and §4. Snake_case columns, JSON text for arrays and the recurrence template, sync metadata on every
synced table, plus a non-synced `kv` table.

**Files:**
- Create: `apps/mobile/src/db/schema.ts`
- Create: `apps/mobile/drizzle.config.ts`
- Test: `apps/mobile/src/db/schema.test.ts`

- [x] **Step 1: Write the failing test `apps/mobile/src/db/schema.test.ts`**

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { accounts, kv, settings, transactions } from './schema';
import { createTestDatabase } from './testing';

describe('schema', () => {
  it('creates every table and round-trips a transaction with json arrays', () => {
    const db = createTestDatabase();
    db.insert(settings)
      .values({
        id: 'settings',
        createdAt: '2026-04-18T10:00:00.000Z',
        updatedAt: '001775000000000-0000-dev',
        deletedAt: null,
        syncState: 1,
        cycleStartDay: 27,
        currency: 'EUR',
        language: 'system',
        theme: 'dark',
        onboardingCompletedAt: null,
      })
      .run();

    db.insert(accounts)
      .values({
        id: 'acc-1',
        createdAt: '2026-04-18T10:00:00.000Z',
        updatedAt: '001775000000000-0001-dev',
        deletedAt: null,
        syncState: 1,
        name: 'Carta',
        type: 'credit_card',
        institution: null,
        openingBalance: 0,
        includeInSpendable: false,
        colorIndex: 0,
        icon: 'card',
        creditCloseDay: 20,
        creditChargeDay: 5,
        creditPaymentAccountId: null,
        archivedAt: null,
        sortOrder: 0,
      })
      .run();

    db.insert(transactions)
      .values({
        id: 'tx-1',
        createdAt: '2026-04-18T10:00:00.000Z',
        updatedAt: '001775000000000-0002-dev',
        deletedAt: null,
        syncState: 1,
        kind: 'expense',
        amount: 4500,
        date: '2026-04-18',
        accountId: 'acc-1',
        toAccountId: null,
        categoryId: 'cat-1',
        description: 'Benzina',
        note: null,
        tagIds: ['tag-a', 'tag-b'],
        excludeFromTotals: false,
        recurrenceId: null,
      })
      .run();

    const [row] = db.select().from(transactions).where(eq(transactions.id, 'tx-1')).all();
    expect(row?.tagIds).toEqual(['tag-a', 'tag-b']);
    expect(row?.excludeFromTotals).toBe(false);
    expect(row?.amount).toBe(4500);
  });

  it('stores booleans as integers on disk', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema: { transactions } });
    expect(db).toBeDefined();
    sqlite.close();
  });

  it('keeps kv rows out of the sync metadata', () => {
    const db = createTestDatabase();
    db.insert(kv).values({ key: 'deviceId', value: 'abc' }).run();
    const [row] = db.select().from(kv).where(eq(kv.key, 'deviceId')).all();
    expect(row?.value).toBe('abc');
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/db/schema`
Expected: FAIL, because `./schema` does not exist.

- [x] **Step 3: Implement `apps/mobile/src/db/schema.ts`**

```ts
import type { CurrencyCode, Recurrence } from '@saldo/core';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Columns every synced table carries (§7). `updatedAt` is an HLC string, not a timestamp, so it is
 * compared lexicographically. `syncState` 0 = synced, 1 = pending push.
 */
const syncMeta = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  syncState: integer('sync_state').notNull().default(1),
};

export const settings = sqliteTable(
  'settings',
  {
    ...syncMeta,
    cycleStartDay: integer('cycle_start_day').notNull(),
    currency: text('currency').$type<CurrencyCode>().notNull(),
    language: text('language').$type<'system' | 'it' | 'en'>().notNull(),
    theme: text('theme').$type<'system' | 'dark' | 'light'>().notNull(),
    onboardingCompletedAt: text('onboarding_completed_at'),
  },
  (table) => [index('settings_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const accounts = sqliteTable(
  'accounts',
  {
    ...syncMeta,
    name: text('name').notNull(),
    type: text('type')
      .$type<'cash' | 'checking' | 'credit_card' | 'savings' | 'investment'>()
      .notNull(),
    institution: text('institution'),
    openingBalance: integer('opening_balance').notNull(),
    includeInSpendable: integer('include_in_spendable', { mode: 'boolean' }).notNull(),
    colorIndex: integer('color_index').notNull(),
    icon: text('icon').notNull(),
    creditCloseDay: integer('credit_close_day'),
    creditChargeDay: integer('credit_charge_day'),
    creditPaymentAccountId: text('credit_payment_account_id'),
    archivedAt: text('archived_at'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [index('accounts_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const categories = sqliteTable(
  'categories',
  {
    ...syncMeta,
    name: text('name').notNull(),
    direction: text('direction').$type<'expense' | 'income'>().notNull(),
    parentId: text('parent_id'),
    icon: text('icon').notNull(),
    colorIndex: integer('color_index').notNull(),
    archivedAt: text('archived_at'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [
    index('categories_parent').on(table.parentId),
    index('categories_pending').on(table.syncState).where(sql`sync_state = 1`),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    ...syncMeta,
    name: text('name').notNull(),
  },
  (table) => [index('tags_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const transactions = sqliteTable(
  'transactions',
  {
    ...syncMeta,
    kind: text('kind').$type<'expense' | 'income' | 'transfer'>().notNull(),
    amount: integer('amount').notNull(),
    date: text('date').notNull(),
    accountId: text('account_id').notNull(),
    toAccountId: text('to_account_id'),
    categoryId: text('category_id'),
    description: text('description').notNull(),
    note: text('note'),
    tagIds: text('tag_ids', { mode: 'json' }).$type<string[]>().notNull(),
    excludeFromTotals: integer('exclude_from_totals', { mode: 'boolean' }).notNull(),
    recurrenceId: text('recurrence_id'),
  },
  (table) => [
    index('transactions_date').on(table.date),
    index('transactions_account_date').on(table.accountId, table.date),
    index('transactions_category_date').on(table.categoryId, table.date),
    index('transactions_recurrence').on(table.recurrenceId),
    index('transactions_pending').on(table.syncState).where(sql`sync_state = 1`),
  ],
);

export const recurrences = sqliteTable(
  'recurrences',
  {
    ...syncMeta,
    frequency: text('frequency').$type<'monthly'>().notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    template: text('template', { mode: 'json' }).$type<Recurrence['template']>().notNull(),
  },
  (table) => [index('recurrences_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const budgets = sqliteTable(
  'budgets',
  {
    ...syncMeta,
    name: text('name').notNull(),
    categoryIds: text('category_ids', { mode: 'json' }).$type<string[]>().notNull(),
    amount: integer('amount').notNull(),
    period: text('period').$type<'cycle' | 'week' | 'year'>().notNull(),
    alertThreshold: integer('alert_threshold'),
    rollover: integer('rollover', { mode: 'boolean' }).notNull(),
    icon: text('icon').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [index('budgets_pending').on(table.syncState).where(sql`sync_state = 1`)],
);

export const attachments = sqliteTable(
  'attachments',
  {
    ...syncMeta,
    transactionId: text('transaction_id').notNull(),
    mimeType: text('mime_type').$type<'image/jpeg' | 'image/png' | 'application/pdf'>().notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    width: integer('width'),
    height: integer('height'),
    /** Local cache path; never synced. */
    localUri: text('local_uri'),
  },
  (table) => [
    index('attachments_transaction').on(table.transactionId),
    index('attachments_pending').on(table.syncState).where(sql`sync_state = 1`),
  ],
);

/** Device-local key/value store (§7). Not synced. */
export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const syncedTables = {
  settings,
  accounts,
  categories,
  tags,
  transactions,
  recurrences,
  budgets,
  attachments,
} as const;

export const schema = { ...syncedTables, kv } as const;

export const tagsNameUnique = uniqueIndex('tags_name_unique').on(tags.name);
```

- [x] **Step 4: Create the test database helper `apps/mobile/src/db/testing.ts`**

Repositories and schema tests run in Node, where the Expo driver does not exist. This helper builds the same
schema on `better-sqlite3`, so tests exercise the real SQL.

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { schema } from './schema';

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'drizzle');

/** Applies the generated migrations to an in-memory database. */
export function createTestDatabase(): TestDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (files.length === 0) throw new Error('No migrations found; run pnpm --filter mobile db:generate');
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.exec(trimmed);
    }
  }
  return drizzle(sqlite, { schema });
}
```

- [x] **Step 5: Create `apps/mobile/drizzle.config.ts` and generate the migration**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

Run: `pnpm --filter mobile db:generate`
Expected: `apps/mobile/drizzle/0000_*.sql` plus `apps/mobile/drizzle/migrations.js` are created.

- [x] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/db/schema`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/db apps/mobile/drizzle apps/mobile/drizzle.config.ts
git commit -m "feat(mobile): add the drizzle schema and migrations"
```

---

### Task 6: Database client, migrations provider and key/value store

Spec §7: `enableChangeListener: true`, `useMigrations` at startup, blocking error screen on failure, and a
non-synced `kv` table for `deviceId`, `serverUrl`, `syncCursor`, `appLockEnabled` and the HLC state.

**Files:**
- Create: `apps/mobile/src/db/client.ts`, `apps/mobile/src/db/kv.ts`,
  `apps/mobile/src/db/DatabaseProvider.tsx`
- Test: `apps/mobile/src/db/kv.test.ts`

- [x] **Step 1: Write the failing test `apps/mobile/src/db/kv.test.ts`**

```ts
import { createKvStore } from './kv';
import { createTestDatabase } from './testing';

describe('createKvStore', () => {
  it('reads back what it writes and reports missing keys as null', () => {
    const store = createKvStore(createTestDatabase());
    expect(store.get('deviceId')).toBeNull();
    store.set('deviceId', 'abc123');
    expect(store.get('deviceId')).toBe('abc123');
  });

  it('overwrites an existing key instead of failing', () => {
    const store = createKvStore(createTestDatabase());
    store.set('serverUrl', 'https://a.example');
    store.set('serverUrl', 'https://b.example');
    expect(store.get('serverUrl')).toBe('https://b.example');
  });

  it('stores json values', () => {
    const store = createKvStore(createTestDatabase());
    store.setJson('hlc', { wallMs: 1000, counter: 2, deviceId: 'dev' });
    expect(store.getJson<{ counter: number }>('hlc')?.counter).toBe(2);
    expect(store.getJson('missing')).toBeNull();
  });

  it('creates a device id once and keeps it', () => {
    const store = createKvStore(createTestDatabase());
    const first = store.deviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.deviceId()).toBe(first);
  });

  it('removes keys', () => {
    const store = createKvStore(createTestDatabase());
    store.set('appLockEnabled', 'true');
    store.remove('appLockEnabled');
    expect(store.get('appLockEnabled')).toBeNull();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/db/kv`
Expected: FAIL, because `./kv` does not exist.

- [x] **Step 3: Implement `apps/mobile/src/db/kv.ts`**

```ts
import { newId } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { kv } from './schema';
import type { AppDatabase } from './client';

/** Device-local keys (§7). Never synced. */
export type KvKey =
  | 'deviceId'
  | 'serverUrl'
  | 'syncCursor'
  | 'appLockEnabled'
  | 'hlc'
  | (string & {});

export interface KvStore {
  get(key: KvKey): string | null;
  set(key: KvKey, value: string): void;
  remove(key: KvKey): void;
  getJson<T>(key: KvKey): T | null;
  setJson(key: KvKey, value: unknown): void;
  /** Stable per-install id, used as the HLC tiebreaker. */
  deviceId(): string;
}

export function createKvStore(db: AppDatabase): KvStore {
  const store: KvStore = {
    get(key) {
      const [row] = db.select().from(kv).where(eq(kv.key, key)).all();
      return row?.value ?? null;
    },
    set(key, value) {
      db.insert(kv)
        .values({ key, value })
        .onConflictDoUpdate({ target: kv.key, set: { value } })
        .run();
    },
    remove(key) {
      db.delete(kv).where(eq(kv.key, key)).run();
    },
    getJson<T>(key: KvKey): T | null {
      const raw = store.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    },
    setJson(key, value) {
      store.set(key, JSON.stringify(value));
    },
    deviceId() {
      const existing = store.get('deviceId');
      if (existing !== null) return existing;
      const created = newId();
      store.set('deviceId', created);
      return created;
    },
  };
  return store;
}
```

- [x] **Step 4: Implement `apps/mobile/src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { schema } from './schema';

export const DATABASE_NAME = 'saldo.db';

/**
 * The Expo-backed handle. `enableChangeListener` is what makes `useLiveQuery` re-run after a write
 * (§7), so it must stay on.
 */
export const sqlite: SQLiteDatabase = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });

/** Structural type shared by the Expo handle and the `better-sqlite3` handle used in tests. */
export type AppDatabase = typeof db;
```

- [x] **Step 5: Implement `apps/mobile/src/db/DatabaseProvider.tsx`**

```tsx
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import migrations from '../../drizzle/migrations';
import { Text } from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { db } from './client';

function BlockingError({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        backgroundColor: theme.palette.bg,
      }}
    >
      <Text size="title" weight="semibold" tracking="tighter">
        Saldo
      </Text>
      <Text color="textMuted" style={{ textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}

/** Applies migrations before rendering the app; a failure blocks rather than corrupting data (§7). */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  if (error) return <BlockingError message={error.message} />;
  if (!success) return null;
  return <>{children}</>;
}
```

- [x] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/db/kv`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/db
git commit -m "feat(mobile): open the database, apply migrations and add the kv store"
```

---

### Task 7: HLC clock persisted in `kv`

Spec §7 and §8.2. The pure state machine from Task 1 gets its wall clock and its persistence here.

**Files:**
- Create: `apps/mobile/src/db/clock.ts`
- Test: `apps/mobile/src/db/clock.test.ts`

- [x] **Step 1: Write the failing test `apps/mobile/src/db/clock.test.ts`**

```ts
import { parseHlc } from '@saldo/core';
import { createClock } from './clock';
import { createKvStore } from './kv';
import { createTestDatabase } from './testing';

function setup(wallMs = 1_775_000_000_000) {
  const store = createKvStore(createTestDatabase());
  let now = wallMs;
  const clock = createClock(store, () => now);
  return { clock, store, advance: (ms: number) => (now += ms) };
}

describe('createClock', () => {
  it('issues increasing timestamps', () => {
    const { clock } = setup();
    const a = clock.now();
    const b = clock.now();
    expect(a < b).toBe(true);
    expect(parseHlc(a).deviceId).toBe(parseHlc(b).deviceId);
  });

  it('persists its state, so a restart cannot repeat a timestamp', () => {
    const { clock, store } = setup();
    const before = clock.now();
    const restarted = createClock(store, () => 1);
    const after = restarted.now();
    expect(after > before).toBe(true);
  });

  it('uses the stored device id as the tiebreaker', () => {
    const { clock, store } = setup();
    expect(parseHlc(clock.now()).deviceId).toBe(store.deviceId());
  });

  it('merges a remote timestamp and moves past it', () => {
    const { clock } = setup(1000);
    const merged = clock.receive('000000009999999-0005-otherdev');
    expect(parseHlc(merged).wallMs).toBe(9999999);
    expect(clock.now() > merged).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/db/clock`
Expected: FAIL, because `./clock` does not exist.

- [x] **Step 3: Implement `apps/mobile/src/db/clock.ts`**

```ts
import { type HlcState, type HlcString, hlcNow, hlcReceive, initialHlcState } from '@saldo/core';
import type { KvStore } from './kv';

export interface Clock {
  /** Timestamp for a local write. */
  now(): HlcString;
  /** Merges a timestamp pulled from the server and returns the resulting local timestamp. */
  receive(remote: HlcString): HlcString;
}

/**
 * HLC clock persisted in `kv` (§8.2), so timestamps keep increasing across restarts even if the
 * device wall clock jumps backwards.
 */
export function createClock(store: KvStore, wallClock: () => number = Date.now): Clock {
  const load = (): HlcState => store.getJson<HlcState>('hlc') ?? initialHlcState(store.deviceId());
  const save = (state: HlcState): void => store.setJson('hlc', state);
  return {
    now() {
      const step = hlcNow(load(), wallClock());
      save(step.state);
      return step.hlc;
    },
    receive(remote) {
      const step = hlcReceive(load(), remote, wallClock());
      save(step.state);
      return step.hlc;
    },
  };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/db/clock`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/db/clock.ts apps/mobile/src/db/clock.test.ts
git commit -m "feat(mobile): persist the HLC clock in the kv table"
```

---

### Task 8: Repositories

Spec §7. Repositories are the only writers: they validate with the core Zod schema, stamp a fresh
HLC (and `createdAt` on insert), and mark the row pending.

They are **factory functions over a driver-agnostic handle**, not modules bound to the Expo driver.
`RepositoryDatabase` is `BaseSQLiteDatabase<'sync', unknown, typeof schema>` — the common supertype
of `drizzle-orm/expo-sqlite` and `drizzle-orm/better-sqlite3`, whose only difference is the `run()`
result type. Typing it as either concrete driver fails: the Expo `SQLiteRunResult` has no
`lastInsertRowid`.

Deletes are tombstones (`deletedAt` set, still pushed), and `transactions.restore` clears one for
the undo toast of §5.12. Reads strip the device-only `syncState` column so `@saldo/core` never sees
it.

Tags and budgets are included because the demo seeder writes them; recurrences and attachments get
theirs in phases 03 and 08.

**Files:** `src/db/repositories/{support,settings,accounts,categories,transactions,tags,budgets,index}.ts`,
test `src/db/repositories/repositories.test.ts`.

- [x] **Step 1: Write `support.ts`**

```ts
import type { HlcString } from '@saldo/core';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { Clock } from '../clock';
import type { schema } from '../schema';

/** `sync_state` values (§7). */
export const SYNCED = 0;
export const PENDING = 1;

/**
 * Driver-agnostic Drizzle handle. Repositories run against `expo-sqlite` on device and
 * `better-sqlite3` in tests; the two drivers differ only in their `run()` result type, so this is
 * their common supertype rather than either concrete one.
 */
export type RepositoryDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export interface RepositoryContext {
  db: RepositoryDatabase;
  clock: Clock;
  /** Overridable so tests get deterministic `createdAt` stamps. */
  nowIso?: () => string;
}

export interface InsertStamp {
  createdAt: string;
  updatedAt: HlcString;
  deletedAt: null;
  syncState: typeof PENDING;
}

export interface UpdateStamp {
  updatedAt: HlcString;
  syncState: typeof PENDING;
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** Fields stamped on insert: creation time, a fresh HLC, and pending so the scheduler pushes it. */
export function insertStamp(context: RepositoryContext): InsertStamp {
  return {
    createdAt: (context.nowIso ?? isoNow)(),
    updatedAt: context.clock.now(),
    deletedAt: null,
    syncState: PENDING,
  };
}

/** Fields stamped on every write after insert. `createdAt` is never touched again. */
export function updateStamp(context: RepositoryContext): UpdateStamp {
  return { updatedAt: context.clock.now(), syncState: PENDING };
}

/** Drops the device-only `syncState` column so `@saldo/core` only ever sees entity fields. */
export function toEntity<T>(row: T & { syncState: number }): T {
  const { syncState: _ignored, ...entity } = row;
  return entity as T;
}
```

- [x] **Step 2: Write the failing test `src/db/repositories/repositories.test.ts`**

Note the fixtures use `satisfies`, not `as const`: `as const` makes `tagIds` a readonly tuple, which
does not satisfy the mutable `string[]` the entity type declares.

```ts
import {
  type Account,
  type CurrencyCode,
  compareHlc,
  SETTINGS_ID,
  type Settings,
  type Transaction,
} from '@saldo/core';
import { eq } from 'drizzle-orm';
import { settings, transactions } from '../schema';
import { createTestDatabase } from '../testing';
import { createRepositories } from './index';
import { PENDING } from './support';

const CREATED_AT = '2026-04-18T10:00:00.000Z';

function setup() {
  const db = createTestDatabase();
  return { db, repos: createRepositories(db, () => CREATED_AT) };
}

const SETTINGS_INPUT = {
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'dark',
  onboardingCompletedAt: null,
} satisfies Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const ACCOUNT_INPUT = {
  name: 'Conto corrente',
  type: 'checking',
  institution: null,
  openingBalance: 500000,
  includeInSpendable: true,
  colorIndex: 0,
  icon: 'landmark',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
} satisfies Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

describe('settings repository', () => {
  it('creates the singleton with the fixed id and marks it pending', () => {
    const { db, repos } = setup();
    const created = repos.settings.create(SETTINGS_INPUT);
    expect(created.id).toBe(SETTINGS_ID);
    expect(created.createdAt).toBe(CREATED_AT);
    const [row] = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).all();
    expect(row?.syncState).toBe(PENDING);
  });

  it('reads back what it wrote, without the device-only sync state', () => {
    const { repos } = setup();
    repos.settings.create(SETTINGS_INPUT);
    const loaded = repos.settings.get();
    expect(loaded).not.toBeNull();
    expect(loaded && 'syncState' in loaded).toBe(false);
    expect(loaded?.cycleStartDay).toBe(27);
  });

  it('moves the HLC forward on every update but keeps createdAt', () => {
    const { repos } = setup();
    const created = repos.settings.create(SETTINGS_INPUT);
    const updated = repos.settings.update({ cycleStartDay: 1 });
    expect(updated.cycleStartDay).toBe(1);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(compareHlc(updated.updatedAt, created.updatedAt)).toBe(1);
  });

  it('refuses to update before onboarding created the row', () => {
    const { repos } = setup();
    expect(() => repos.settings.update({ cycleStartDay: 1 })).toThrow(/does not exist/);
  });

  it('rejects values the core schema forbids', () => {
    const { repos } = setup();
    expect(() => repos.settings.create({ ...SETTINGS_INPUT, cycleStartDay: 32 })).toThrow();
    // Cast deliberately: the point is that an unknown code coming from a restored backup or a
    // newer peer is rejected at runtime, not just at compile time.
    expect(() =>
      repos.settings.create({ ...SETTINGS_INPUT, currency: 'XYZ' as CurrencyCode }),
    ).toThrow();
  });
});

describe('accounts repository', () => {
  it('generates a UUIDv7 id when none is given', () => {
    const { repos } = setup();
    const account = repos.accounts.create(ACCOUNT_INPUT);
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('lists live accounts in sort order and hides tombstones', () => {
    const { repos } = setup();
    repos.accounts.create({ ...ACCOUNT_INPUT, id: 'b', name: 'B', sortOrder: 1 });
    repos.accounts.create({ ...ACCOUNT_INPUT, id: 'a', name: 'A', sortOrder: 0 });
    const gone = repos.accounts.create({ ...ACCOUNT_INPUT, id: 'c', name: 'C', sortOrder: 2 });
    repos.accounts.remove(gone.id);
    expect(repos.accounts.list().map((account) => account.id)).toEqual(['a', 'b']);
  });

  it('keeps a tombstoned row readable so sync can push it', () => {
    const { repos } = setup();
    const account = repos.accounts.create({ ...ACCOUNT_INPUT, id: 'x' });
    repos.accounts.remove(account.id);
    expect(repos.accounts.byId('x')?.deletedAt).toBe(CREATED_AT);
  });

  it('validates patches through the core schema', () => {
    const { repos } = setup();
    repos.accounts.create({ ...ACCOUNT_INPUT, id: 'x' });
    expect(() => repos.accounts.update('x', { colorIndex: 99 })).toThrow();
    expect(() => repos.accounts.update('missing', { name: 'Nope' })).toThrow(/No account/);
  });
});

describe('transactions repository', () => {
  const expense = {
    kind: 'expense',
    amount: 4500,
    date: '2026-04-18',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId: 'cat-1',
    description: 'Benzina',
    note: null,
    tagIds: ['tag-a'],
    excludeFromTotals: false,
    recurrenceId: null,
  } satisfies Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

  it('stores json arrays and booleans round-trip', () => {
    const { repos } = setup();
    const created = repos.transactions.create(expense);
    expect(repos.transactions.byId(created.id)?.tagIds).toEqual(['tag-a']);
    expect(repos.transactions.byId(created.id)?.excludeFromTotals).toBe(false);
  });

  it('loads only the requested date range', () => {
    const { repos } = setup();
    repos.transactions.create({ ...expense, id: 'in', date: '2026-04-18' });
    repos.transactions.create({ ...expense, id: 'before', date: '2026-03-26' });
    repos.transactions.create({ ...expense, id: 'after', date: '2026-04-27' });
    const rows = repos.transactions.inRange('2026-03-27', '2026-04-26');
    expect(rows.map((row) => row.id)).toEqual(['in']);
  });

  it('undoes a delete by clearing the tombstone', () => {
    const { repos } = setup();
    const created = repos.transactions.create({ ...expense, id: 'undo-me' });
    repos.transactions.remove(created.id);
    expect(repos.transactions.inRange('2026-04-01', '2026-04-30')).toHaveLength(0);
    repos.transactions.restore(created.id);
    expect(repos.transactions.inRange('2026-04-01', '2026-04-30')).toHaveLength(1);
  });

  it('marks every write pending so the scheduler picks it up', () => {
    const { db, repos } = setup();
    const created = repos.transactions.create({ ...expense, id: 'p' });
    db.update(transactions).set({ syncState: 0 }).where(eq(transactions.id, created.id)).run();
    repos.transactions.update(created.id, { amount: 5000 });
    const [row] = db.select().from(transactions).where(eq(transactions.id, 'p')).all();
    expect(row?.syncState).toBe(PENDING);
  });

  it('enforces the transfer invariant of the core schema', () => {
    const { repos } = setup();
    expect(() =>
      repos.transactions.create({ ...expense, kind: 'transfer', toAccountId: 'acc-1' }),
    ).toThrow();
  });
});
```

- [x] **Step 3: Run it and watch it fail**

Run: `pnpm --filter mobile test src/db/repositories`
Expected: FAIL, module not found.

- [x] **Step 4: Write the repositories**

`settings.ts`:

```ts
import { SETTINGS_ID, type Settings, settingsSchema } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { settings } from '../schema';
import { insertStamp, type RepositoryContext, toEntity, updateStamp } from './support';

/** The settings singleton (§4): exactly one row, with the fixed id `settings`. */
export interface SettingsRepository {
  get(): Settings | null;
  /** Creates the row during onboarding; fails loudly if it already exists. */
  create(input: Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Settings;
  update(patch: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>): Settings;
}

export function createSettingsRepository(context: RepositoryContext): SettingsRepository {
  const { db } = context;
  const read = (): Settings | null => {
    const [row] = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    get: read,
    create(input) {
      const entity = settingsSchema.parse({
        ...input,
        id: SETTINGS_ID,
        ...insertStamp(context),
      });
      db.insert(settings)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(patch) {
      const current = read();
      if (current === null) throw new Error('Settings row does not exist yet');
      const entity = settingsSchema.parse({ ...current, ...patch, ...updateStamp(context) });
      db.update(settings)
        .set({ ...entity, syncState: 1 })
        .where(eq(settings.id, SETTINGS_ID))
        .run();
      return entity;
    },
  };
}
```

The `settings` table must type its primary key as the literal (`text('id').$type<'settings'>()`),
otherwise a row read back is `id: string` and does not satisfy `Settings`.

`accounts.ts`:

```ts
import { type Account, accountSchema, newId } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { accounts } from '../schema';
import { insertStamp, type RepositoryContext, toEntity, updateStamp } from './support';

type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface AccountsRepository {
  create(input: AccountInput): Account;
  update(id: string, patch: Partial<AccountInput>): Account;
  /** Tombstone, so other devices converge on the deletion (§7). */
  remove(id: string): void;
  byId(id: string): Account | null;
  /** Live rows in display order; tombstones are never returned. */
  list(): Account[];
}

export function createAccountsRepository(context: RepositoryContext): AccountsRepository {
  const { db } = context;
  const read = (id: string): Account | null => {
    const [row] = db.select().from(accounts).where(eq(accounts.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = accountSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(accounts)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No account ${id}`);
      const entity = accountSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(accounts)
        .set({ ...entity, syncState: 1 })
        .where(eq(accounts.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(accounts)
        .set({
          deletedAt: (context.nowIso ?? (() => new Date().toISOString()))(),
          ...updateStamp(context),
        })
        .where(eq(accounts.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(accounts)
        .where(isNull(accounts.deletedAt))
        .orderBy(asc(accounts.sortOrder), asc(accounts.name))
        .all()
        .map(toEntity);
    },
  };
}
```

`categories.ts`:

```ts
import { type Category, categorySchema, newId } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { categories } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type CategoryInput = Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface CategoriesRepository {
  create(input: CategoryInput): Category;
  update(id: string, patch: Partial<CategoryInput>): Category;
  remove(id: string): void;
  byId(id: string): Category | null;
  list(): Category[];
}

export function createCategoriesRepository(context: RepositoryContext): CategoriesRepository {
  const { db } = context;
  const read = (id: string): Category | null => {
    const [row] = db.select().from(categories).where(eq(categories.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = categorySchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(categories)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No category ${id}`);
      const entity = categorySchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(categories)
        .set({ ...entity, syncState: 1 })
        .where(eq(categories.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(categories)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(categories.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(categories)
        .where(isNull(categories.deletedAt))
        .orderBy(asc(categories.sortOrder), asc(categories.name))
        .all()
        .map(toEntity);
    },
  };
}
```

`transactions.ts`:

```ts
import { type LocalDate, newId, type Transaction, transactionSchema } from '@saldo/core';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { transactions } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface TransactionsRepository {
  create(input: TransactionInput): Transaction;
  update(id: string, patch: Partial<TransactionInput>): Transaction;
  /** Tombstone. The undo toast of §5.12 calls `restore`. */
  remove(id: string): void;
  restore(id: string): void;
  byId(id: string): Transaction | null;
  /** Live rows in a date range, newest first — the only shape screens should load (§7). */
  inRange(start: LocalDate, end: LocalDate): Transaction[];
  list(): Transaction[];
}

export function createTransactionsRepository(context: RepositoryContext): TransactionsRepository {
  const { db } = context;
  const read = (id: string): Transaction | null => {
    const [row] = db.select().from(transactions).where(eq(transactions.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = transactionSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(transactions)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No transaction ${id}`);
      const entity = transactionSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(transactions)
        .set({ ...entity, syncState: 1 })
        .where(eq(transactions.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(transactions)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(transactions.id, id))
        .run();
    },
    restore(id) {
      db.update(transactions)
        .set({ deletedAt: null, ...updateStamp(context) })
        .where(eq(transactions.id, id))
        .run();
    },
    byId: read,
    inRange(start, end) {
      return db
        .select()
        .from(transactions)
        .where(
          and(
            isNull(transactions.deletedAt),
            gte(transactions.date, start),
            lte(transactions.date, end),
          ),
        )
        .orderBy(desc(transactions.date), asc(transactions.createdAt))
        .all()
        .map(toEntity);
    },
    list() {
      return db
        .select()
        .from(transactions)
        .where(isNull(transactions.deletedAt))
        .orderBy(desc(transactions.date))
        .all()
        .map(toEntity);
    },
  };
}
```

`tags.ts`:

```ts
import { newId, type Tag, tagSchema } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { tags } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type TagInput = Omit<Tag, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & { id?: string };

export interface TagsRepository {
  create(input: TagInput): Tag;
  rename(id: string, name: string): Tag;
  remove(id: string): void;
  byId(id: string): Tag | null;
  list(): Tag[];
  /** §5.10: names are unique case-insensitively among live tags. */
  findByName(name: string): Tag | null;
}

export function createTagsRepository(context: RepositoryContext): TagsRepository {
  const { db } = context;
  const read = (id: string): Tag | null => {
    const [row] = db.select().from(tags).where(eq(tags.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  const repository: TagsRepository = {
    create(input) {
      const existing = repository.findByName(input.name);
      if (existing !== null) throw new Error(`Tag "${input.name}" already exists`);
      const entity = tagSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(tags)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    rename(id, name) {
      const current = read(id);
      if (current === null) throw new Error(`No tag ${id}`);
      const entity = tagSchema.parse({ ...current, name, ...updateStamp(context) });
      db.update(tags)
        .set({ ...entity, syncState: 1 })
        .where(eq(tags.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(tags)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(tags.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(tags)
        .where(isNull(tags.deletedAt))
        .orderBy(asc(tags.name))
        .all()
        .map(toEntity);
    },
    findByName(name) {
      const wanted = name.trim().toLowerCase();
      return repository.list().find((tag) => tag.name.toLowerCase() === wanted) ?? null;
    },
  };
  return repository;
}
```

`budgets.ts`:

```ts
import { type Budget, budgetSchema, newId } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { budgets } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type BudgetInput = Omit<Budget, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & { id?: string };

export interface BudgetsRepository {
  create(input: BudgetInput): Budget;
  update(id: string, patch: Partial<BudgetInput>): Budget;
  remove(id: string): void;
  byId(id: string): Budget | null;
  list(): Budget[];
}

export function createBudgetsRepository(context: RepositoryContext): BudgetsRepository {
  const { db } = context;
  const read = (id: string): Budget | null => {
    const [row] = db.select().from(budgets).where(eq(budgets.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = budgetSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(budgets)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No budget ${id}`);
      const entity = budgetSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(budgets)
        .set({ ...entity, syncState: 1 })
        .where(eq(budgets.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(budgets)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(budgets.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(budgets)
        .where(isNull(budgets.deletedAt))
        .orderBy(asc(budgets.sortOrder), asc(budgets.name))
        .all()
        .map(toEntity);
    },
  };
}
```

`index.ts`:

```ts
import { createClock } from '../clock';
import { createKvStore } from '../kv';
import { createAccountsRepository } from './accounts';
import { createBudgetsRepository } from './budgets';
import { createCategoriesRepository } from './categories';
import { createSettingsRepository } from './settings';
import type { RepositoryContext, RepositoryDatabase } from './support';
import { createTagsRepository } from './tags';
import { createTransactionsRepository } from './transactions';

export * from './accounts';
export * from './budgets';
export * from './categories';
export * from './settings';
export * from './support';
export * from './tags';
export * from './transactions';

export interface Repositories {
  settings: ReturnType<typeof createSettingsRepository>;
  accounts: ReturnType<typeof createAccountsRepository>;
  categories: ReturnType<typeof createCategoriesRepository>;
  transactions: ReturnType<typeof createTransactionsRepository>;
  tags: ReturnType<typeof createTagsRepository>;
  budgets: ReturnType<typeof createBudgetsRepository>;
}

/**
 * Builds every repository over one database handle and one clock. Recurrences and attachments get
 * theirs in the phases that first write them (03 and 08).
 */
export function createRepositories(db: RepositoryDatabase, nowIso?: () => string): Repositories {
  const clock = createClock(createKvStore(db));
  const context: RepositoryContext = nowIso === undefined ? { db, clock } : { db, clock, nowIso };
  return {
    settings: createSettingsRepository(context),
    accounts: createAccountsRepository(context),
    categories: createCategoriesRepository(context),
    transactions: createTransactionsRepository(context),
    tags: createTagsRepository(context),
    budgets: createBudgetsRepository(context),
  };
}
```

- [x] **Step 5: Run the tests**

Run: `pnpm --filter mobile test src/db/repositories`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/db
git commit -m "feat(mobile): add repositories with HLC stamping and validation"
```

---

### Task 9: Live reads and the database provider

Spec §3.3. `useLiveQuery` re-runs on every `expo-sqlite` change, so a repository write updates the
screen with no cache to invalidate — the reason D22 keeps TanStack Query out of local reads.

**Files:** `src/db/{client,DatabaseProvider,hooks}.ts(x)`.

- [x] **Step 1: `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { schema } from './schema';

export const DATABASE_NAME = 'saldo.db';

/**
 * The Expo-backed handle. `enableChangeListener` is what makes `useLiveQuery` re-run after a
 * write (§7), so it must stay on.
 */
export const sqlite: SQLiteDatabase = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });
```

- [x] **Step 2: `src/db/DatabaseProvider.tsx`**

```tsx
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { View } from 'react-native';
import migrations from '../../drizzle/migrations';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { db } from './client';
import { createKvStore, type KvStore } from './kv';
import { createRepositories, type Repositories } from './repositories';

export interface DatabaseValue {
  repos: Repositories;
  kv: KvStore;
}

const DatabaseContext = createContext<DatabaseValue | null>(null);

function CenteredMessage({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        backgroundColor: theme.palette.bg,
      }}
    >
      <Text size="title" weight="semibold" tracking="tighter">
        {title}
      </Text>
      <Text color="textMuted" style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}

/**
 * Applies migrations before anything reads the database (§7). A failure blocks the app rather than
 * letting screens run against a half-migrated schema.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const value = useMemo<DatabaseValue>(
    () => ({ repos: createRepositories(db), kv: createKvStore(db) }),
    [],
  );
  if (error) return <CenteredMessage title="Saldo" body={error.message} />;
  if (!success) return null;
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseValue {
  const value = useContext(DatabaseContext);
  if (value === null) throw new Error('useDatabase must be used inside a DatabaseProvider');
  return value;
}

export function useRepositories(): Repositories {
  return useDatabase().repos;
}
```

- [x] **Step 3: `src/db/hooks.ts`**

```ts
import type { Account, Category, LocalDate, Settings, Transaction } from '@saldo/core';
import { SETTINGS_ID } from '@saldo/core';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from './client';
import { toEntity } from './repositories/support';
import { accounts, categories, settings, transactions } from './schema';

/**
 * Live reads (§3.3). `useLiveQuery` re-runs whenever `expo-sqlite` reports a change, which is why
 * `enableChangeListener` is on: after a repository write the screen updates with no invalidation.
 * Screens then run `@saldo/core` over these rows inside `useMemo` (§3.2).
 */
export function useSettings(): Settings | null {
  const { data } = useLiveQuery(db.select().from(settings).where(eq(settings.id, SETTINGS_ID)));
  const row = data[0];
  return row === undefined ? null : toEntity(row);
}

export function useAccounts(): Account[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.sortOrder), asc(accounts.name)),
  );
  return data.map(toEntity);
}

export function useCategories(): Category[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
  );
  return data.map(toEntity);
}

/** Only the range a screen needs (§7): the selected cycle, plus earlier cycles for baselines. */
export function useTransactionsInRange(start: LocalDate, end: LocalDate): Transaction[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ),
      )
      .orderBy(desc(transactions.date), asc(transactions.createdAt)),
    [start, end],
  );
  return data.map(toEntity);
}
```

- [x] **Step 4: Typecheck**

Run: `pnpm --filter mobile typecheck`
Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/db
git commit -m "feat(mobile): add live reads and the database provider"
```

---

### Task 10: Onboarding seed catalogue

Spec §4.2. The catalogue is data plus the grid/hidden split; names resolve through the `seed.*`
i18n namespace, so they are created in the user's language.

**Files:** `src/db/seed.ts`, test `src/db/seed.test.ts`; adds the `seed.*`, `onboarding.*`,
`accountTypes.*`, `lock.*` and `placeholders.*` namespaces to both catalogs in `@saldo/i18n`.

- [x] **Step 1: Write the failing test**

```ts
import { createRepositories } from './repositories';
import { PICKABLE_SEED_CATEGORIES, SEED_CATEGORIES, seedFromOnboarding } from './seed';
import { createTestDatabase } from './testing';

const BASE = {
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'it',
  theme: 'dark',
  account: {
    name: 'Conto corrente',
    type: 'checking',
    openingBalance: 500000,
    icon: 'landmark',
  },
  translate: (key: string) => `t:${key}`,
  completedAt: '2026-04-18T10:00:00.000Z',
} as const;

function seed(selectedCategoryKeys: readonly string[]) {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => BASE.completedAt);
  seedFromOnboarding(repos, { ...BASE, selectedCategoryKeys });
  return repos;
}

describe('SEED_CATEGORIES', () => {
  it('offers exactly the 12 tiles of the onboarding grid', () => {
    expect(PICKABLE_SEED_CATEGORIES).toHaveLength(12);
    expect(SEED_CATEGORIES).toHaveLength(14);
  });

  it('keeps refunds and gifts out of the grid but in the catalogue', () => {
    const hidden = SEED_CATEGORIES.filter((category) => category.hidden === true);
    expect(hidden.map((category) => category.nameKey)).toEqual(['refunds', 'gifts']);
  });
});

describe('seedFromOnboarding', () => {
  it('writes settings and the first account', () => {
    const repos = seed([]);
    expect(repos.settings.get()?.cycleStartDay).toBe(27);
    expect(repos.settings.get()?.onboardingCompletedAt).toBe(BASE.completedAt);
    const [account] = repos.accounts.list();
    expect(account?.name).toBe('Conto corrente');
    expect(account?.openingBalance).toBe(500000);
    expect(account?.includeInSpendable).toBe(true);
  });

  it('creates the hidden income categories even when nothing is selected', () => {
    const names = seed([])
      .categories.list()
      .map((category) => category.name);
    expect(names).toEqual(['t:refunds', 't:gifts']);
  });

  it('creates a selected parent together with its children', () => {
    const categories = seed(['groceries']).categories.list();
    const parent = categories.find((category) => category.name === 't:groceries');
    expect(parent?.parentId).toBeNull();
    const children = categories.filter((category) => category.parentId === parent?.id);
    expect(children.map((child) => child.name)).toEqual(['t:supermarket', 't:bakery']);
  });

  it('skips categories the user unselected', () => {
    const names = seed(['utilities'])
      .categories.list()
      .map((category) => category.name);
    expect(names).toContain('t:utilities');
    expect(names).not.toContain('t:groceries');
    expect(names).not.toContain('t:supermarket');
  });

  it('inherits the parent direction for children, so income never mixes with expense', () => {
    const categories = seed(['salary', 'groceries']).categories.list();
    for (const category of categories) {
      const expected =
        category.name === 't:salary' ||
        category.name.startsWith('t:refund') ||
        category.name === 't:gifts'
          ? 'income'
          : 'expense';
      expect(category.direction).toBe(expected);
    }
  });

  it('numbers sortOrder so parents and children keep the catalogue order', () => {
    const categories = seed(['groceries', 'home']).categories.list();
    expect(categories.map((category) => category.name)).toEqual([
      't:groceries',
      't:supermarket',
      't:bakery',
      't:home',
      't:rent',
      't:maintenance',
      't:refunds',
      't:gifts',
    ]);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm --filter mobile test src/db/seed`

- [x] **Step 3: Implement `src/db/seed.ts`**

```ts
import type { CurrencyCode } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import type { Repositories } from './repositories';

/** One row of the §4.2 seed table. `nameKey` resolves through the `seed.*` i18n namespace. */
export interface SeedCategory {
  nameKey: string;
  direction: 'expense' | 'income';
  icon: IconName;
  colorIndex: number;
  children?: readonly Omit<SeedCategory, 'children' | 'direction'>[];
  /**
   * Hidden from the onboarding grid, which shows 12 tiles (§4.2). Hidden rows are always created,
   * because income needs somewhere to land.
   */
  hidden?: true;
}

/** Spec §4.2, in the order the onboarding grid shows them. */
export const SEED_CATEGORIES: readonly SeedCategory[] = [
  {
    nameKey: 'groceries',
    direction: 'expense',
    icon: 'cart',
    colorIndex: 0,
    children: [
      { nameKey: 'supermarket', icon: 'cart', colorIndex: 0 },
      { nameKey: 'bakery', icon: 'apple', colorIndex: 1 },
    ],
  },
  {
    nameKey: 'home',
    direction: 'expense',
    icon: 'house',
    colorIndex: 1,
    children: [
      { nameKey: 'rent', icon: 'key', colorIndex: 1 },
      { nameKey: 'maintenance', icon: 'wrench', colorIndex: 2 },
    ],
  },
  {
    nameKey: 'transport',
    direction: 'expense',
    icon: 'train',
    colorIndex: 2,
    children: [
      { nameKey: 'fuel', icon: 'fuel', colorIndex: 2 },
      { nameKey: 'publicTransport', icon: 'bus', colorIndex: 3 },
    ],
  },
  { nameKey: 'utilities', direction: 'expense', icon: 'zap', colorIndex: 3 },
  { nameKey: 'restaurants', direction: 'expense', icon: 'utensils', colorIndex: 4 },
  { nameKey: 'health', direction: 'expense', icon: 'heart', colorIndex: 5 },
  { nameKey: 'sport', direction: 'expense', icon: 'dumbbell', colorIndex: 6 },
  { nameKey: 'shopping', direction: 'expense', icon: 'bag', colorIndex: 7 },
  { nameKey: 'leisure', direction: 'expense', icon: 'film', colorIndex: 8 },
  { nameKey: 'subscriptions', direction: 'expense', icon: 'monitor', colorIndex: 9 },
  { nameKey: 'education', direction: 'expense', icon: 'cap', colorIndex: 6 },
  { nameKey: 'salary', direction: 'income', icon: 'landmark', colorIndex: 5 },
  { nameKey: 'refunds', direction: 'income', icon: 'arrowDL', colorIndex: 3, hidden: true },
  { nameKey: 'gifts', direction: 'income', icon: 'gift', colorIndex: 7, hidden: true },
];

/** The 12 tiles the onboarding grid offers (§4.2). */
export const PICKABLE_SEED_CATEGORIES = SEED_CATEGORIES.filter(
  (category) => category.hidden !== true,
);

export interface SeedInput {
  cycleStartDay: number;
  currency: CurrencyCode;
  language: 'system' | 'it' | 'en';
  theme: 'system' | 'dark' | 'light';
  account: {
    name: string;
    type: 'cash' | 'checking' | 'credit_card' | 'savings' | 'investment';
    openingBalance: number;
    icon: IconName;
  };
  /** `nameKey`s the user kept selected. Hidden rows are created regardless. */
  selectedCategoryKeys: readonly string[];
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
  completedAt: string;
}

/**
 * Writes what onboarding collected: the settings singleton, the first account, and the selected
 * categories with their children (§4.2, §6.29). Every write goes through a repository, so each row
 * is validated and stamped.
 */
export function seedFromOnboarding(repos: Repositories, input: SeedInput): void {
  repos.settings.create({
    cycleStartDay: input.cycleStartDay,
    currency: input.currency,
    language: input.language,
    theme: input.theme,
    onboardingCompletedAt: input.completedAt,
  });

  repos.accounts.create({
    name: input.account.name,
    type: input.account.type,
    institution: null,
    openingBalance: input.account.openingBalance,
    includeInSpendable: true,
    colorIndex: 0,
    icon: input.account.icon,
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  });

  const selected = new Set(input.selectedCategoryKeys);
  let sortOrder = 0;
  for (const category of SEED_CATEGORIES) {
    if (category.hidden !== true && !selected.has(category.nameKey)) continue;
    const parent = repos.categories.create({
      name: input.translate(category.nameKey),
      direction: category.direction,
      parentId: null,
      icon: category.icon,
      colorIndex: category.colorIndex,
      archivedAt: null,
      sortOrder: sortOrder++,
    });
    for (const child of category.children ?? []) {
      repos.categories.create({
        name: input.translate(child.nameKey),
        direction: category.direction,
        parentId: parent.id,
        icon: child.icon,
        colorIndex: child.colorIndex,
        archivedAt: null,
        sortOrder: sortOrder++,
      });
    }
  }
}
```

- [x] **Step 4: Run the test**

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/db/seed.ts apps/mobile/src/db/seed.test.ts packages/i18n/src/locales
git commit -m "feat(mobile): add the onboarding seed catalogue"
```

---

### Task 11: UI primitives

Spec §6, §13. Everything reads tokens from `useTheme`; no component hard-codes a colour, radius or
size, and every pressable exposes an accessibility role and state (§13).

**Files:** `src/components/{Card,SectionLabel,Button,TextField,Segmented,ProgressBar,AmountText,Keypad,Screen,TabBar,index}.tsx`.

- [x] **Step 1: Write them**

`Card.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps extends ViewProps {
  children: ReactNode;
  /** Cards without padding host their own rows (§6 list cards). */
  padded?: boolean;
}

export function Card({ children, padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.palette.surface,
          borderRadius: theme.radii.card,
          borderWidth: 1,
          borderColor: theme.palette.border,
          padding: padded ? theme.layout.cardPadding : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

`SectionLabel.tsx`:

```tsx
import { Text } from '../theme/Text';

/** Small muted caption above a group (§6). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text size="caption" color="textMuted" weight="medium" style={{ textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}
```

`Button.tsx`:

```tsx
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  loading?: boolean;
}

/** Filled action button. Disabled and loading both block presses (§13 accessibility). */
export function PrimaryButton({ label, loading = false, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled === true || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      {...rest}
      style={({ pressed }) => ({
        minHeight: theme.layout.minHitTarget,
        borderRadius: theme.radii.button,
        backgroundColor: theme.palette.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        opacity: inactive ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={theme.palette.onAccent} />
      ) : (
        <Text weight="medium" color="onAccent" size="headline" tracking="tight">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Outlined action button, used next to a primary one. */
export function SecondaryButton({ label, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      {...rest}
      style={({ pressed }) => ({
        minHeight: theme.layout.minHitTarget,
        borderRadius: theme.radii.button,
        borderWidth: 1,
        borderColor: theme.palette.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        opacity: inactive ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <View>
        <Text weight="medium" size="headline" tracking="tight">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
```

`TextField.tsx`:

```tsx
import { TextInput, type TextInputProps, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.palette.textFaint}
        {...rest}
        style={[
          {
            minHeight: theme.layout.minHitTarget,
            borderRadius: theme.radii.input,
            borderWidth: 1,
            borderColor: theme.palette.border,
            backgroundColor: theme.palette.raised,
            paddingHorizontal: 12,
            color: theme.palette.text,
            fontFamily: 'Geist_400Regular',
            fontSize: theme.fontSize.body,
          },
          style,
        ]}
      />
    </View>
  );
}
```

`Segmented.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Segmented control used by the kind switch, period and alert pickers (§6.16, §6.18). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.palette.raised,
        borderRadius: theme.radii.input,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.chipSmall,
              backgroundColor: selected ? theme.palette.accent : 'transparent',
            }}
          >
            <Text size="footnote" weight="medium" color={selected ? 'onAccent' : 'textMuted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

`ProgressBar.tsx`:

```tsx
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface ProgressBarProps {
  /** 0..1; values above 1 are clamped, the caller decides how to signal "over". */
  ratio: number;
  /** Where the cycle pace sits, drawn as a tick (§5.8). */
  pace?: number;
  overPace?: boolean;
}

export function ProgressBar({ ratio, pace, overPace = false }: ProgressBarProps) {
  const theme = useTheme();
  const width = `${Math.min(1, Math.max(0, ratio)) * 100}%` as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{
        height: theme.layout.progressHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'visible',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width,
          height: theme.layout.progressHeight,
          borderRadius: theme.radii.pill,
          backgroundColor: overPace ? theme.palette.accent : theme.palette.barGrey,
        }}
      />
      {pace === undefined ? null : (
        <View
          style={{
            position: 'absolute',
            left: `${Math.min(1, Math.max(0, pace)) * 100}%`,
            top: -theme.layout.paceTickOverhang,
            width: 1,
            height: theme.layout.progressHeight + theme.layout.paceTickOverhang * 2,
            backgroundColor: theme.palette.textFaint,
          }}
        />
      )}
    </View>
  );
}
```

`AmountText.tsx`:

```tsx
import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoneyParts, type SignDisplay } from '@saldo/i18n';
import { Text as RnText } from 'react-native';
import { Text, type TextProps } from '../theme/Text';

export interface AmountTextProps extends Omit<TextProps, 'children' | 'tabular'> {
  minor: number;
  currency: CurrencyCode;
  locale: AppLocale;
  signDisplay?: SignDisplay;
}

/**
 * Money split as the design renders it: the fraction and the symbol sit at 50% opacity (§5.1),
 * with tabular figures so columns line up.
 */
export function AmountText({
  minor,
  currency,
  locale,
  signDisplay = 'negative',
  ...rest
}: AmountTextProps) {
  const parts = formatMoneyParts(minor, currency, locale, signDisplay);
  const tail =
    parts.fraction === ''
      ? ` ${parts.symbol}`
      : `${parts.decimalSeparator}${parts.fraction} ${parts.symbol}`;
  const prefix = parts.symbolPosition === 'prefix' ? parts.symbol : '';
  return (
    <Text {...rest} tabular>
      {`${parts.sign}${prefix}${parts.integer}`}
      <RnText style={{ opacity: 0.5 }}>
        {parts.symbolPosition === 'prefix'
          ? parts.fraction === ''
            ? ''
            : `${parts.decimalSeparator}${parts.fraction}`
          : tail}
      </RnText>
    </Text>
  );
}
```

`Keypad.tsx` — **superseded in phase 03 (D23)**: amounts are now typed on the device keyboard, so this
component was replaced by `AmountInput.tsx`. Skip it if you are building the app fresh:

```tsx
import { type AmountKey, type MinorDigits, pressAmountKey } from '@saldo/core';
import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface KeypadProps {
  /** Locale-agnostic buffer using `.`; the key label shows `,` or `.` (§5.1). */
  buffer: string;
  onChange: (buffer: string) => void;
  minorDigits: MinorDigits;
  decimalSeparator: ',' | '.';
  saveLabel: string;
  onSave?: () => void;
  saveDisabled?: boolean;
}

const DIGITS: readonly AmountKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export function Keypad({
  buffer,
  onChange,
  minorDigits,
  decimalSeparator,
  saveLabel,
  onSave,
  saveDisabled = false,
}: KeypadProps) {
  const theme = useTheme();
  const press = (key: AmountKey) => onChange(pressAmountKey(buffer, key, minorDigits));

  const keyStyle = {
    flex: 1,
    height: theme.layout.keypadKeyHeight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.raised,
  };

  return (
    <View style={{ gap: 6 }}>
      {DIGITS.map((row) => (
        <View key={row.join('')} style={{ flexDirection: 'row', gap: 6 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key}
              onPress={() => press(key)}
              style={keyStyle}
            >
              <Text size="amountKey" weight="medium" tabular>
                {key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {minorDigits === 0 ? (
          // A currency without a minor unit has no decimal key at all (§5.1).
          <View style={keyStyle} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={decimalSeparator}
            onPress={() => press('decimal')}
            style={keyStyle}
          >
            <Text size="amountKey" weight="medium">
              {decimalSeparator}
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="0"
          onPress={() => press('0')}
          style={keyStyle}
        >
          <Text size="amountKey" weight="medium" tabular>
            0
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="delete"
          onPress={() => press('del')}
          style={keyStyle}
        >
          <Icon name="del" size={20} color={theme.palette.text} />
        </Pressable>
      </View>
      {onSave === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled }}
          disabled={saveDisabled}
          onPress={onSave}
          style={{
            height: theme.layout.keypadKeyHeight,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.input,
            backgroundColor: theme.palette.accent,
            opacity: saveDisabled ? 0.4 : 1,
          }}
        >
          <Text weight="medium" color="onAccent" size="headline">
            {saveLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

`Screen.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export interface ScreenProps {
  children: ReactNode;
  /** Screens with their own list use `scroll={false}` (§6). */
  scroll?: boolean;
  /** Onboarding pins its buttons to the bottom instead of scrolling them away. */
  footer?: ReactNode;
}

/** Screen frame: theme background, safe-area insets and the §6 horizontal padding. */
export function Screen({ children, scroll = true, footer }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingHorizontal: theme.layout.screenPaddingX,
    paddingTop: insets.top + 8,
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ ...padding, paddingBottom: 24, gap: theme.layout.cardGap }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, ...padding, gap: theme.layout.cardGap }}>{children}</View>
      )}
      {footer === undefined ? null : (
        <View
          style={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            gap: 8,
          }}
        >
          {footer}
        </View>
      )}
    </View>
  );
}
```

`TabBar.tsx` — the props are typed **structurally**, not imported from
`@react-navigation/bottom-tabs`: expo-router 57 vendors its own copy of those types, and the two
are not assignable to each other. Do not install that package.

```tsx
import type { IconName } from '@saldo/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

const ICONS: Record<string, IconName> = {
  index: 'house',
  transactions: 'list',
  stats: 'trend',
  accounts: 'wallet',
};

/**
 * Only what the tab bar reads. expo-router 57 vendors its own copy of the react-navigation types,
 * so importing `BottomTabBarProps` from `@react-navigation/bottom-tabs` gives a second, subtly
 * different type; a structural type keeps this component independent of either.
 */
export interface TabBarProps {
  state: { index: number; routes: readonly { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
  onFabPress: () => void;
}

/**
 * Custom tab bar of §6.14: height 78 plus the bottom inset, with the FAB raised 16px over the
 * middle. The FAB is part of the bar so it keeps its place on every tab.
 */
export function TabBar({ state, navigation, onFabPress }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const half = Math.ceil(state.routes.length / 2);

  const renderTab = (route: { key: string; name: string }, index: number) => {
    const focused = state.index === index;
    const icon = ICONS[route.name] ?? 'list';
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => navigation.navigate(route.name)}
        style={{ flex: 1, alignItems: 'center', gap: 5, paddingTop: 12 }}
      >
        <Icon
          name={icon}
          size={20}
          color={focused ? theme.palette.text : theme.palette.textFaint}
        />
        <Text size="caption" color={focused ? 'text' : 'textFaint'}>
          {route.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        height: theme.layout.tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.palette.bg,
        borderTopWidth: 1,
        borderTopColor: theme.palette.border,
      }}
    >
      {state.routes.slice(0, half).map(renderTab)}
      <View style={{ width: theme.layout.fabSize + 16, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="new-transaction"
          onPress={onFabPress}
          style={{
            position: 'absolute',
            top: -theme.layout.fabLift,
            width: theme.layout.fabSize,
            height: theme.layout.fabSize,
            borderRadius: theme.radii.fab,
            backgroundColor: theme.palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={24} color={theme.palette.onAccent} />
        </Pressable>
      </View>
      {state.routes.slice(half).map((route, index) => renderTab(route, index + half))}
    </View>
  );
}
```

`index.ts`:

```ts
export * from './AmountText';
export * from './Button';
export * from './Card';
export * from './Keypad';
export * from './ProgressBar';
export * from './Screen';
export * from './SectionLabel';
export * from './Segmented';
export * from './TabBar';
export * from './TextField';
```

- [x] **Step 2: Typecheck and commit**

```bash
pnpm --filter mobile typecheck
git add apps/mobile/src/components
git commit -m "feat(mobile): add the UI primitives"
```

---

### Task 12: Routes, tab shell and onboarding

Spec §6 navigation tree, §6.14, §6.29 steps 1–3, §6.32.

Theme and language live in `settings`, which lives in the database, so the provider stack is
bootstrapped with system defaults and then re-provided from settings once the row exists; nested
providers mean the inner values win.

**Files:** `app/_layout.tsx`, `app/index.tsx`, `app/lock.tsx`, `app/(tabs)/*`,
`app/(onboarding)/*`, `src/features/onboarding/state.tsx`, `src/features/lock/*`.

- [x] **Step 1: `app/_layout.tsx`**

```tsx
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  useFonts,
} from '@expo-google-fonts/geist';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { i18n as I18nInstance } from 'i18next';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '../src/db/DatabaseProvider';
import { useSettings } from '../src/db/hooks';
import { createI18n } from '../src/i18n';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden on a fast reload; nothing to recover from.
});

/**
 * Theme and language both live in `settings`, which lives in the database — so the tree is
 * bootstrapped with system defaults, then re-provided from settings once the row exists. Nested
 * providers mean the inner values win.
 */
function SettingsScopedProviders({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [i18n, setI18n] = useState<I18nInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    createI18n(settings?.language ?? 'system').then((instance) => {
      if (!cancelled) setI18n(instance);
    });
    return () => {
      cancelled = true;
    };
  }, [settings?.language]);

  if (i18n === null) return null;
  return (
    <ThemeProvider preference={settings?.theme ?? 'system'}>
      <I18nextProvider i18n={i18n}>
        <ThemedStatusBar />
        {children}
      </I18nextProvider>
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const theme = useTheme();
  // §13: the status bar follows the theme.
  return <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />;
}

function Ready({ children }: { children: ReactNode }) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Already hidden.
    });
  }, []);
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference="system">
          <DatabaseProvider>
            <SettingsScopedProviders>
              <Ready>
                <Stack screenOptions={{ headerShown: false }} />
              </Ready>
            </SettingsScopedProviders>
          </DatabaseProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [x] **Step 2: `app/index.tsx`**

```tsx
import { Redirect } from 'expo-router';
import { useDatabase } from '../src/db/DatabaseProvider';
import { useSettings } from '../src/db/hooks';

/**
 * Boot router: the lock screen wins over everything, then onboarding until settings exist with a
 * completion stamp (§6.29, §6.32).
 */
export default function Boot() {
  const settings = useSettings();
  const { kv } = useDatabase();
  const locked = kv.get('appLockEnabled') === 'true';

  if (locked) return <Redirect href="/lock" />;
  if (settings === null || settings.onboardingCompletedAt === null) {
    return <Redirect href="/cycle-day" />;
  }
  return <Redirect href="/(tabs)" />;
}
```

- [x] **Step 3: `app/(tabs)/_layout.tsx` and the four placeholder tabs**

```tsx
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TabBar } from '../../src/components/TabBar';
import { useAppLock } from '../../src/features/lock/useAppLock';

export default function TabsLayout() {
  const { t } = useTranslation();
  useAppLock();
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...props}
          onFabPress={() => {
            // The new-transaction sheet arrives in phase 03.
          }}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="transactions" options={{ title: t('tabs.transactions') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats') }} />
      <Tabs.Screen name="accounts" options={{ title: t('tabs.accounts') }} />
    </Tabs>
  );
}
```

Each tab is the same shape; `index.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/theme/Text';

export default function HomeTab() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('tabs.home')}
      </Text>
      <Card>
        <Text color="textMuted">{t('placeholders.homeSoon')}</Text>
        <Text color="textFaint" size="footnote" style={{ marginTop: 6 }}>
          {t('placeholders.comingSoon')}
        </Text>
      </Card>
    </Screen>
  );
}
```

Repeat for `transactions.tsx`, `stats.tsx` and `accounts.tsx`, changing the component name and the
two i18n keys (`tabs.transactions` / `placeholders.transactionsSoon`, and so on).

- [x] **Step 4: The onboarding draft**

```tsx
import type { CurrencyCode } from '@saldo/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

/** What the three onboarding steps collect before anything is written (§6.29). */
export interface OnboardingDraft {
  cycleStartDay: number;
  currency: CurrencyCode;
  accountName: string;
  accountType: 'cash' | 'checking' | 'credit_card' | 'savings' | 'investment';
  /** Keypad buffer, converted to minor units on save. */
  balanceBuffer: string;
  selectedCategoryKeys: string[];
}

export interface OnboardingValue {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
}

const INITIAL: OnboardingDraft = {
  cycleStartDay: 27,
  currency: 'EUR',
  accountName: '',
  accountType: 'checking',
  balanceBuffer: '',
  selectedCategoryKeys: [],
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setState] = useState<OnboardingDraft>(INITIAL);
  const value = useMemo<OnboardingValue>(
    () => ({
      draft,
      setDraft: (patch) => setState((current) => ({ ...current, ...patch })),
    }),
    [draft],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (value === null) throw new Error('useOnboarding must be used inside an OnboardingProvider');
  return value;
}
```

- [x] **Step 5: `app/(onboarding)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/features/onboarding/state';

/** The three steps share one draft; nothing is written until "Inizia" (§6.29). */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
```

- [x] **Step 6: Step 1 — cycle day**

```tsx
import { cycleContaining, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

/** §6.29 step 1: the 7-column day grid with the "your month runs from X to Y" timeline. */
export default function CycleDayStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [day, setDay] = useState(draft.cycleStartDay);
  const cycle = cycleContaining(todayLocal(), day);
  const locale = i18n.language === 'it' ? 'it' : 'en';

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.continue')}
          onPress={() => {
            setDraft({ cycleStartDay: day });
            router.push('/first-account');
          }}
        />
      }
    >
      <ProgressBar ratio={1 / 3} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 1, total: 3 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.cycleTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.cycleBody')}</Text>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((value) => {
            const selected = value === day;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={String(value)}
                onPress={() => setDay(value)}
                style={{
                  width: `${100 / 7}%`,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.chipSmall,
                  backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                }}
              >
                <Text tabular color={selected ? 'onAccent' : 'text'}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Text color="textMuted" size="footnote">
        {t('onboarding.cycleTimeline', {
          start: formatDayMonth(cycle.start, locale),
          end: formatDayMonth(cycle.end, locale),
        })}
      </Text>
    </Screen>
  );
}
```

- [x] **Step 7: Step 2 — account details**

> **Changed in phase 03:** this step was split in two — account details here, balance and currency in
> `balance.tsx` — so each screen asks one thing (spec §6.29). Onboarding has four steps.

```tsx
import {
  amountBufferToMinor,
  COMMON_CURRENCY_CODES,
  type CurrencyCode,
  getCurrency,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Keypad } from '../../src/components/Keypad';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { Segmented } from '../../src/components/Segmented';
import { TextField } from '../../src/components/TextField';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const TYPES = ['cash', 'checking', 'credit_card', 'savings'] as const;

/** §6.29 step 2: name, type, balance keypad and currency picker. */
export default function FirstAccountStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [name, setName] = useState(draft.accountName);
  const [type, setType] = useState(draft.accountType);
  const [buffer, setBuffer] = useState(draft.balanceBuffer);
  const [currency, setCurrency] = useState<CurrencyCode>(draft.currency);
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const { minorDigits } = getCurrency(currency);

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.continue')}
          onPress={() => {
            setDraft({
              accountName: name.trim(),
              accountType: type,
              balanceBuffer: buffer,
              currency,
            });
            router.push('/categories');
          }}
        />
      }
    >
      <ProgressBar ratio={2 / 3} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 2, total: 3 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.accountTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.accountBody')}</Text>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('onboarding.accountName')}
            placeholder={t('onboarding.accountNamePlaceholder')}
            value={name}
            onChangeText={setName}
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('onboarding.accountType')}
            </Text>
            <Segmented
              accessibilityLabel={t('onboarding.accountType')}
              options={TYPES.map((value) => ({ value, label: t(`accountTypes.${value}`) }))}
              value={type}
              onChange={setType}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('onboarding.accountCurrency')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {COMMON_CURRENCY_CODES.map((code) => {
                const selected = code === currency;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCurrency(code)}
                    style={{
                      flex: 1,
                      height: 38,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radii.chipSmall,
                      backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                    }}
                  >
                    <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                      {code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('onboarding.accountBalance')}
        </Text>
        <Text size="amountLg" weight="semibold" tracking="tighter" tabular style={{ marginTop: 4 }}>
          {formatMoney(amountBufferToMinor(buffer, minorDigits), currency, locale)}
        </Text>
        <View style={{ marginTop: 12 }}>
          <Keypad
            buffer={buffer}
            onChange={setBuffer}
            minorDigits={minorDigits}
            decimalSeparator={locale === 'it' ? ',' : '.'}
            saveLabel={t('common.done')}
          />
        </View>
      </Card>
    </Screen>
  );
}
```

- [x] **Step 8: Step 3 — categories, which writes everything**

```tsx
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { PICKABLE_SEED_CATEGORIES, seedFromOnboarding } from '../../src/db/seed';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.29 step 3: the 12-tile grid, all selected by default; "Inizia" writes everything. */
export default function CategoriesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const { draft } = useOnboarding();
  const [selected, setSelected] = useState<string[]>(
    PICKABLE_SEED_CATEGORIES.map((category) => category.nameKey),
  );
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  const finish = () => {
    setSaving(true);
    const { minorDigits } = getCurrency(draft.currency);
    seedFromOnboarding(repos, {
      cycleStartDay: draft.cycleStartDay,
      currency: draft.currency,
      language: 'system',
      theme: 'system',
      account: {
        name: draft.accountName.length > 0 ? draft.accountName : t('seed.firstAccount'),
        type: draft.accountType,
        openingBalance: amountBufferToMinor(draft.balanceBuffer, minorDigits),
        icon: 'landmark',
      },
      selectedCategoryKeys: selected,
      translate: (key) => t(`seed.${key}`),
      completedAt: new Date().toISOString(),
    });
    router.replace('/(tabs)');
  };

  return (
    <Screen footer={<PrimaryButton label={t('common.start')} loading={saving} onPress={finish} />}>
      <ProgressBar ratio={1} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 3, total: 3 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.categoriesTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.categoriesBody')}</Text>
      <Text size="footnote" color="textFaint">
        {t('onboarding.categoriesSelected', { count: selected.length })}
      </Text>
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
    </Screen>
  );
}
```

- [x] **Step 9: The lock screen and its background rule**

`src/features/lock/relock.ts` has no React Native imports, so the 60-second rule is testable in the
Node project:

```ts
/** §6.32: re-lock after this long in the background. */
export const LOCK_AFTER_BACKGROUND_MS = 60_000;

/**
 * Whether the app should re-lock, given how long it spent in the background. Kept in its own
 * module with no React Native imports, so the 60-second rule is testable in plain Node.
 */
export function shouldRelock(
  enabled: boolean,
  backgroundedAt: number | null,
  now: number,
  thresholdMs: number = LOCK_AFTER_BACKGROUND_MS,
): boolean {
  if (!enabled || backgroundedAt === null) return false;
  return now - backgroundedAt >= thresholdMs;
}
```

```ts
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { shouldRelock } from './relock';

export { LOCK_AFTER_BACKGROUND_MS, shouldRelock } from './relock';

/**
 * Sends the app to the lock screen when it returns from more than a minute in the background
 * (§6.32). Cold starts are handled by the boot router, which checks the same flag.
 */
export function useAppLock(): void {
  const router = useRouter();
  const { kv } = useDatabase();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = (status: AppStateStatus): void => {
      const enabled = kv.get('appLockEnabled') === 'true';
      if (status === 'background' || status === 'inactive') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      if (status === 'active') {
        if (shouldRelock(enabled, backgroundedAt.current, Date.now())) router.replace('/lock');
        backgroundedAt.current = null;
      }
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [kv, router]);
}
```

```tsx
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../src/components/Button';
import { Screen } from '../src/components/Screen';
import { Icon } from '../src/theme/Icon';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

/** §6.32: prompts biometrics on mount and falls back to the device passcode. */
export default function LockScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  const authenticate = useCallback(async () => {
    setFailed(false);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('lock.unlock'),
      // Falling back to the passcode keeps the app reachable when biometrics are unavailable.
      disableDeviceFallback: false,
    });
    if (result.success) router.replace('/(tabs)');
    else setFailed(true);
  }, [router, t]);

  useEffect(() => {
    authenticate().catch(() => setFailed(true));
  }, [authenticate]);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Icon name="shield" size={40} color={theme.palette.textMuted} />
        <Text size="title" weight="semibold" tracking="tighter">
          {t('lock.title')}
        </Text>
        {failed ? (
          <Text size="footnote" color="textMuted">
            {t('lock.failed')}
          </Text>
        ) : null}
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 24 }}>
          <PrimaryButton
            label={t('lock.unlock')}
            onPress={() => {
              authenticate().catch(() => setFailed(true));
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
```

- [x] **Step 10: Test the rule**

```ts
import { LOCK_AFTER_BACKGROUND_MS, shouldRelock } from './relock';

describe('shouldRelock', () => {
  const now = 1_775_000_060_000;

  it('never locks when the setting is off', () => {
    expect(shouldRelock(false, now - LOCK_AFTER_BACKGROUND_MS * 2, now)).toBe(false);
  });

  it('never locks when the app was not backgrounded', () => {
    expect(shouldRelock(true, null, now)).toBe(false);
  });

  it('locks only past the threshold', () => {
    expect(shouldRelock(true, now - LOCK_AFTER_BACKGROUND_MS + 1, now)).toBe(false);
    expect(shouldRelock(true, now - LOCK_AFTER_BACKGROUND_MS, now)).toBe(true);
    expect(shouldRelock(true, now - LOCK_AFTER_BACKGROUND_MS * 10, now)).toBe(true);
  });

  it('uses a minute by default', () => {
    expect(LOCK_AFTER_BACKGROUND_MS).toBe(60_000);
  });
});
```

Add `<rootDir>/src/features/**/*.test.ts` to the `db` project's `testMatch`.

- [x] **Step 11: Commit**

```bash
git add apps/mobile/app apps/mobile/src/features
git commit -m "feat(mobile): add the app shell, onboarding steps and lock screen"
```

---

### Task 13: Demo data seeder

Spec §7 dev seed. Ports the prototype's mock data and shifts it so the current cycle contains today.

**Files:** `scripts/generate-demo-data.mjs`, generated `src/db/demoData.generated.ts`,
`src/db/demo.ts`, test `src/db/demo.test.ts`.

- [x] **Step 1: Write the generator**

```js
/**
 * Regenerates `src/db/demoData.generated.ts` from the mock data in the design prototype.
 *
 * Run with: pnpm --filter mobile generate:demo
 *
 * `docs/design` is gitignored, so the generated file is the committed artefact and this script only
 * runs on a machine that has the prototype. Row format in the prototype:
 * `[date, description, categoryName, accountName, amountEuros, isIncome?, isExcluded?, tags?]`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DESIGN = join(here, '..', '..', '..', 'docs', 'design', 'Spese.dc.html');
const OUT = join(here, '..', 'src', 'db', 'demoData.generated.ts');

const FIRST_LINE = 'const CYCLES = [';
const LAST_CONST = 'const TAG_EXTRA = [';

const html = readFileSync(DESIGN, 'utf8').split('\n');
const start = html.findIndex((line) => line.startsWith(FIRST_LINE));
const tagStart = html.findIndex((line) => line.startsWith(LAST_CONST));
if (start < 0 || tagStart < 0) throw new Error('Could not find the mock data block');
const end = html.findIndex((line, index) => index > tagStart && line.startsWith('];'));

const block = html.slice(start, end + 1).join('\n');
const evaluate = new Function(`${block}\nreturn { CYCLES, ACCOUNTS, BUDGETS, TAG_EXTRA };`);
const { CYCLES, ACCOUNTS, BUDGETS, TAG_EXTRA } = evaluate();

/** Prototype category name -> `seed.*` key of §4.2. */
const CATEGORY_KEYS = {
  Spesa: 'groceries',
  Casa: 'home',
  Trasporti: 'transport',
  Utenze: 'utilities',
  Ristoranti: 'restaurants',
  Salute: 'health',
  Sport: 'sport',
  Shopping: 'shopping',
  'Tempo libero': 'leisure',
  Abbonamenti: 'subscriptions',
  Formazione: 'education',
  Entrate: 'salary',
};

/** Descriptions the prototype treats as recurring (its RECUR_T list). */
const RECURRING = [
  'Affitto',
  'Trenord abbonamento',
  'Netflix',
  'Spotify',
  'iCloud',
  'Palestra Virgin',
  'Enel bimestrale',
  'Vodafone',
  'MM acqua',
  'Assicurazione auto',
  'Rata lavatrice',
  'Sky Sport',
];

const toMinor = (euros) => Math.round(euros * 100);

function normalise(row) {
  const [date, description, category, account, amount, income = 0, excluded = 0, tags = []] = row;
  const key = CATEGORY_KEYS[category];
  if (key === undefined) throw new Error(`Unmapped category: ${category}`);
  return {
    date,
    description,
    categoryKey: key,
    account,
    amount: toMinor(amount),
    kind: income === 1 ? 'income' : 'expense',
    excluded: excluded === 1,
    tags,
    recurring: RECURRING.some((template) => description.startsWith(template)),
  };
}

const transactions = [...CYCLES.flatMap((cycle) => cycle.tx), ...TAG_EXTRA].map(normalise);
const accounts = ACCOUNTS.map((account) => ({
  name: account.name,
  institution: account.kind,
  icon: account.icon,
  balance: toMinor(account.bal),
  credit: account.credit === true,
  closeDay: account.closeDay ?? null,
  chargeDay: account.chargeDay ?? null,
  investment: account.grp === 1,
}));
const budgets = BUDGETS.map((budget) => ({
  categoryKey: CATEGORY_KEYS[budget.name],
  amount: toMinor(budget.total),
}));
const tags = [...new Set(transactions.flatMap((tx) => tx.tags))];

const json = (value) => JSON.stringify(value, null, 2).replace(/"([A-Za-z_]\w*)":/g, '$1:');

writeFileSync(
  OUT,
  `// Generated by scripts/generate-demo-data.mjs from the design prototype. Do not edit by hand.
// The prototype lives in the gitignored docs/design, so this file is the committed artefact.

/** The reference cycle of the prototype; the seeder shifts every date so today falls inside it. */
export const DEMO_REFERENCE_CYCLE = ${json({ start: CYCLES[0].start, end: CYCLES[0].end, today: CYCLES[0].today })} as const;

export interface DemoTransaction {
  date: string;
  description: string;
  /** Key of the \`seed.*\` catalogue (§4.2). */
  categoryKey: string;
  account: string;
  amount: number;
  kind: 'expense' | 'income';
  excluded: boolean;
  tags: string[];
  recurring: boolean;
}

export const DEMO_TRANSACTIONS: readonly DemoTransaction[] = ${json(transactions)};

export const DEMO_ACCOUNTS = ${json(accounts)} as const;

export const DEMO_BUDGETS = ${json(budgets)} as const;

export const DEMO_TAGS = ${json(tags)} as const;
`,
  'utf8',
);

console.log(
  `Wrote ${transactions.length} transactions, ${accounts.length} accounts, ${budgets.length} budgets, ${tags.length} tags`,
);
```

Add `"generate:demo": "node scripts/generate-demo-data.mjs"` to the app's scripts.

- [x] **Step 2: Generate and format**

```bash
pnpm --filter mobile generate:demo
pnpm exec biome check --write apps/mobile/src/db/demoData.generated.ts
```

Expected: `Wrote 92 transactions, 6 accounts, 5 budgets, 4 tags`. `docs/design` is gitignored, so
the generated file is the committed artefact and cannot be reproduced from a clean clone.

- [x] **Step 3: Write the failing test**

```ts
import {
  accountBalances,
  cycleContaining,
  isWithin,
  spendingByCategory,
  summarizePeriod,
} from '@saldo/core';
import { seedDemoData } from './demo';
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from './demoData.generated';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

const TODAY = '2026-09-10';
const CYCLE_START_DAY = 27;

function seed(today = TODAY) {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => '2026-09-10T09:00:00.000Z');
  seedDemoData(repos, {
    today,
    cycleStartDay: CYCLE_START_DAY,
    translate: (key) => key,
  });
  return repos;
}

describe('seedDemoData', () => {
  it('creates the prototype accounts, categories, tags and budgets', () => {
    const repos = seed();
    expect(repos.accounts.list()).toHaveLength(DEMO_ACCOUNTS.length);
    expect(repos.transactions.list()).toHaveLength(DEMO_TRANSACTIONS.length);
    expect(
      repos.tags
        .list()
        .map((tag) => tag.name)
        .sort(),
    ).toEqual(['Regalo', 'Rimborsabile', 'Trasloco', 'Vacanza Grecia']);
    expect(repos.budgets.list()).toHaveLength(5);
  });

  it('shifts the data so the current cycle holds transactions on both sides of today', () => {
    const repos = seed();
    const cycle = cycleContaining(TODAY, CYCLE_START_DAY);
    const inCycle = repos.transactions.list().filter((tx) => isWithin(cycle, tx.date));
    expect(inCycle.length).toBeGreaterThan(20);
    expect(inCycle.some((tx) => tx.date < TODAY)).toBe(true);
    expect(inCycle.some((tx) => tx.date > TODAY)).toBe(true);
  });

  it('gives every account the balance the prototype shows', () => {
    const repos = seed();
    const accounts = repos.accounts.list();
    const balances = accountBalances(accounts, repos.transactions.list(), '2099-12-31');
    for (const account of DEMO_ACCOUNTS) {
      const created = accounts.find((candidate) => candidate.name === account.name);
      expect(created).toBeDefined();
      expect(balances.get(created?.id ?? '')).toBe(account.balance);
    }
  });

  it('produces a cycle with income, spending and a committed share', () => {
    const repos = seed();
    const cycle = cycleContaining(TODAY, CYCLE_START_DAY);
    const summary = summarizePeriod(repos.transactions.list(), cycle, TODAY);
    expect(summary.income).toBeGreaterThan(0);
    expect(summary.spent).toBeGreaterThan(0);
    expect(summary.remaining).toBe(summary.income - summary.spent);
    const committed = repos.transactions
      .list()
      .filter((tx) => tx.recurrenceId !== null && isWithin(cycle, tx.date));
    expect(committed.length).toBeGreaterThan(0);
  });

  it('spreads spending over several categories, so the split bar is not one segment', () => {
    const repos = seed();
    const cycle = cycleContaining(TODAY, CYCLE_START_DAY);
    const spending = spendingByCategory(repos.transactions.list(), cycle, TODAY);
    expect(spending.size).toBeGreaterThan(4);
  });

  it('keeps the excluded transactions excluded', () => {
    const repos = seed();
    const excluded = repos.transactions.list().filter((tx) => tx.excludeFromTotals);
    expect(excluded).toHaveLength(DEMO_TRANSACTIONS.filter((tx) => tx.excluded).length);
  });

  it('shifts with the cycle, whatever today is', () => {
    for (const today of ['2026-01-05', '2026-09-10', '2027-02-28'] as const) {
      const repos = seed(today);
      const cycle = cycleContaining(today, CYCLE_START_DAY);
      const inCycle = repos.transactions.list().filter((tx) => isWithin(cycle, tx.date));
      expect(inCycle.length).toBeGreaterThan(20);
    }
  });
});
```

- [x] **Step 4: Implement `src/db/demo.ts`**

```ts
import { addDays, cycleContaining, diffDays, type LocalDate } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import {
  DEMO_ACCOUNTS,
  DEMO_BUDGETS,
  DEMO_REFERENCE_CYCLE,
  DEMO_TAGS,
  DEMO_TRANSACTIONS,
} from './demoData.generated';
import type { Repositories } from './repositories';
import { SEED_CATEGORIES } from './seed';

export interface DemoSeedInput {
  today: LocalDate;
  cycleStartDay: number;
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
}

/**
 * Dev-only seeder (§7): the design prototype's mock data, shifted so the current cycle contains
 * today. The whole set moves by one offset, which keeps every relative distance — a transaction
 * three days after the cycle start stays three days after it.
 */
function dateShift(today: LocalDate, cycleStartDay: number): number {
  const currentStart = cycleContaining(today, cycleStartDay).start;
  return diffDays(DEMO_REFERENCE_CYCLE.start, currentStart);
}

/**
 * Loads the demo data. Categories come from the §4.2 catalogue so names follow the user's
 * language; accounts get an opening balance chosen so their computed balance matches the
 * prototype's.
 *
 * Recurring transactions carry a synthetic `recurrenceId` so the committed share of §5.7 is not
 * flat, but the `Recurrence` rows themselves arrive with phase 03, which owns that repository.
 * §8.1 already requires the UI to tolerate a dangling reference.
 */
export function seedDemoData(repos: Repositories, input: DemoSeedInput): void {
  const shift = dateShift(input.today, input.cycleStartDay);

  const categoryIdByKey = new Map<string, string>();
  let sortOrder = 0;
  for (const category of SEED_CATEGORIES) {
    const parent = repos.categories.create({
      name: input.translate(category.nameKey),
      direction: category.direction,
      parentId: null,
      icon: category.icon,
      colorIndex: category.colorIndex,
      archivedAt: null,
      sortOrder: sortOrder++,
    });
    categoryIdByKey.set(category.nameKey, parent.id);
    for (const child of category.children ?? []) {
      const created = repos.categories.create({
        name: input.translate(child.nameKey),
        direction: category.direction,
        parentId: parent.id,
        icon: child.icon,
        colorIndex: child.colorIndex,
        archivedAt: null,
        sortOrder: sortOrder++,
      });
      categoryIdByKey.set(child.nameKey, created.id);
    }
  }

  const tagIdByName = new Map<string, string>();
  for (const name of DEMO_TAGS) {
    tagIdByName.set(name, repos.tags.create({ name }).id);
  }

  // An account's opening balance is whatever makes its closing balance match the prototype.
  const netByAccount = new Map<string, number>();
  for (const tx of DEMO_TRANSACTIONS) {
    const signed = tx.kind === 'income' ? tx.amount : -tx.amount;
    netByAccount.set(tx.account, (netByAccount.get(tx.account) ?? 0) + signed);
  }

  const accountIdByName = new Map<string, string>();
  DEMO_ACCOUNTS.forEach((account, index) => {
    const created = repos.accounts.create({
      name: account.name,
      type: account.credit ? 'credit_card' : account.investment ? 'investment' : 'checking',
      institution: account.institution,
      openingBalance: account.balance - (netByAccount.get(account.name) ?? 0),
      includeInSpendable: !account.investment,
      colorIndex: index % 10,
      icon: account.icon as IconName,
      creditCloseDay: account.closeDay,
      creditChargeDay: account.chargeDay,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: index,
    });
    accountIdByName.set(account.name, created.id);
  });

  for (const tx of DEMO_TRANSACTIONS) {
    const accountId = accountIdByName.get(tx.account);
    const categoryId = categoryIdByKey.get(tx.categoryKey);
    if (accountId === undefined || categoryId === undefined) continue;
    repos.transactions.create({
      kind: tx.kind,
      amount: tx.amount,
      date: addDays(tx.date, shift),
      accountId,
      toAccountId: null,
      categoryId,
      description: tx.description,
      note: null,
      tagIds: tx.tags.flatMap((name) => {
        const id = tagIdByName.get(name);
        return id === undefined ? [] : [id];
      }),
      excludeFromTotals: tx.excluded,
      recurrenceId: tx.recurring ? `demo-recurrence:${tx.description}` : null,
    });
  }

  DEMO_BUDGETS.forEach((budget, index) => {
    const categoryId = categoryIdByKey.get(budget.categoryKey);
    if (categoryId === undefined) return;
    repos.budgets.create({
      name: input.translate(budget.categoryKey),
      categoryIds: [categoryId],
      amount: budget.amount,
      period: 'cycle',
      alertThreshold: 90,
      rollover: false,
      icon: SEED_CATEGORIES.find((c) => c.nameKey === budget.categoryKey)?.icon ?? 'target',
      sortOrder: index,
    });
  });
}
```

- [x] **Step 5: Run the tests and commit**

```bash
pnpm --filter mobile test src/db/demo
git add apps/mobile/scripts apps/mobile/src/db/demo.ts apps/mobile/src/db/demo.test.ts apps/mobile/src/db/demoData.generated.ts
git commit -m "feat(mobile): add the demo data seeder"
```

---

### Task 14: Verify the phase

Roadmap acceptance: fresh install → onboarding → tabs visible in dark and light, it and en; data
persists across restarts; repository tests pass; `expo run:android` and `expo run:ios` launch.

- [x] **Step 1: The whole pipeline from the repo root**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: lint clean, typecheck clean, four turbo tasks green (`@saldo/core`, `@saldo/ui`,
`@saldo/i18n`, `mobile`). `mobile` runs two Jest projects, `db` and `app`.

Jest caches transforms aggressively; if a suite fails right after you move a file between projects,
run `pnpm --filter mobile exec jest --clearCache` before believing it.

- [x] **Step 2: Bundle for real**

```bash
pnpm --filter mobile exec expo export --platform ios --output-dir /tmp/saldo-export
ls /tmp/saldo-export/_expo/static/js/ios/
```

Expected: an `entry-*.hbc` of a few MB. Check the directory, not the exit code.

- [x] **Step 3: Run on a simulator**

```bash
pnpm --filter mobile exec expo prebuild --platform ios --clean
pnpm --filter mobile exec expo run:ios
```

Expected: Build Succeeded, then `iOS Bundled … (2187 modules)` and onboarding step 1 on screen.
Toggle the simulator appearance (`xcrun simctl ui <device> appearance dark`) and relaunch to check
both palettes.

- [ ] **Step 4: Android**

`expo run:android` needs the Android SDK (`ANDROID_HOME`, platform tools). **Not verified** on the
machine this phase was implemented on — no SDK installed. Run it before calling the phase done on
a machine that has one.

---
