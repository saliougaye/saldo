# Mobile shell & local database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

- [ ] **Step 1: Write the failing test `packages/core/src/sync/hlc.test.ts`**

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

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @saldo/core exec vitest run src/sync/hlc.test.ts`
Expected: FAIL, because Vitest can't resolve the import `./hlc`.

- [ ] **Step 3: Implement `packages/core/src/sync/hlc.ts`**

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @saldo/core exec vitest run src/sync/hlc.test.ts`
Expected: PASS.

- [ ] **Step 5: Export it from the package**

Add to `packages/core/src/index.ts`, keeping the list alphabetical:

```ts
export * from './stats';
export * from './sync/hlc';
```

- [ ] **Step 6: Verify the package**

Run: `pnpm --filter @saldo/core test && pnpm --filter @saldo/core typecheck && pnpm lint`
Expected: all green.

- [ ] **Step 7: Commit**

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

- [ ] **Step 1: Scaffold with the Expo template**

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

- [ ] **Step 2: Rename the package and set its scripts**

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

- [ ] **Step 3: Install runtime dependencies with `expo install`**

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

- [ ] **Step 4: Delete the template entry point**

`expo-router/entry` replaces both, and `app.config.ts` replaces `app.json`.

```bash
rm apps/mobile/App.tsx apps/mobile/index.ts apps/mobile/app.json
```

- [ ] **Step 5: Create `apps/mobile/app.config.ts`**

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

- [ ] **Step 6: Create `apps/mobile/metro.config.js`**

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

- [ ] **Step 7: Create `apps/mobile/babel.config.js`**

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

- [ ] **Step 8: Create `apps/mobile/tsconfig.json`**

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

- [ ] **Step 9: Check the app typechecks and Metro starts**

```bash
pnpm install
pnpm --filter mobile typecheck
```

Expected: typecheck passes (there are no sources yet beyond config). Metro is exercised in Task 12.

- [ ] **Step 10: Commit**

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

- [ ] **Step 1: Create `apps/mobile/jest.config.js`**

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

- [ ] **Step 2: Create `apps/mobile/jest.setup.js`**

```js
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
```

- [ ] **Step 3: Write the failing test `apps/mobile/src/theme/theme.test.tsx`**

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

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter mobile test`
Expected: FAIL, because `./ThemeProvider` does not exist.

- [ ] **Step 5: Implement `apps/mobile/src/theme/ThemeProvider.tsx`**

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

- [ ] **Step 6: Implement `apps/mobile/src/theme/Text.tsx`**

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

- [ ] **Step 7: Implement `apps/mobile/src/theme/Icon.tsx`**

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

- [ ] **Step 8: Create `apps/mobile/src/theme/index.ts`**

```ts
export * from './Icon';
export * from './Text';
export * from './ThemeProvider';
```

- [ ] **Step 9: Run the tests and typecheck**

Run: `pnpm --filter mobile test && pnpm --filter mobile typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

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

- [ ] **Step 1: Write the failing test `apps/mobile/src/i18n/i18n.test.ts`**

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

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/i18n`
Expected: FAIL, because `./index` does not exist.

- [ ] **Step 3: Implement `apps/mobile/src/i18n/index.ts`**

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/i18n`
Expected: PASS.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write the failing test `apps/mobile/src/db/schema.test.ts`**

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

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/db/schema`
Expected: FAIL, because `./schema` does not exist.

- [ ] **Step 3: Implement `apps/mobile/src/db/schema.ts`**

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

- [ ] **Step 4: Create the test database helper `apps/mobile/src/db/testing.ts`**

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

- [ ] **Step 5: Create `apps/mobile/drizzle.config.ts` and generate the migration**

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

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/db/schema`
Expected: PASS.

- [ ] **Step 7: Commit**

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

- [ ] **Step 1: Write the failing test `apps/mobile/src/db/kv.test.ts`**

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

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/db/kv`
Expected: FAIL, because `./kv` does not exist.

- [ ] **Step 3: Implement `apps/mobile/src/db/kv.ts`**

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

- [ ] **Step 4: Implement `apps/mobile/src/db/client.ts`**

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

- [ ] **Step 5: Implement `apps/mobile/src/db/DatabaseProvider.tsx`**

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

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/db/kv`
Expected: PASS.

- [ ] **Step 7: Commit**

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

- [ ] **Step 1: Write the failing test `apps/mobile/src/db/clock.test.ts`**

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

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile test src/db/clock`
Expected: FAIL, because `./clock` does not exist.

- [ ] **Step 3: Implement `apps/mobile/src/db/clock.ts`**

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mobile test src/db/clock`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/clock.ts apps/mobile/src/db/clock.test.ts
git commit -m "feat(mobile): persist the HLC clock in the kv table"
```

---
