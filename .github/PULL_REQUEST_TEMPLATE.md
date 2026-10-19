<!-- Open an issue first for any change in behaviour. See CONTRIBUTING.md. -->

## What and why

Closes #

## How to check it

<!-- The steps that show the change works. Add a screenshot for a change that people can see. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. I read the output, not only the exit code.
- [ ] Business rules are in `@saldo/core`, with a test written first for complex logic.
- [ ] Money is in integer minor units. Dates are `LocalDate`.
- [ ] Every user-visible string uses an i18n key in `it.ts` and `en.ts`.
- [ ] I did not commit a secret, a `.env` file, a keystore or a real CSV export.
- [ ] I changed the docs that this change makes wrong.
