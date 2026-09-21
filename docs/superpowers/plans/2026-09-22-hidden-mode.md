# Hidden mode: hide the figures in public — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One device-local switch hides every amount in the app behind `•••• €` while the app keeps working. A
long-press on the Home balance hides, a tap on it reveals, a row in Profile declares the feature. Charts stop
drawing magnitudes. Hidden figures leave the accessibility tree. The change animates with the **Cipher** motion
chosen from `docs/superpowers/mockups/2026-09-22-hidden-mode-variants.html` (variant 4, slowed).

**Architecture:** A `HiddenAmountsProvider` (React context over `kv.amountsHidden`) is the single source of truth:
`{ hidden, phase, setHidden, toggle }`, where `phase ∈ visible | scrambling | hidden` lags `hidden` by the scramble
so sentence-embedded amounts can follow the motion. `AmountText` renders two stacked layers (real figure at
opacity 0 holds the width, `•••• €` mask on top) and runs the per-figure cipher (`useCipher`). Sentences that embed
an amount via `t(key, { amount })` go through `useHiddenMoney().format`, which returns the real, scrambled or
masked string by `phase`. Charts and bars read `hidden` from the context and draw a flat placeholder. Nothing
touches `@saldo/core`: this is presentation.

**Tech Stack:** Expo Router, Reanimated 4 (`withDelay`/`withTiming` on opacity), `@saldo/i18n`
`formatMoneyParts`, `@saldo/ui` tokens/icons, jest-expo + Testing Library, vitest for `@saldo/ui`/`@saldo/i18n`.

**Branch:** `feat/hidden-mode-variants` (worktree `.worktrees/hidden-mode-variants`). Mockup already committed.

---

## Decisions

**Decided with the user (2026-09-22):**

- Motion: **Cipher**, slowed — 4 scramble steps × 60 ms, 160 ms crossfade, settle 30 ms per digit from the right,
  40 ms stagger between Home cards.
- The user tests on device after the code lands on `main`; no simulator run by the implementer.

**Decisions where the TODO left options open** (recorded per AGENTS.md):

- **Trigger = both.** Long-press (450 ms) on the Home balance card hides; a tap on it while hidden reveals. A
  "Nascondi gli importi" toggle row in Profile (with a hint about the gesture) declares the feature. No header
  eye button: the Home header is full.
- **Survives a relaunch.** `kv.amountsHidden` (`'true' | 'false'`), device-local, never synced. Someone who hides
  on the same train every morning should not redo it per launch; reveal is one tap. `wipeDevice` clears it with
  the rest of `kv`; `wipeAccountData` keeps it, like `appLockEnabled`.
- **Hidden figure = fixed `••••` + currency symbol**, `textMuted`, tabular. Fixed four dots: a dot per digit
  would leak magnitude. The real figure stays in layout at opacity 0, so nothing shifts.
- **Inputs stay visible.** `AmountInput` untouched. The "balance after" line in the transaction form is masked
  (it is a stored figure), including its accessibility label.
- **Charts draw a placeholder, not the shape.** Bar charts render equal stubs and `••••` labels, `SplitBar`
  renders its empty track, `ProgressBar` collapses its fill and drops the pace tick and `accessibilityValue`,
  line charts draw a flat dashed line. A percentage of budget is not money, but a bar full to the brim next to a
  masked figure says "over budget" — the TODO counts budget bars among the leaks, so they hide too.
- **Accessibility.** Hidden real text gets `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"`;
  the mask is one accessible element labelled "Importo nascosto"; toggling announces "Importi nascosti" /
  "Importi visibili". Reduce Motion: no scramble, 120 ms opacity only.
- **No haptics** (`expo-haptics` is not a dependency; adding a native module for one tick is out of scope).
- **Icons:** `eye` and `eyeOff` added to `@saldo/ui` from Lucide 1.47.0 (same licence block).

---

## Task 1 — i18n keys and icons

