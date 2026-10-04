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

**If you configure SMTP, anybody who controls a verified email address of an account can get into that account.**
Without SMTP there is no recovery: the passkey is the only way in (and, for a lost one, an admin with
`pnpm --filter web user …`). With SMTP, an account that has verified its address can ask at `/recover` for a link that
signs a browser in, and then registers a new passkey — so the mailbox is as strong as the passkey, and a stolen mailbox
is a stolen account. What bounds it:

- Only a **verified** address is sent a link. A revoked account never is, and a link minted before a revocation stops
  working. The address you typed at registration is unverified until you open the verification link.
- The link is single-use, stored hashed, and valid for 15 minutes. It opens a confirmation page that does nothing by
  itself: a mail scanner or another site that loads the link cannot spend it or sign a browser in; a person presses
  «Entra».
- Nobody can learn from the page, or from how long it takes, whether an address has an account or is verified.
- Each mailbox is sent at most one message of a kind a minute and five an hour; the endpoints are also rate limited per
  caller. Both limits are per server process.
- Recovery can only sign an existing account in; it never creates one.

If that trade is not one you want, leave SMTP unconfigured: verification and recovery then do not exist, and nothing
else changes.

## MCP e connettori (MCP and connectors)

From 0.4 an instance serves a [Model Context Protocol](https://modelcontextprotocol.io) endpoint at
`{PUBLIC_URL}/mcp`, so an MCP client a user already runs (Claude Code, Claude's custom connectors, any MCP client)
reads — and, if allowed, changes — that user's data. What bounds it:

- **The only credential is an OAuth 2.1 token the user granted.** Saldo is its own authorization server (endpoints
  under `/api/auth/oauth2/*`, issuer `{PUBLIC_URL}/api/auth`). The client registers itself (public clients only, PKCE
  S256, `https://` or loopback redirect URIs, exact match, one registration a minute per IP) and sends the user's
  browser to sign in with their passkey and to `/oauth/consent`, where they choose what the client may do. Nothing is
  pasted, nothing is shared out of band, and there are no personal access tokens. A registration on its own grants
  nothing.
- **What a token is.** An opaque string, stored hashed and checked against the database on every call — not a JWT, so
  a revocation has nothing to wait for. It is bound to `{PUBLIC_URL}/mcp` as its audience and refused anywhere else. It
  is accepted only in the `Authorization` header, never in a URL, and never logged.
- **What a token is not.** It is not the user's session: it does not open the web app, change a passkey, reach
  `/admin` or read another user's rows. It carries no identity claims — no OpenID Connect, no id token.
- **Two scopes.** `read` reads what the user sees in the app; `write` adds and changes transactions, accounts,
  categories, tags, budgets and goals. The consent page lets the user refuse `write`. A `read` token is never even
  shown the write tools, and a write call without the scope is refused.
- **Revocation is immediate.** Profilo › Connettori lists every authorized connector with its scopes and last use;
  «Revoca accesso» deletes the consent and every token of that user–client pair, and the client's next call is a 401.
- **Lifetimes.** An access token lives one hour. A refresh token exists only when the client asked for the technical
  `offline_access` scope (MCP clients do: the server advertises it; the consent page never shows it). It is rotated on
  every use, and an authorization not refreshed for 180 days lapses on its own — the same bound as the phone's
  session.
- **A write is the web's write.** A write tool goes through the same server functions as the web forms: the same rules
  from `@saldo/core`, the same per-user scoping, the same check against an edit the phone made meanwhile. The client is
  what asks the person to confirm a write; the server adds no second confirmation.
- **The server never calls a model.** The model runs in the user's client. In this milestone Saldo holds no AI key and
  answers only the calls it is sent.
- **An admin can switch it off** at `/admin/mcp`, or with `MCP_ENABLED=false` in the environment, which locks the
  switch. Off, `/mcp`, the discovery documents, registration and authorization answer 404 and the consent page
  refuses, so no client reads or writes anything. Refreshing and revoking a token keep working (a refreshed token is
  still refused by `/mcp`), so a connector that kept its refresh token works again when MCP is back on.
- The endpoint is rate limited per token (120 requests a minute) and takes bodies of at most 1 MB; like the other
  limiters, per server process.

What it cannot protect against: a client the user authorized can do what its scopes allow, so a `write` grant to a
client that misbehaves is a client that writes. Grant `write` only to a client you would let type into the app.

## Supported versions

This is a proof of concept before its first release. Only the current `main` is supported: there are
no backports, and "update" means rebuilding the server and the app from the latest commit. See
**Versions and compatibility** in [self-hosting](docs/self-hosting.md) for what that involves and
what happens to a phone in the meantime.
