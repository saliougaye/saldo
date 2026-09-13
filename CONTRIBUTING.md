# Contributing to Saldo

Thanks for looking. The long version of everything below is [AGENTS.md](AGENTS.md) — it is the full
set of conventions, for people and for coding agents alike, and it is the one that gets updated. This
page is the short way in.

## Status

Saldo is a proof of concept, built to a written spec rather than feature by feature. The spec and the
roadmap live in [`docs/superpowers/`](docs/superpowers/plans/README.md): read the phase you are about
to touch before you touch it. There is also a design prototype under [`docs/design/`](docs/design/README.md);
where it and the spec disagree, **the spec wins** — the prototype fakes its data and some of its
behaviour.

## Getting set up

Node 22 (pinned in `.nvmrc`) and pnpm 10. The [README](README.md#development) has the full loop,
including the server and the simulator; the short version is:

```bash
pnpm install
pnpm lint        # Biome
pnpm typecheck   # tsc --noEmit in every package
pnpm test        # vitest and jest, per package
```

Those three are the gates, and a change lands green on all of them.

**Read the output, not the exit code.** `pnpm lint` can exit 0 while Biome is still reporting errors.
What means clean is the *absence* of `lint/…` lines and of the trailing
`× Some errors were emitted while running checks.` — Biome's `Checked N files … No fixes applied.`
only says nothing was auto-fixable. If your shell wraps these commands in anything that filters
their output, run them unwrapped before you believe them.

## The conventions that are not negotiable

- **TypeScript strict** everywhere, `noUncheckedIndexedAccess` on. No `any`, no non-null
  assertions (`!`).
- **Money is integer minor units.** Never a float in storage or in a calculation; format only at the
  edge, with `@saldo/i18n`.
- **Transaction dates are `LocalDate`** (`YYYY-MM-DD`). Never `new Date(localDate)`; use the date
  helpers in `@saldo/core`.
- **Business rules live in `@saldo/core`**, as pure functions with the clock injected and unit tests
  written first. Screens and route handlers load data, call core, and render or return.
- **No hard-coded user-visible strings.** Every one goes through an i18n key in
  `packages/i18n/src/locales/it.ts` *and* `en.ts`; a parity test enforces that both exist.
- **No hard-coded colours, radii or font sizes** in the apps — use the `@saldo/ui` tokens, and reuse
  the existing primitives.
- **`packages/*` never imports from `apps/*`**, and `@saldo/core` imports no React, React Native,
  Node or DOM API.
- **`apps/mobile/android` and `apps/mobile/ios` are generated** and never committed; native
  configuration goes in a config plugin.
- **Never commit secrets, keystores or `.env` files** — only `.env.example`.

## Commits and branches

[Conventional Commits](https://www.conventionalcommits.org/) (`feat(core): …`, `fix(mobile): …`,
`test(web): …`, `docs: …`), and a branch per piece of work rather than a commit straight onto `main`.
Commit often; a small commit that explains why is worth more than a large one that explains what.

## What to open first

Open an issue describing the behaviour — what it does now, what you expected — before you open a pull
request that changes it. It is cheaper to agree on the behaviour than to review the wrong fix, and
for anything the spec already decided, the answer may be in `docs/superpowers/`.