- [x] `packages/i18n/src/locales/it.ts`: in `common` add
  `amountHidden: 'Importo nascosto'`, `amountsHidden: 'Importi nascosti'`, `amountsShown: 'Importi visibili'`;
  in `profile` add `hideAmounts: 'Nascondi gli importi'`,
  `hideAmountsHint: 'Tieni premuto il saldo in Home per nasconderli, tocca per mostrarli.'`.
- [x] `en.ts`: `amountHidden: 'Amount hidden'`, `amountsHidden: 'Amounts hidden'`, `amountsShown: 'Amounts shown'`,
  `hideAmounts: 'Hide amounts'`, `hideAmountsHint: 'Long-press the balance on Home to hide them, tap to show them.'`.
- [x] `packages/ui/src/icons.ts`: append to the Lucide block
  ```ts
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  ```
  and bump the count in `icons.test.ts` (134 → 136).
- [x] `pnpm --filter @saldo/i18n test`, `pnpm --filter @saldo/ui test`. Commit `feat(ui,i18n): eye icons and hidden-mode strings`.

## Task 2 — pure cipher helpers (TDD)

- [x] `apps/mobile/src/features/hidden/cipher.ts`:
  - `export const CIPHER = { steps: 4, stepMs: 60, fadeMs: 160, settleMs: 30, reducedMs: 120 } as const;`
  - `export const MASK = '••••';`
  - `scrambleDigits(text, rng = Math.random): string` — every `0-9` replaced by a random digit, anything else kept.
  - `settleDigits(text, settledFromRight, rng)` — the last `settledFromRight` digits (counting digits only) are the
    real ones, the digits before them scrambled.
  - `digitCount(text)`.
  - `maskedMoney(currency, locale)` — `••••` with the symbol where `formatMoneyParts` puts it (`€` suffix in `it`,
    `$` prefix in `en-US`).
- [x] `cipher.test.ts` (jest `app` project needs `.tsx`? No: `src/**/*.test.ts` under `features` is the **db**
  project (node env) — fine for pure functions). Cases: length and non-digits preserved; deterministic rng;
  settle 0 = all scrambled, settle = count → identical; mask for EUR/it and USD/en.
- [x] Commit `feat(mobile): cipher helpers for hidden amounts`.

## Task 3 — `HiddenAmountsProvider`

- [x] `apps/mobile/src/features/hidden/HiddenAmountsProvider.tsx`:
  ```tsx
  export type HiddenPhase = 'visible' | 'scrambling' | 'hidden';
  export interface HiddenAmounts { hidden: boolean; phase: HiddenPhase; tick: number; setHidden(next: boolean): void; toggle(): void; }
  export const AMOUNTS_HIDDEN_KEY = 'amountsHidden';
  ```
  - `useState(() => kv.get(AMOUNTS_HIDDEN_KEY) === 'true')`; `phase` starts `hidden ? 'hidden' : 'visible'`.
  - `setHidden(next)`: no-op if equal; `kv.set`; set `hidden`; if `reduced` → phase jumps; else phase
    `'scrambling'`, `tick` increments every `stepMs` for `steps` steps (so consumers re-randomise), then phase
    `'hidden' | 'visible'`. Timers cleared on the next toggle and on unmount.
    `AccessibilityInfo.announceForAccessibility(t(next ? 'common.amountsHidden' : 'common.amountsShown'))`.
  - Context default (no provider, e.g. tests): visible, no-ops.
  - `useHiddenAmounts()`.
  - `useHiddenMoney()`: `{ hidden, format(minor, currency, locale, signDisplay?) }` where `format` returns
    `formatMoney(...)` when `phase === 'visible'`, `scrambleDigits(formatMoney(...))` when `'scrambling'`,
    `maskedMoney(currency, locale)` when `'hidden'`.
- [x] `HiddenAmountsProvider.test.tsx` (mocks `../../db/DatabaseProvider` like `PrivacyOverlay.test.tsx`, fake
  timers): reads `'true'` from kv; `toggle()` writes `'false'`; phase sequence `scrambling → hidden` after
  `steps*stepMs`; `useHiddenMoney().format` returns `•••• €` when hidden.
