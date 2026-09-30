# Security

Saldo holds somebody's spending history and runs the server that authenticates them. If you find a
way to read another account's data, to sign in as somebody else, or to make a server do something
its owner did not ask for, please tell us before you tell anyone else.

## Reporting a vulnerability

**Do not open a public issue.** A public issue is a working exploit handed to everyone running the
server, and every Saldo server is somebody's own machine with their own money on it — there is no
central instance to patch out from under the problem.

Write to **<!-- SECURITY CONTACT: set this before publishing -->** instead. Once this project is on
GitHub, private vulnerability reporting there is the better channel, because it keeps the report,
the fix and the advisory in one place.

Please include what you need to make it reproducible: the version or commit you tested, how the
server is deployed, and the smallest sequence of requests that shows the problem. If you already
have a fix in mind, say so — but send the report first.

You will get an acknowledgement. This is a small project maintained in spare time, so a fix may not
be immediate; you will be told what is happening rather than left guessing.

## What is in scope

- Reading, writing or deleting data belonging to another account.
- Signing in as somebody else, or obtaining a session you were not given: the passkey ceremony, the
  one-time handoff token, the invite codes, the admin role.
- Anything that lets an unauthenticated caller reach data or actions behind `requireUser`.
- Getting a server to store, serve or delete attachment bytes outside the caller's own namespace.
- Anything that makes the app talk to a host other than the server it was built for.

## What is not

- **Vulnerabilities that need the phone to be unlocked and in your hands.** The app protects against
  a glance over the shoulder — the app lock, the app-switcher cover — not against somebody holding
  an unlocked device.
- **A self-hosted server that was configured insecurely.** Running without TLS, leaving
  `REGISTRATION=open` on a public address, or setting `TRUSTED_PROXIES` too broadly are documented
  in [self-hosting](docs/self-hosting.md) with what each one costs. Tell us if the documentation is
  wrong or missing; that is a real bug.
- **Denial of service against your own instance.** One person's server, one household's data.
- Missing hardening headers with no exploitable consequence, or findings from a scanner that were
  not reproduced by hand.

## What Saldo already assumes about you

Two things are worth stating, because they bound what a report can be about.

**You trust your own server.** The app is built for exactly one address, baked in at build time
(§15), and it will follow that server's instructions — including a redirect to presigned storage
for attachment uploads. A malicious Saldo server can lie to its own users. That is the same trust
you place in any machine you run yourself.

**The admin of an instance can reach its database.** Roles and revocation keep a member from
administering the instance; they do not pretend to keep the owner out of Postgres. If your threat
model has two people who do not trust each other on one server, Saldo does not currently serve it —
see the shared finances milestone in [`ROADMAP.md`](ROADMAP.md).

**The one secret the admin panel stores is the SMTP password, if you set one.** It is encrypted at rest with
`SETTINGS_ENCRYPTION_KEY` and is write-only in the admin panel, but the server can decrypt it (it has to, to send
mail), so whoever controls the server and its environment can read it. Use an SMTP account that can do nothing
but send.

## Supported versions

This is a proof of concept before its first release. Only the current `main` is supported: there are
no backports, and "update" means rebuilding the server and the app from the latest commit. See
**Versions and compatibility** in [self-hosting](docs/self-hosting.md) for what that involves and
what happens to a phone in the meantime.
