# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared finances, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### E2E flow for the change of email

The change of a real email address (plan `2026-10-19-change-email.md`) has route tests, but no Playwright flow in the
repository. `apps/web/e2e` starts the server with `SMTP_HOST` blank and has no mail sink. A throwaway run checked the
flow with an SMTP sink in the test process. To commit it, add `SMTP_*` to `e2e/env.ts` and a sink in `e2e/support`.

### Safer change of email

A person with a stolen signed-in session can change the address. The notice to the old verified address is the only
warning. Two ideas: an undo link in the notice, or a recent passkey ceremony before the change.

### `POST /api/me/email` tells a signed-in user that an address has an account

Low priority. On the path that fills a synthetic address, the route answers `409 email_taken`. The old code did the
same. The new change path answers `202` whether or not the address is taken. Make the first path answer the same way.