- [x] Mount in `apps/mobile/app/_layout.tsx` around `<Ready>` (inside `SettingsScopedProviders`, so `t` and `kv`
  exist).
- [x] `apps/mobile/src/db/kv.ts`: add `'amountsHidden'` to `KvKey`. `wipe.test.ts`: assert it is kept by
  `wipeAccountData` (set it in the fixture, expect `'true'` after).
- [x] Commit `feat(mobile): hidden-amounts state, persisted per device`.

## Task 4 — `AmountText` masks and ciphers

- [x] `apps/mobile/src/features/hidden/useCipher.ts`: `useCipher(integer: string, hidden: boolean, stagger = 0)`
  returns `{ integer: string /* what to draw */, scrambling: boolean, realStyle, maskStyle }` (Reanimated
  animated styles for opacity). Behaviour per the mockup:
  - hide: at `base = stagger*staggerMs`, `steps` scramble steps every `stepMs`; at `base + steps*stepMs` real
    opacity → 0 and mask → 1 over `fadeMs`; text restored `fadeMs` later.
  - reveal: at `base` mask → 0 and real → 1 over `fadeMs`; scramble steps; then settle right→left every
    `settleMs`.
  - `reduced`: no text changes, opacity over `reducedMs`, no stagger.
  - initial mount: no animation, values set from `hidden`.
  - `integer` changes while not animating → drawn immediately.
- [x] `AmountText.tsx`: props gain `align?: 'start' | 'end'` (mask alignment, default `start`) and
  `stagger?: number`. Render:
  ```tsx
  <View style={style} accessible={false}>
    <Animated.View style={realStyle} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
      <Text {...rest} tabular color={scrambling ? 'textMuted' : color}>{sign+prefix+integer}<RnText style={{opacity:.5}}>{tail}</RnText></Text>
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, maskStyle]} pointerEvents="none"
      accessible={hidden} accessibilityLabel={t('common.amountHidden')} accessibilityElementsHidden={!hidden} importantForAccessibility={hidden ? 'yes' : 'no-hide-descendants'}>
      <Text {...rest} tabular color="textMuted" style={{ textAlign: align === 'end' ? 'right' : 'left' }}>{mask}</Text>
    </Animated.View>
  </View>
  ```
  `style` moves to the wrapper (callers only pass layout styles: `marginTop`). `AnimatedAmount` passes
  `useCountUp(minor, !hidden)` so the roll freezes while hidden.
- [x] `apps/mobile/src/components/AmountText.test.tsx` (app project, `ThemeProvider` + `I18nextProvider` +
  `HiddenAmountsProvider` with mocked kv): visible → `1.284,50 €` on screen, no "Importo nascosto"; hidden from kv
  → label present, real text not reachable without `includeHiddenElements`.
- [x] Commit `feat(mobile): AmountText hides behind •••• with the cipher motion`.

## Task 5 — Home: gesture, stagger, footers

- [x] `apps/mobile/app/(tabs)/index.tsx`: wrap the hero `<Card>` in a `Pressable` (`accessible={false}`,
  `delayLongPress={450}`, `onLongPress={() => setHidden(true)}`, `onPress={() => hidden && setHidden(false)}`)
  inside an `Animated.View` whose scale goes to 0.98 over 450 ms linear on `pressIn` and back over 200 ms `EASE`
  on `pressOut` (reduced motion: no scale). `AnimatedAmount stagger={0}`; income/expenses footers use
  `useHiddenMoney().format`.
- [x] `HomeBudgetCard.tsx` (`stagger` 1 is not applicable to sentences; they follow `phase`): `spent di limit`
  via `format`. `UpcomingRow.tsx:77` net via `format`. Recent-transactions rows already use `AmountText`.
- [x] Commit `feat(mobile): long-press the Home balance to hide the figures`.

## Task 6 — Profile row

