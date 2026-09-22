# Loading states where they are missing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every screen that reads the database says it is loading instead of showing nothing, a zero, or its
empty state for a frame. The style is **Etichette**, chosen from
`docs/superpowers/mockups/2026-09-22-loading-states-variants.html` (variant 4): the screen's own chrome — titles,
card headers, static labels, back button — is drawn for real, and only the data (figures, rows, names) is a pulsing
`Skeleton` block.

**Architecture:** Presentation only; nothing in `@saldo/core`. The existing pieces are reused: `Skeleton` /
`SkeletonRow` / `SkeletonList` (`src/components/Skeleton.tsx`), `useDelayed` (grace 120 ms, minimum 320 ms) and the
`loaded` flag of the `use*Query` hooks. Each screen computes one `loaded` from every query its first paint depends
on, calls `useDelayed(!loaded)` before any early return, and while `!loaded` renders the skeleton when the delay
says so and nothing else otherwise — never the empty state and never a zero figure.

**Tech Stack:** Expo Router, Reanimated 4, `@saldo/ui` tokens, react-i18next.

**Branch:** `feat/home-loading-variants`.

---

## Decisions

**Decided with the user (2026-09-22):**

- Variant **Etichette** out of four (Spinner, Cornici, Blocchi, Etichette); one axis — how much of the finished
  screen is on screen while it loads.
- The user tests on device; the implementer runs lint, typecheck and tests.

**Taken while planning (spec silent):**

- Tabs get skeletons shaped like their cards: `HomeSkeleton` (hero "Rimasto da spendere", Budget, Ultime
  transazioni) and `AccountsSkeleton` (Patrimonio netto card with its labels, one list card). The upcoming card is
  not sketched: whether it exists is data.
- Detail screens (`account/[id]`, `category/[id]`, `tag/[id]`, `transaction/[id]`, `recurrence/[id]`) render
  `DetailSkeleton`: the real `BackButton` at once (so the way back never waits on the grace), then blocks for the
  title, the hero figure and a list. The TODO suggested `LoadingScreen` for them; a full-screen spinner is the
  Spinner variant the user did not pick.
- A detail screen's `loaded` covers the transactions it sums too (`account`, `category`, `tag`): before, the entity
  query alone gated them, and the balance painted as `0` for a frame.
- List screens (`budgets`, `recurrences`, `settings/tags`, `settings/categories`, `settings/archived-accounts`,
  `settings/archived-categories`) keep their real header and section labels and put `SkeletonList` (or, for
  budgets, budget-shaped cards) where the rows go.
- **Out of scope, verified:** `budget/[id]`, `category/edit/[id]` and `transaction/edit/[id]` read their entity
  synchronously (`repos.*.byId` in a `useState` initialiser), so they have no loading gap; `account/edit/[id]`
  already uses `LoadingScreen`, a form that cannot render without its seed.

## Tasks

- [x] **1. Shared pieces.** `SkeletonBudgetRow` in `src/components/Skeleton.tsx`; `DetailSkeleton` in
      `src/components/DetailSkeleton.tsx`.
- [x] **2. Home.** `src/features/home/HomeSkeleton.tsx`; `(tabs)/index.tsx` switches to `useTransactionsInRangeQuery`
      and `useBudgetsQuery`, gates the cards on `loaded`.
- [x] **3. Conti.** `src/features/accounts/AccountsSkeleton.tsx`; `(tabs)/accounts.tsx` gates on accounts and
      transactions.
- [x] **4. Detail screens.** Five screens: `useDelayed` before the early returns, `DetailSkeleton` instead of
      `null`.
- [x] **5. List screens.** Six screens: skeleton where the rows go, no empty state before `loaded`.
- [x] **6. Verify.** `pnpm lint`, `pnpm typecheck`, `pnpm test` (read the output, not the exit code); remove the
      item from `TODO.md`.
