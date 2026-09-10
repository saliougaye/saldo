# AGENTS.md — instructions for implementing agents

Saldo is an open-source, self-hostable, local-first personal finance app (Expo mobile app + Next.js server) that replaces
Spendee's paid features. You are implementing the POC.

## Read in this order

1. `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` — **the** source of truth for behaviour and architecture.
2. `docs/superpowers/plans/README.md` — phases, dependencies, acceptance criteria.
3. The plan for the phase you are working on (`docs/superpowers/plans/YYYY-MM-DD-NN-*.md`).
4. `docs/design/README.md`, then the relevant line ranges of `docs/design/Spese.dc.html` for any screen you build.

## Workflow per phase

1. If the phase has no plan file yet, write one with the **writing-plans** skill (bite-sized TDD steps, exact paths,
   complete code, no placeholders), using the phase scope in the roadmap and the listed spec sections. Commit the plan.
2. Execute the plan with **subagent-driven-development** (preferred) or **executing-plans**. Tick checkboxes in the plan
   as steps complete.
3. Before claiming a phase is done, use **verification-before-completion**: run `pnpm lint`, `pnpm typecheck` and
   `pnpm test`, and meet every acceptance criterion in the roadmap.
4. Use **requesting-code-review** at the end of each phase.
5. Commit often, using Conventional Commits (`feat(core): …`, `test(core): …`, `chore: …`). Work on a branch per phase
   (`phase/02-mobile-shell`) and merge to `main` when accepted.

## Non-negotiable conventions

- **TypeScript strict** everywhere (`noUncheckedIndexedAccess` on). No `any`; no non-null assertions (`!`).
- **Money = integer minor units.** Never floats in storage or calculations; format only at the edge with `@saldo/i18n`.
- **Transaction dates = `LocalDate` (`YYYY-MM-DD`)**. Never `new Date(localDate)`; use `@saldo/core` date helpers.
- **Business rules live in `@saldo/core`**, as pure functions with injected `today`/clock and unit tests first (TDD).
  Screens and route handlers only load data, call core, and render or return results.
- **No hard-coded UI strings.** Every user-visible string goes through i18n keys in `packages/i18n/src/locales/it.ts`
  **and** `en.ts` (the parity test enforces this).
- **No hard-coded colours, radii or font sizes** in apps. Use `@saldo/ui` tokens. New screens reuse existing primitives.
- `packages/*` never import from `apps/*`; `@saldo/core` imports no React, React Native, Node or DOM APIs.
- Install **current stable** library versions; never invent version numbers. If a library API differs from a plan,
  follow the library's docs and fix the plan in the same commit.
- `apps/mobile/android` and `apps/mobile/ios` are generated. Never commit them; native config goes in config plugins.
- Never commit secrets, keystores or `.env` files (only `.env.example`).

## Commands

```bash
pnpm install          # install workspace
pnpm lint             # biome check
pnpm typecheck        # turbo: tsc --noEmit in every package/app
pnpm test             # turbo: vitest / jest in every package/app
pnpm --filter @saldo/core test -- --watch
```

**Reading the results.** Two false greens have already cost time in this repository, so check the
output, not the exit code:

- `pnpm lint` can exit 0 while Biome is reporting errors. What means "clean" is the **absence** of
  `lint/…` lines and of the trailing `× Some errors were emitted while running checks.` Biome's
  `Checked N files … No fixes applied.` line only says nothing was auto-fixable — it is **not** a
  pass.
- The same goes for the test and lint filters in the shell wrapper: run a gate through
  `rtk proxy <command>` (or with `--json`) before believing it.

## When in doubt

- Spec vs design prototype disagree → **the spec wins** (the prototype fakes data and some behaviours).
- Spec silent → follow the design prototype's behaviour and note the decision in the plan.
- Genuinely blocked on a product decision (e.g. the Spendee CSV format needs a real sample) → ask the user; don't guess.
- Do **not** port or modify `docs/design/support.js` (design tool runtime, not app code).
