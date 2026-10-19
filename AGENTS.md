# AGENTS.md — instructions for implementing agents

Saldo is an open-source, self-hostable, local-first personal finance app (Expo mobile app + Next.js server) that replaces
Spendee's paid features. You are implementing the POC.

## Read in this order

1. `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` — **the** source of truth for behaviour and architecture.
   Specs written after 2026-10-05 are HTML files in the same folder (see «Writing docs»). An HTML spec covers the
   topic it names, and on that topic it wins over the POC spec.
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
- **Business rules live in `@saldo/core`**, as pure functions with injected `today`/clock. Write unit tests first (TDD)
  for complex rules (see «Tests»). Screens and route handlers only load data, call core, and render or return results.
- **No hard-coded UI strings.** Every user-visible string goes through i18n keys in `packages/i18n/src/locales/it.ts`
  **and** `en.ts` (the parity test enforces this).
- **The marketing site is the one exception** (`apps/site`, spec 0.8a D43). Its own copy lives in
  `apps/site/src/content/<locale>.ts`, one object for each locale. The app strings on its phone screens come from
  `@saldo/i18n` through `appText`. `astro check` stops a misspelt key, and the build fails when a catalog lacks a key. The site has no automated tests (spec 0.8a D52).
- **When you change a screen that the site shows** (the table in spec 0.8a §04), change the matching component in
  `apps/site/src/components/phone/screens/` in the same pull request.
- **No hard-coded colours, radii or font sizes** in apps. Use `@saldo/ui` tokens. New screens reuse existing primitives.
- `packages/*` never import from `apps/*`; `@saldo/core` imports no React, React Native, Node or DOM APIs.
- Install **current stable** library versions; never invent version numbers. If a library API differs from a plan,
  follow the library's docs and fix the plan in the same commit.
- `apps/mobile/android` and `apps/mobile/ios` are generated. Never commit them; native config goes in config plugins.
- Never commit secrets, keystores or `.env` files (only `.env.example`).

## Tests

Prefer integration and end-to-end tests. Write a unit test only when it gives one of these:

1. Complex logic: dates, money, recurrence, forecast, sync (HLC and last-writer-wins), CSV parsing, concurrency, state
   machines.
2. Integration: a real database (SQLite in `apps/mobile/src/db/testing.ts`, PGlite in
   `apps/web/src/server/test/harness.ts`), real routes, a full flow.
3. A security guard: auth, redirects, origin checks, rate limits, access to another person's data.
4. A regression for a real bug. Name the bug in the test.

Do not write tests for these:

- constants, mappings, id templates, seed lists, design tokens;
- copy and translations (the key checks in `@saldo/i18n` and the parity test are enough);
- components or view models with mocked data;
- the behaviour of a library;
- a rule that another test already covers.

End-to-end tests cover the screens: Playwright for the web app (`apps/web/e2e/`, `pnpm --filter web e2e`), Maestro for the
phone (`apps/mobile/maestro/`, run with `maestro/run.sh`). CI runs the Playwright suite only on a pull request that has
the `e2e` label. CI does not run the Maestro flows. See `TODO.md` for the flows that do not have a test yet.

## Writing docs

These rules apply to all docs: specs, plans, READMEs, `docs/*.md`, `SECURITY.md`. They do not apply to code comments or
to i18n strings (user-visible copy has its own voice).

**Use Simplified Technical English (ASD-STE100).**

- Write in English.
- Keep sentences short: 20 words maximum in a procedure, 25 words maximum in a description.
- Write one instruction in each sentence. Use the imperative for instructions: «Run `pnpm test`.»
- Use the active voice. Write «The route checks the token», not «The token is checked».
- Use one word for one meaning. Do not use synonyms for variety.
- Use simple verbs: «use», «start», «stop», «make sure». Do not use «utilize», «leverage», «facilitate».
- Keep technical names, code identifiers, paths and UI labels unchanged.
- Write warnings and cautions before the step that they apply to.

**Write new specs as HTML, not markdown.**

1. Copy `docs/superpowers/templates/spec-template.html` to
   `docs/superpowers/specs/YYYY-MM-DD-<topic>.html`.
2. Keep the structure of the template:
   - a sidebar with the contents, and one reading column;
   - numbered sections, and a lead sentence under each title;
   - numbered figures, each with a caption.
3. Explain each flow, architecture or state change with a large inline SVG diagram. Give each diagram
   `role="img"` and a `<title>`.
4. Show screens as HTML illustrations. Use the real strings from `packages/i18n/src/locales/en.ts`.
5. Use the colours of `@saldo/ui` (light and dark), the Geist font, and the SVG classes of the template. Do not
   add a colour that is not in the palette.
6. Keep the file self-contained. Do not add external scripts or images. The Geist font is the only external file.
7. Open the file in a browser at 1440px and at 500px, in the light and the dark theme. Make sure that no text clips
   and that the console shows no errors.

The markdown files that already exist stay in markdown. Plans also stay in markdown, because the plan skills tick
their checkboxes. When you change an existing doc, write the new text in STE. Do not rewrite old text only to
convert it.

## Commands

```bash
pnpm install          # install workspace
pnpm lint             # biome check
pnpm typecheck        # turbo: tsc --noEmit in every package/app
pnpm test             # turbo: vitest / jest in every package/app
pnpm --filter @saldo/core test -- --watch
pnpm --filter site dev   # the marketing site (Astro), http://localhost:4321; needs Node >= 22.22
```

**Reading the results.** Two false greens have already cost time in this repository, so check the
output, not the exit code:

- `pnpm lint` can exit 0 while Biome is reporting errors. What means "clean" is the **absence** of
  `lint/…` lines and of the trailing `× Some errors were emitted while running checks.` Biome's
  `Checked N files … No fixes applied.` line only says nothing was auto-fixable — it is **not** a
  pass.
- The same goes for the test and lint filters in the shell wrapper: run a gate through
  `rtk proxy <command>` (or with `--json`) before believing it.

**After regenerating the mobile migrations**, restart Metro with `--clear` and delete the simulator's
`Documents/SQLite/saldo.db`. The migrations reach the app through `babel-plugin-inline-import`, and Metro caches that
transform: without both steps the app applies the *previous* schema and every query against a new column fails. Find
the file with `xcrun simctl get_app_container booted io.github.saldo.app data` — the booted device is not necessarily
the one a hard-coded UDID points at.

## When in doubt

- Spec vs design prototype disagree → **the spec wins** (the prototype fakes data and some behaviours).
- Spec silent → follow the design prototype's behaviour and note the decision in the plan.
- Genuinely blocked on a product decision (e.g. the Spendee CSV format needs a real sample) → ask the user; don't guess.
- Do **not** port or modify `docs/design/support.js` (design tool runtime, not app code).