- [x] `apps/mobile/app/profile.tsx`: new `ListRow` **above** the app-lock row: `title=t('profile.hideAmounts')`,
  `subtitle=t('profile.hideAmountsHint')`, `leading=lead('eyeOff')`, `trailing=<Toggle value={hidden}
  onChange={setHidden} accessibilityLabel=… />`.
- [x] Commit `feat(mobile): hidden-amounts toggle in Profile`.

## Task 7 — the long tail: sentence-embedded amounts

Replace `formatMoney(...)` with `format(...)` from `useHiddenMoney()` at every rendered site (§2a of the audit):

- [x] `app/(tabs)/transactions.tsx:169, 361-362`
- [x] `app/(tabs)/stats.tsx:296-300, 365, 392`
- [x] `app/(tabs)/accounts.tsx:151` · `app/account/[id].tsx:286` · `app/tag/[id].tsx:172`
- [x] `app/category/[id].tsx:216, 238` (238 becomes an `AmountText`)
- [x] `app/budgets.tsx:127` · `app/recurrence/[id].tsx:252`
- [x] `src/features/period/PeriodSheet.tsx:94` · `src/features/recurrences/RecurrencesCard.tsx:81`
- [x] `src/features/budgets/BudgetDetailSheet.tsx:34` (→ `AmountText size="amountLg" weight="semibold"`), `:37`
- [x] `src/features/budgets/BudgetForm.tsx:146` (median hint)
- [x] `src/features/import/ImportWizard.tsx:251-255` (→ `AmountText align="end"`)
- [x] `src/features/stats/TagSpendCard.tsx:91`
- [x] `src/features/transactions/TransactionForm.tsx:204` (`money` = `format`, so the a11y label masks too)
- [x] Trailing `AmountText`s in rows get `align="end"`: `transactions.tsx:209`, `CategorySplitRows.tsx:51`,
  `TagSpendCard.tsx:80`, `recurrences.tsx:103,169,178`, `recurrence/[id].tsx:197,270`, `account/[id].tsx:206,217,268`,
  `category/[id].tsx:260,272,292`, `tag/[id].tsx:129,157`, `budgets.tsx:118`, `accounts.tsx:56,103`.
- [x] `rtk proxy grep -rn "formatMoney(" apps/mobile/src apps/mobile/app` → only `AmountInput.tsx` (symbol only),
  `profile/currency.tsx` (sample figure), `useHiddenMoney` itself.
- [x] Commit `feat(mobile): every rendered amount follows hidden mode`.

## Task 8 — charts and bars

All read `useHiddenAmounts().hidden`; no prop changes at call sites.

- [x] `CashflowChart.tsx`: label `hidden ? MASK : formatMajor(...)` in `textMuted`; `barHeight` returns a fixed
  `Math.round(HALF_HEIGHT * 0.35)` for both halves when hidden.
- [x] `SpendHistoryChart.tsx`: label `MASK`; column fill height `COLUMN_HEIGHT * 0.4`.
- [x] `SplitBar.tsx`: `if (hidden || total <= 0)` → track.
- [x] `ProgressBar.tsx`: target `hidden ? 0 : clamped`; `pace` ignored when hidden; `accessibilityValue` only when
  visible.
- [x] `CycleTrendChart.tsx`, `Sparkline.tsx`: hidden → one `Polyline` at mid-height, `strokeDasharray="3 4"`,
  `borderStrong`, no dot.
- [x] `charts.test.tsx`: `SplitBar` and `CashflowChart` under a hidden provider render no segments / `••••` labels.
- [x] Commit `feat(mobile): charts draw a placeholder in hidden mode`.

## Task 9 — docs and gates

- [x] `TODO.md`: replace the "To settle before planning" list with a "Decided 2026-09-22" list pointing at this
  plan; keep the section open until the user has tested on device.
- [x] `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm test` — read the output, not the exit code.
- [x] Commit `docs(todo): hidden mode decisions`. Stop: the user rebases onto `main` and tests on device.
