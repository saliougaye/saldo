# Self-hosting Saldo

The Saldo server (`apps/web`) holds the accounts. The app does not need one — it works on the phone
alone, with no account — but the server is what gives you multi-device sync and attachment backup.
Signed in, the app stays local-first: it works offline and keeps working if the server is down.

The app is not built for a particular server: it **asks for the address** — the HTTPS address you
open Saldo at in a browser, e.g. `saldo.example.com` — on its first screen ("With your Saldo
server"), or later from Profile → Server and sync. It checks `/api/health` there before offering to
sign in. The one thing the server has to know about the app is its URL scheme: list it in
`APP_REDIRECT_SCHEMES` (the default `saldo` unless the app was built with its own `SALDO_SCHEME`).
Building the app is covered [for Android](./building-android.md) and [for iOS](./building-ios.md).

## What you need

- A machine with Docker (or Node 22 + Postgres 17 if you prefer to run it directly).
- **A domain served over HTTPS.** This is not a preference: passkeys (WebAuthn) only work in a
  secure context. The single exception browsers make is `http://localhost`, which is why local
  development works without a certificate.
- **Installing to the home screen** is the same requirement: browsers only register the service worker
  (and offer «Install» / «Add to Home Screen») on HTTPS. Nothing to configure: the manifest takes its name
  from the instance name, and the Docker image ships the icons. The service worker only keeps an «you are
  offline» page; the web app needs the server for everything else and caches no data.

## Configuration

| Variable | Example | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | `https://saldo.example.com` | Origin used for WebAuthn and for links. Must be https, or `http://localhost` for development. |
| `WEBAUTHN_RP_ID` | `saldo.example.com` | Relying party id: the **registrable domain** of `PUBLIC_URL` — no scheme, no port, no path. |
| `WEBAUTHN_RP_NAME` | `Saldo` | The name the passkey prompt shows. |
| `JWT_SECRET` | 32+ random bytes, base64 | Signs access tokens. `openssl rand -base64 48`. |
| `DATABASE_URL` | `postgres://saldo:…@postgres:5432/saldo` | |
| `STORAGE_DIR` | `/data/attachments` | Where attachment blobs are written (used from phase 08). |
| `SETTINGS_ENCRYPTION_KEY` | 32 random bytes, base64 | **Required.** Encrypts the secrets the admin panel stores (today the SMTP password). `openssl rand -base64 32`. See «Server settings» below: keep it. |
| `REGISTRATION` | `invite` | Optional. `open`, `closed`, `invite` — nobody gets in without a code — or `first-user`. **The first account is always allowed, whatever the mode**: a fresh instance opens on `/setup`, a short wizard that creates it (0.3h). Set, it wins and locks the choice in `/admin/settings`; unset, the wizard asks and you can change it there later (default `first-user`). |
| `INSTANCE_NAME` | `Casa Rossi` | Optional, 1–60 characters. The name on the sign-in page and in invites. Set, it locks the field in `/admin/settings`; unset, you choose there, and by default it is `WEBAUTHN_RP_NAME`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | `smtp.example.com`, `587` | Optional outgoing mail. `SMTP_HOST` set means the whole group comes from the environment and is locked in the panel: `SMTP_FROM` is then required, `SMTP_PORT` defaults to 587, and `SMTP_USER` and `SMTP_PASSWORD` come together or not at all. |
| `APP_REDIRECT_SCHEMES` | `saldo` | Comma-separated URL schemes accepted as a mobile redirect target. It must list whatever the app builds were given as `SALDO_SCHEME` (default `saldo`), or every mobile sign-in stops with `invalid_redirect_uri`. |
| `TRUSTED_PROXIES` | `172.28.0.0/16` | Comma-separated IPs/CIDRs of the reverse proxy in front of this server. See "Auth rate limiting" below — required whenever something like Caddy sits in front. |
| `DEFAULT_TIME_ZONE` | `Europe/Rome` | Optional, default `UTC`. The time zone the web app computes «today» in for a user whose settings carry none yet; every phone fills its own at onboarding, so this matters only for accounts created before that. Not `TZ`, which Vercel reserves. |
| `MCP_ENABLED` | `false` | Optional, `true` or `false`. Set, it wins and locks the switch in `/admin/mcp`; unset, the admin chooses there (default on). See «Collegare un client MCP» below. |

Two things to know before you start:

- **Changing `WEBAUTHN_RP_ID` invalidates every existing passkey.** A credential is bound to the
  relying party it was created for. Pick the hostname you intend to keep.
- **Upgrading from a version before 0.3f-2: add `SETTINGS_ENCRYPTION_KEY` before you start it.** The server
  refuses to start without it. Generate one (`openssl rand -base64 32`) and **keep it** with your other secrets:
  it is not in the database and not in a backup of it. Losing it loses the stored SMTP password and nothing
  else — the panel says the password no longer reads, and you enter it again. Changing it does the same.
- Use `REGISTRATION=invite`. Once your account exists, nothing creates another without a single-use code,
  so there is no window during which a stranger who finds your URL can register. The one exception is
  the **first** account: a fresh instance accepts whoever arrives first at `/setup` and closes the door
  behind them, so visit it as soon as the server is up. With `open`, anyone who can reach the server can
  create an account.

## Run it with Docker

```bash
git clone https://github.com/saldo-app/saldo.git
cd saldo

export PUBLIC_URL=https://saldo.example.com
export WEBAUTHN_RP_ID=saldo.example.com
export JWT_SECRET="$(openssl rand -base64 48)"
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"

docker compose -f apps/web/docker/docker-compose.yml up -d --build
```

The container applies the database migrations on start and then serves on port 3000. Put a reverse
proxy in front of it for HTTPS — `apps/web/docker/Caddyfile.example` is a two-line Caddy
configuration that obtains and renews a certificate automatically.

Set `WEB_PORT` if 3000 is taken on the host:

```bash
WEB_PORT=3007 docker compose -f apps/web/docker/docker-compose.yml up -d
```

## Run it on Vercel instead

Docker is not the only way. The server is an ordinary Next.js app inside a pnpm workspace, and
Vercel deploys it as a monorepo: the project's **Root Directory is `apps/web`**, where `next` is
declared, and `vercel.json` at the repository root carries the install and build commands so you do
not have to reproduce them by hand. Pointed at the repository root instead, the build stops with
"No Next.js version detected", because the root `package.json` does not depend on `next`.

> Not yet walked end to end by anybody. The Docker path above has been; this one is assembled from
> what the code does. If something here is wrong, that is a bug worth reporting.

Four things differ from the compose file, and three of them will bite if you miss them.

**Bring your own Postgres.** The compose file's database is local to it. Use a managed one — Neon,
Supabase, Vercel Postgres — and point `DATABASE_URL` at it.

**Run the migrations yourself.** They are deliberately *not* in the build command: previews build
too, and a preview pointed at the production database would migrate it. Run them from your machine
against the production URL before the first deploy, and again whenever a deploy carries a new one:

```bash
DATABASE_URL='postgres://…' pnpm --filter web db:migrate
```

**`ATTACHMENT_STORAGE` cannot be `fs`.** Vercel's filesystem is wiped on every deploy. Use `none`
(attachments stay on the phone, which is a supported way to run), `s3`, or `vercel-blob` — reading
the caveat about Blob URLs under [attachments](#attachments) first.

**`PUBLIC_URL` and `RP_ID` must be the production domain**, not a preview URL. A passkey is bound to
the domain that created it: registered against a preview URL, it will not work on the real one, and
the failure is an opaque WebAuthn error rather than anything that names the cause.

### Step by step

**Decide the domain first.** A passkey is bound to the domain that created it, so an account
registered against `saldo-abc123.vercel.app` cannot sign in at `saldo.example.com` later — the
passkey simply is not offered, and nothing says why. Pick the address you will keep, and do not
create an account before it is in place.

1. **Create the database.** Neon, Supabase or Vercel Postgres. Copy its connection string.
2. **Run the migrations from your machine**, against that string. Nothing else creates the tables:

   ```bash
   DATABASE_URL='postgres://…' pnpm --filter web db:migrate
   ```

3. **Create the project with its Root Directory set to `apps/web`, and turn on "Include files
   outside the root directory in the Build Step".** Both live under Settings → Build and
   Deployment → Root Directory. The second is required, not a default to count on: without it the
   build sees only `apps/web`, so pnpm finds no lockfile and `packages/*` is not there to compile.
   From the CLI, run everything from the **repository root**, never from `apps/web` — the CLI
   applies the Root Directory itself:

   ```bash
   vercel link
   vercel project update --root-directory apps/web
   ```

   `project update` has no option for the second setting, so switch that one on in the dashboard.

   A deploy from your machine (`vercel --prod`) uploads your working tree, not a clone, so the
   `.vercelignore` at the root is what decides what leaves it. Without that file the upload walks
   into the generated `ios/` and `android/` projects and any local `.env`. It also keeps
   `turbo.json` out on purpose: the deploy does not use Turborepo, and with that file in the upload
   the build breaks. Do not delete it from the repository instead — `pnpm typecheck` and
   `pnpm test` run through it.
4. **Add the environment variables** from the table below, for **Production**. `PUBLIC_URL` and
   `WEBAUTHN_RP_ID` name the domain you chose in step 0, not the deployment URL Vercel generates.
5. **Attach the domain** in the project's Domains tab, and wait for its certificate. Passkeys need
   HTTPS and will not work over anything else.
6. **Deploy**, then check it answers:

   ```bash
   curl -s https://saldo.example.com/api/health
   ```

   `registrationAllowed` and `inviteRequired` should both be `true` under `REGISTRATION=invite`, and
   `schemaVersion` is the number the app has to match.
7. **Mint your own invite code.** Under `invite` nothing creates an account without one, yours
   included. With no shell on the server, run it from your machine against the production database:

   ```bash
   DATABASE_URL='postgres://…' pnpm --filter web invite new --label me
   ```

   It prints the code once. The first account to register becomes the instance's admin.

   Both this and the migration above load `apps/web/.env` if you have one for development, but a
   variable set on the command line wins over it — so they reach the production database, not your
   local one. Worth knowing because the opposite mistake is silent: an invite minted into the wrong
   database is a code that simply never works.
8. **Build the app** and install it — [Android](building-android.md), [iOS](building-ios.md):

   ```bash
   pnpm --filter mobile build:android com.example.saldo
   ```

   On its first screen choose "With your Saldo server" and type `saldo.example.com` — the domain, not
   a preview URL, for the same reason as above.
9. **Sign in.** The app opens a browser at your own `/auth/mobile`, the passkey ceremony runs there,
   and the handoff comes back to the app over the `saldo://` scheme. If it stalls, check that
   `APP_REDIRECT_SCHEMES` on the server matches the `SALDO_SCHEME` the app was built with.

### The environment variables Vercel needs

Set these in the project's **Environment Variables**, or with `vercel env add <NAME> production`.
They do **not** go in `vercel.json`: that file is committed, and its `env` field holds literal
values, so a secret put there is a secret published.

| | Value | |
| --- | --- | --- |
| `PUBLIC_URL` | `https://saldo.example.com` | Your production domain. Not a preview URL. |
| `WEBAUTHN_RP_ID` | `saldo.example.com` | The registrable domain: no scheme, no port. A passkey is bound to it. |
| `WEBAUTHN_RP_NAME` | `Saldo` | What the passkey prompt calls your instance. |
| `JWT_SECRET` | `openssl rand -base64 48` | **Secret.** |
| `DATABASE_URL` | `postgres://…` | **Secret.** Your managed Postgres, not the compose one. |
| `ATTACHMENT_STORAGE` | `none`, `s3` or `vercel-blob` | Never `fs` here. |
| `SETTINGS_ENCRYPTION_KEY` | `openssl rand -base64 32` | **Secret**, and **required**. Keep it: see «Server settings». |
| `REGISTRATION` | `invite` | Nothing creates an account without a code — except the first, which `/setup` creates. Optional: unset, `/admin/settings` decides. |
| `APP_REDIRECT_SCHEMES` | `saldo` | Must match the app's `SALDO_SCHEME` at build time. |
| `TRUSTED_PROXIES` | — | Leave empty until you have looked at what Vercel sends; see below. |
| `DEFAULT_TIME_ZONE` | `Europe/Rome` | Optional. Vercel does not let you set `TZ`; this is the one Saldo reads. |

Plus whichever the storage driver needs: `BLOB_READ_WRITE_TOKEN` is injected by Vercel for
`vercel-blob`, and `s3` takes the block documented under [attachments](#attachments).

`WEB_PORT`, `POSTGRES_PORT` and `STORAGE_DIR` are compose-only and mean nothing here.

Set them for **Production**. Giving previews the same `DATABASE_URL` points them at your real data,
and the same `PUBLIC_URL` is wrong for them by definition — either give previews their own database
or leave them unconfigured and expect them to fail at boot, which is the safer of the two.

Two more worth knowing before you expose it:

- **The auth rate limiter keeps its counters in memory**, so on Vercel each serverless instance has
  its own and the limit is per-instance rather than per-server. See the note under
  [security](#security-notes).
- **`TRUSTED_PROXIES` behind Vercel is unverified.** Better Auth resolves the caller's IP from
  `x-forwarded-for` and ignores the header when it holds more than one value unless this is set.
  Whether Vercel sends one value or several is not something this document has checked — look at
  what arrives before deciding, because a wrong value here produces a limiter that quietly protects
  nothing.

## Check that it works

```bash
curl -s https://saldo.example.com/api/health
# {"app":"saldo","apiVersion":1,"schemaVersion":1,"version":"0.1.0",
#  "registrationAllowed":true,"inviteRequired":true,"attachmentsEnabled":false}
```

`app` and `apiVersion` are what the mobile app looks for when it checks the address you typed, and
`registrationAllowed` is what decides whether it offers "create account". `inviteRequired` says
whether that form will also ask for a code.

Open the domain itself in a browser too. **The root of the instance is the web app**, not a status
page any more: signed out it sends you to `/login`, which names the instance and shows the version
and the host at the foot of the page; signed in it sends you to the app. There is nothing else to
deploy and no second address to remember.

## Letting people in

**The first account** is made by the first-run wizard. A fresh instance sends `/`, `/login` and
`/register` to `/setup`, which asks for the instance's name and who may register (unless `INSTANCE_NAME`
or `REGISTRATION` already say so), then creates your account with a passkey — no code, whatever
`REGISTRATION` says — and makes it the admin. The last step says whether email is configured and, under
`invite`, mints the first invite for somebody else. Once an account exists `/setup` is gone, and so is the
exception: from then on every account needs a code under `invite`.

The command line still works, and is the way in on the day no admin can sign in:

```bash
# Docker
docker compose exec web pnpm --filter web invite new --label "me"
# or, from a checkout
pnpm --filter web invite new --label "me"
```

The code is printed once — the server keeps only its hash — and looks like `HNWF-SWHY-JM3T-ETQZ`.
`/register?invite=HNWF-SWHY-JM3T-ETQZ` prefills it, so an invite you send by message can be one link.

**Registration asks for an email address.** It is an identifier, not a credential: the passkey is the
only way in, the address is what names the account in `/admin` and in the account list, and what
shared finances (0.6) will invite by. **Without SMTP nothing is sent to it**: the address stays unverified and
there is no recovery by email, so a household instance can use anything its members will recognise. With SMTP (see
«Server settings» below) it is sent a verification link and, once verified, can be used to recover the account. An account created before 0.3b carries a synthetic
`{id}@passkey.saldo.invalid` instead; the phone offers to replace it at onboarding and from
Profile → Server and sync, once.

To invite somebody else, mint another code and send it to them. Once you can sign in as an admin, the panel at
`/admin` does this too (**Inviti**, «Nuovo invito»: the code, a link and a QR, shown once), and so do the accounts
below (**Account**: promote, revoke, restore, delete). The commands stay the way in when no admin can sign in:

```bash
pnpm --filter web invite new --label "Marco" --days 3
pnpm --filter web invite list
pnpm --filter web invite revoke <id>     # withdraw one that has not been used
```

To manage the accounts themselves from the command line:

```bash
pnpm --filter web user list
pnpm --filter web user revoke <id> --reason "left the household"
pnpm --filter web user restore <id>
pnpm --filter web user promote <id>      # make them an admin too
pnpm --filter web user delete  <id>      # irreversible: takes their synced data with it
```

`revoke` takes effect at once: the account's sessions are deleted and its bearer stops being
accepted, so the phone keeps its local data but syncs nothing more. `promote` is the way back in if
you lose the phone holding the only admin passkey — run it against a second account you control.

**Upgrading an existing instance.** An account created before invites existed has no role, so it is
not an admin and cannot mint anything from the app. Give it one, once:

```bash
pnpm --filter web user list              # find the id
pnpm --filter web user promote <id>
```

### Server settings

From `/admin/settings` an admin changes, without editing a file or restarting, the **instance name**, the
**registration mode** and the **outgoing email (SMTP)**. They are stored in the `server_settings` table; an
environment variable that sets the same thing wins and locks it (the panel says which variable, and how to
change it: edit it where the server runs and restart, or remove it and choose in the panel).

- **SMTP by environment or by panel.** Either set `SMTP_HOST` (and the rest of the group) in the environment, or
  leave them out and fill the panel. Mail is optional: without it registration and sign-in work as before. The
  panel's **Manda un'email di prova** sends a message to *your own* address with the saved configuration, and
  shows the server's error if it fails. Port 465 is implicit TLS; any other port requires STARTTLS, except to
  `localhost` (a development catcher such as Mailpit).
- **What SMTP enables.** A new account, and Profilo → Account on request, sends a link that verifies the address
  (valid 24 hours; it does not sign anybody in, and verification is not required to use the app). And `/login` gains
  **«Hai perso la passkey?»**: somebody who lost their passkey asks for a link at `/recover`, which is mailed **only** to
  a verified address of a non-revoked account, valid 15 minutes and single-use; it signs a browser in and asks for a new
  passkey. That makes the mailbox as strong as the passkey (see [`SECURITY.md`](../SECURITY.md)). **Leaving SMTP
  unconfigured disables all of it**: `/recover` says recovery is not available, `/login` has no link, and the way
  back in for a lost passkey is an admin (`pnpm --filter web user …`). Each address is sent at most one message of
  a kind a minute and five an hour; that counter, like the rate limiter, lives in the process, so several replicas
  multiply it. `PUBLIC_URL` must be the site's origin with no path prefix: the confirmation link is built from it.
- **Testing mail locally.** Run [Mailpit](https://mailpit.axllent.org) — `docker run --rm -d -p 1025:1025
  -p 8025:8025 axllent/mailpit` — and set SMTP host `localhost`, port `1025`, no user, any sender, in `/admin/settings`
  (a plain connection is allowed to `localhost`). Every message the server sends appears at <http://localhost:8025>.
- **The SMTP password is write-only.** It is encrypted (AES-256-GCM) under `SETTINGS_ENCRYPTION_KEY` before it is
  stored, is never sent back to a browser, and is replaced, not read. Changing the host or user needs the
  password typed again, so a stolen session cannot aim the stored one at another server.
- **The key.** `SETTINGS_ENCRYPTION_KEY` is what opens that password. Keep it with your other secrets. If it is
  lost or changed, only the stored SMTP password is lost: enter it again in the panel. There is no key rotation in
  0.3f — change the key, then re-enter the password.

#### Provider via SMTP

Saldo sends only through SMTP, and that is enough for a transactional provider: every one of them runs an SMTP relay
that takes the same five values as a mail server of your own. There is no `MAIL_TRANSPORT` switch or per-provider API
driver, because none is needed (decided 2026-10-01). What changes from one provider to the next is three things: the
host, what it wants as the user and password, and what it asks of your domain before it accepts a sender.

The five values are the `SMTP_*` group of the environment, or the same fields of `/admin/settings?edit=smtp`
(**Server**, **Porta**, **Utente**, **Password**, **Mittente**). The sender can be a bare address or
`Name <address>`; its domain is the one you verify with the provider. The check is the same every time: save, then
**Manda un'email di prova** — it sends to *your own* address with the saved configuration and shows the server's
error if the provider refuses (a wrong password, an unverified sender, a blocked port). The provider's own log says
the rest.

**Ports.** The rule is `transportSecurity` in `apps/web/src/server/mail/mailer.ts`: port **465** is implicit TLS
(the connection is encrypted before the first byte); **any other port requires STARTTLS**, and the send fails if the
server does not offer it, so a password is never sent over a connection that was not upgraded. A plain connection is
allowed only to `localhost`, `127.0.0.1` or `::1` — Mailpit, below. Every provider here supports both 465 and 587,
except Postmark (STARTTLS only: 587, 2525 or 25). If the host blocks the usual ports, Resend and Amazon SES also
listen on **2465** (implicit TLS) and **2587** (STARTTLS); Mailgun, Brevo and Postmark on **2525** (STARTTLS). Port 25
is often throttled or blocked by hosts; prefer the others.

**Domain verification, once.** The provider will not accept a sender it has not verified, and the records it asks for
are the same three everywhere, under its own names and values:

- **SPF** — a `TXT` (sometimes also an `MX`) record on the domain or on a return-path subdomain, naming the provider
  as allowed to send for it.
- **DKIM** — one `TXT` or a few `CNAME` records under `<selector>._domainkey.<domain>`, carrying the provider's
  signing key.
- **DMARC** — a `TXT` at `_dmarc.<domain>`, e.g. `v=DMARC1; p=none; rua=mailto:…`. Brevo requires it to call a domain
  authenticated; the others recommend it and Gmail and Yahoo ask it of anyone sending in volume. `p=none` is enough.

Copy each record from the provider's domain page rather than from a guide: the values are generated for your domain.
Then wait for the provider to mark the domain verified (minutes to a few hours; DNS can take up to 72) before the
first test. Sending from a subdomain (`saldo.example.com`, `mail.example.com`) rather than the apex is what Resend
recommends and what keeps the domain's own mail unaffected. Postmark and SES also verify a **single address** by a
confirmation link, which is enough to start; Mailgun's and SES's sandboxes send only to addresses *you* have verified
until you add a domain (Mailgun) or ask for production access (SES).

**Resend** — host `smtp.resend.com`; user is the literal `resend`; the password is an API key with sending permission;
the sender must be on a verified domain. Ports 465 or 587 (2465, 2587 and 25 also answer).

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=Saldo <saldo@example.com>
```

In the panel: Server `smtp.resend.com`, Porta `465`, Utente `resend`, Password the API key, Mittente
`Saldo <saldo@example.com>`. Domain: Resend's **Domains** page lists DKIM (`TXT`) and SPF (`MX` + `TXT`, by default on
a `send.` subdomain used as the return path); DMARC is recommended after verification.

**Postmark** — host `smtp.postmarkapp.com`; **user and password are both the Server API Token** (the stream is the
server's default transactional one; Saldo sends no stream header). A **Sender Signature**, confirmed by email, is
enough to send from that one address; verifying the domain (DKIM `TXT` + Return-Path `CNAME` `pm_bounces` →
`pm.mtasv.net`, which is also what makes SPF align) covers every address on it. STARTTLS only: port 587, or 2525 if
587 is blocked.

```bash
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<server API token>
SMTP_PASSWORD=<the same server API token>
SMTP_FROM=Saldo <saldo@example.com>
```

In the panel: Server `smtp.postmarkapp.com`, Porta `587`, Utente and Password the same token, Mittente a confirmed
signature or an address on the verified domain. Postmark also issues **SMTP Tokens** (an Access Key as user and a
Secret Key as password), if you would rather not hand the server API token itself to Saldo.

**Amazon SES** — host `email-smtp.<region>.amazonaws.com` for the region the identity is verified in
(`email-smtp.eu-west-1.amazonaws.com`, `email-smtp.eu-central-1.amazonaws.com`, …; not every region has an SMTP
endpoint — Milan does not). The **SMTP credentials are not your AWS keys**: the SES console (*SMTP settings* →
*Create SMTP credentials*) creates an IAM user whose SMTP user name is its access key id and whose SMTP password is
derived from its secret key *for that region*; they are shown once. Ports 465 or 2465 (implicit TLS), 587 or 2587
(STARTTLS). The sender must be a verified identity: a domain (Easy DKIM: three `CNAME` records; an optional custom
MAIL FROM subdomain adds an `MX` and an SPF `TXT`) or a single address confirmed by email. A new account is in the
**sandbox** — 200 messages a day, and only *to* verified addresses — until you request production access.

```bash
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=465
SMTP_USER=AKIAxxxxxxxxxxxxxxxx
SMTP_PASSWORD=<the SMTP password SES generated, not the secret access key>
SMTP_FROM=Saldo <saldo@example.com>
```

In the panel: Server the regional endpoint, Porta `465`, Utente the SMTP user name, Password the SMTP password,
Mittente an address on the verified identity.

**Mailgun** — host `smtp.mailgun.org`, or `smtp.eu.mailgun.org` for a domain created in the EU region (a domain lives
in one region; use the host of its region). Credentials are **per domain**: *Domain settings → SMTP credentials*. The
default login is `postmaster@<your domain>`; the password is the one Mailgun gives you there when you create or reset
it. Ports 465 (implicit TLS) or 587 (STARTTLS; 2525 and 25 also). The domain is verified with an SPF `TXT`
(`v=spf1 include:mailgun.org ~all`) and a DKIM `TXT` from the control panel; the `MX` and tracking `CNAME` Mailgun
lists are for receiving and click tracking, which Saldo does not use. The **sandbox** domain every account starts with
sends only to up to five authorized recipients.

```bash
SMTP_HOST=smtp.eu.mailgun.org
SMTP_PORT=465
SMTP_USER=postmaster@mg.example.com
SMTP_PASSWORD=<the SMTP password of that credential>
SMTP_FROM=Saldo <saldo@mg.example.com>
```

In the panel: Server `smtp.eu.mailgun.org` (or `smtp.mailgun.org`), Porta `465`, Utente `postmaster@mg.example.com`,
Password that credential's password, Mittente an address on the verified domain.

**Brevo** — host `smtp-relay.brevo.com`. The login is the **SMTP login** shown under *SMTP & API → SMTP* (the account's
email, or on newer accounts a generated `…@smtp-brevo.com` address); the password is an **SMTP key** from the same
tab — *not* an API key and not the account password. Ports 465 (implicit TLS) or 587 (STARTTLS; 2525 also). Brevo
authenticates a domain with three `TXT` records — a **Brevo code** proving ownership, **DKIM**, and **DMARC**
(`v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` if you have none) — and the sender must be on an authenticated
domain or be a sender you have confirmed by email.

```bash
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=465
SMTP_USER=<your SMTP login>
SMTP_PASSWORD=<your SMTP key>
SMTP_FROM=Saldo <saldo@example.com>
```

In the panel: Server `smtp-relay.brevo.com`, Porta `465`, Utente the SMTP login, Password the SMTP key, Mittente an
address on the authenticated domain.

**Set the group whole or not at all.** With `SMTP_HOST` in the environment, `SMTP_FROM` is required, `SMTP_PORT`
defaults to 587, `SMTP_USER` and `SMTP_PASSWORD` come together, and the panel's form is locked and says so. The same
values typed into the panel need no restart and take effect on the next message. For local development, keep using
Mailpit (above): host `localhost`, port `1025`, no user, any sender — the only case where a plain connection is
accepted.

## Collegare un client MCP (connecting an MCP client)

The server exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint, so each user can point their
own MCP client — Claude Code, Claude's custom connectors, Cursor, any client that speaks Streamable HTTP and OAuth —
at their data on this instance. There is no key to hand out: the client discovers the rest and sends the user to sign
in with their passkey.

- **The endpoint is `{PUBLIC_URL}/mcp`**, e.g. `https://saldo.example.com/mcp`. Every user finds it, with the exact
  line for their client, in Profilo › Connettori. For Claude Code:

  ```bash
  claude mcp add --transport http saldo https://saldo.example.com/mcp
  ```

  The first call opens the browser on `/oauth/consent`: the user signs in, chooses read only or read and write, and the
  client is connected. A terminal with no browser can go through `npx mcp-remote https://saldo.example.com/mcp`.
- **`PUBLIC_URL` has to be `https://`.** MCP clients refuse to authorize against plain `http` anywhere but on the same
  machine (`http://localhost`). The documents a client reads to find the rest —
  `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` (each also at its path-aware
  form) — are served on this host; the issuer they name is `{PUBLIC_URL}/api/auth`, and the OAuth endpoints are under
  `/api/auth/oauth2/`. So `PUBLIC_URL` must be the address clients actually reach, and a reverse proxy has to pass
  `/mcp`, `/.well-known/` and `/api/auth/` through like the rest. `/admin/mcp` shows the two documents and warns when
  `PUBLIC_URL` is plain `http` on another host.
- **Switching it off.** It is on by default. An admin switches it off at `/admin/mcp`, which also shows how many users
  have connectors; `MCP_ENABLED=false` does the same from the environment and locks the switch (`true` locks it
  on). Off, `/mcp`, the `.well-known` documents, registration and authorization answer 404 and the consent page
  refuses; refreshing and revoking tokens keep working, so authorized connectors resume when it is back on. Nothing is
  deleted.
- **What a client may do** — tokens, scopes, revocation, the 180-day lapse — is in [`SECURITY.md`](../SECURITY.md),
  «MCP e connettori».

## Local development

One compose file brings up everything the server talks to — Postgres, and
[Floci](https://github.com/floci-io/floci) standing in for S3:

```bash
docker compose -f apps/web/docker/docker-compose.dev.yml up -d

cp apps/web/.env.example apps/web/.env
# then fill JWT_SECRET with: openssl rand -base64 48

pnpm --filter web db:migrate
pnpm --filter web dev          # http://localhost:3000
```

The server itself is deliberately **not** in that file: it runs from source so a change reloads
without a rebuild.

**Watch the port it actually binds.** If something else already holds 3000, Next quietly starts on
3001 — and then `PUBLIC_URL` no longer matches the origin the browser sees, so the passkey ceremony
fails with an opaque WebAuthn error. Free the port, or set `PUBLIC_URL` to the one it chose.

Postgres is published on 5432, and `POSTGRES_PORT` moves it when another project already holds
that port — `DATABASE_URL` has to follow. Floci listens on 4566 and creates the
`saldo-attachments` bucket on startup through
`apps/web/docker/floci-init/01-create-bucket.sh`.

To develop against S3 rather than a disk, uncomment the `s3` block in `.env` — it is already filled
in with what Floci serves (`test`/`test`, `us-east-1`, path-style). The attachment upload then
takes the same presigned route it would take against a real bucket, which is the part worth
exercising locally: it is the one a proxied upload would never reach.

`pnpm --filter web test` runs the route-handler tests against an in-memory Postgres (PGlite), so
they need no running database. The S3 driver has its own integration test that runs against Floci
when it is up and **skips itself** when it is not.

### Testing from a phone

The phone must reach the server over HTTPS, and `PUBLIC_URL`/`WEBAUTHN_RP_ID` must match the
hostname the phone uses. The simplest way is a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# or: tailscale funnel 3000
```

Then start the server with `PUBLIC_URL=https://<tunnel-hostname>` and
`WEBAUTHN_RP_ID=<tunnel-hostname>`. Passkeys created against a temporary tunnel hostname stop
working when that hostname changes.

## Attachments

Receipts and photos are optional, and where their bytes live is your choice — `ATTACHMENT_STORAGE`:

| Value | What you also set | Notes |
| --- | --- | --- |
| `none` (default) | — | Attachments stay on the phone. They are still captured and their rows still sync, so another device shows them as unavailable rather than missing. |
| `fs` | `STORAGE_DIR` | A directory on the server. Back it up with the database. Not for Vercel: its filesystem is wiped on every deploy. |
| `s3` | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optionally `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` | Amazon S3, and through `S3_ENDPOINT` also Cloudflare R2, MinIO, Backblaze B2 and Hetzner. |
| `vercel-blob` | `BLOB_READ_WRITE_TOKEN` | Vercel injects the token. Note the caveat below. |

Uploads take the shortest route the store allows: with S3 the phone uploads straight to the bucket
through a URL the server signs for that one object, its exact size and its exact type. That is not
an optimisation — a serverless function caps its request body well below the 10 MB an attachment
may reach, so a proxied upload would simply fail there.

Cloudflare R2, as an example:

```bash
ATTACHMENT_STORAGE=s3
S3_BUCKET=saldo
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
```

Deleting a transaction does not delete its attachment bytes straight away: the row becomes a
tombstone, the server notes the blob in a small queue, and the bytes go a week later — late enough
for a phone that has been offline to hear about the deletion first.

**A caveat about Vercel Blob:** every object in a Blob store is readable by anyone who has its URL —
the product has no private mode. Saldo gives each object a random pathname and never hands those
URLs to a client (downloads are proxied by the server, which checks who is asking), so a receipt is
not discoverable. But if a URL ever leaks, it works. If that matters to you, use `s3`, where the
server signs a URL that expires in five minutes.

## Limits

**How many transactions one household can hold.** The app reads a whole date range out of SQLite
and folds it in memory — no aggregation happens in SQL. That puts a ceiling on the number of rows
an account can carry before a screen takes visibly long to draw, so we measured it rather than
guessed:

| Fold | Where you see it | 5k rows | 20k rows | 50k rows |
| --- | --- | --- | --- | --- |
| `accountBalances` | Accounts tab, account detail | 0.3ms | 1.9ms | 9.3ms |
| `summarizePeriod` | Home header, Statistics | 0.1ms | 0.6ms | 2.2ms |
| `spendingByCategory` | Statistics, budgets | 0.2ms | 0.4ms | 2.5ms |
| `spendingByTag` | Statistics tag ranking | 0.2ms | 1.0ms | 2.6ms |
| `dailyCumulative` | Home and Statistics chart | 0.2ms | 0.7ms | 2.8ms |
| `monthEndBalances` (8 months) | Account sparkline | 1.1ms | 5.2ms | 43.4ms |
| `periodHistory` (6 periods) | Statistics baselines | 0.4ms | 2.8ms | 19.8ms |
| `categorySpendHistory` | Statistics baselines | 0.1ms | 0.3ms | 1.1ms |
| `budgetProgress` (8 budgets) | Budgets tab | 0.0ms | 0.0ms | 0.0ms |
| **Statistics screen, every fold it runs** | | **1.1ms** | **4.7ms** | **49.4ms** |

**What this means for you:** 20k transactions is comfortable — the busiest screen spends under 5ms
on arithmetic — and 50k still finishes a screen's worth of folding in well under a tenth of a
second. 20k rows is roughly fifteen years of a household recording four transactions a day, so in
practice you will not reach it. Past 50k the thing that degrades first is memory rather than
arithmetic: the whole range is held as objects, and the 50k figures above vary run to run because
of garbage collection.

**Read those numbers as a floor, not a prediction.** They come from
`pnpm --filter mobile measure:perf <rows>`, which runs the calculations in Node on a development
Mac with no database and no rendering in the way. A phone runs them under Hermes, which is slower,
and has a screen to draw as well — so assume a device is materially slower than this table, by a
factor nobody here has measured on real hardware. What the table does establish is that the
*arithmetic* has room to spare: if a screen ever feels slow, look at the SQLite query or at the
render before blaming the sums. The heaviest fold is the account sparkline, which walks the whole
ledger once per point drawn.

## Versions and compatibility

The app and the server are built from the same repository, and the number that has to match is
`SYNC_SCHEMA_VERSION` in `packages/core/src/sync/protocol.ts` — **currently 1**. Both sides import
it from the same package, so they can only disagree when they were built from different commits,
which is exactly what happens when you update one and not the other.

The check is exact equality, and a mismatch stops sync rather than letting it go wrong quietly. Both
answers are a `409` naming the two numbers and which side to move:

| What happened | The app is told |
| --- | --- |
| The server is newer (`schema_too_old`) | This server speaks sync schema *n*; the app speaks *n−1*. Update the app. |
| The app is newer (`schema_too_new`) | This server speaks sync schema *n*; the app speaks *n+1*. Update the server. |

**Nothing is lost while they disagree.** Saldo is local-first: the app keeps working, you keep
adding transactions, and the changes stay queued on the phone until a server it can talk to shows
up. What stops is the exchange, not the app.

`/api/health` reports `schemaVersion` alongside `apiVersion` and the server's own version, so you
can see what an instance speaks without signing in.

### Updating

Update the server first, then rebuild the phones. The server is one place and takes minutes; the
phones are sideloaded one at a time, and until each is rebuilt it simply queues. Doing it the other
way round works too — it just means the phone you updated first is the one that stops syncing.

Two things to know before you bump a schema version:

- **Both sides run migrations.** The server migrates on deploy; the app migrates on next launch. A
  phone that is never opened again keeps its old database, and its queued changes with it.
- **Rolling the server back is not free.** Once a phone has pushed rows written under a newer
  schema, an older server may not be able to represent them. Roll back only if no phone has pushed
  since the update, and otherwise go forward.

### If you are changing Saldo yourself

Bump `SYNC_SCHEMA_VERSION` when a row written by the new code cannot be read correctly by the old:
a new required field, a changed meaning, a removed one. Do **not** bump it for a change only the UI
can see. The gate above is what keeps an old peer from silently dropping data it cannot represent
(§8.1), so an unnecessary bump costs everyone a rebuild for nothing, and a missing one costs
somebody their data.

## Security notes

- Authentication is [Better Auth](https://better-auth.com) with its passkey plugin: it owns accounts,
  passkeys, sessions and revocation. A session is renewed as it is used, so the app holds one
  credential rather than an access/refresh pair.
- Signing in on the phone runs the passkey ceremony on this server's `/auth/mobile` page — WebAuthn
  needs a browser — and the session is handed to the app through a **single-use, one-minute** token
  in a link to the app's own URL scheme (`saldo://`, unless the build set `SALDO_SCHEME` — which
  this server must then allow through `APP_REDIRECT_SCHEMES`). Another app on the phone can register
  that scheme, so the narrow window is a real (accepted) exposure; closing it properly needs a
  verified app link (`webcredentials:` / `assetlinks.json`), which requires a paid Apple Developer
  account.
- The auth endpoints are rate limited by Better Auth (20 requests per minute, and a stricter 3 per
  10 seconds on `/sign-in`, `/sign-up` and the password/email-change routes). It keys on the
  caller's IP, resolved from `X-Forwarded-For` — which only trusts a single-value header unless
  `TRUSTED_PROXIES` names the reverse proxy in front of this server (see the Configuration table
  above and `apps/web/docker/Caddyfile.example`). Left unset behind a real reverse proxy, every
  caller resolves to no IP and shares one bucket, so a single attacker can starve everyone else's
  `/sign-in` attempts.
- **That limiter's storage is in-memory, and stays that way — this repository does not implement a
  shared store.** It is correct for the one-container `docker-compose.yml` this repo ships. It is
  wrong the moment you run more than one replica, or deploy to Vercel: each process (each replica,
  each serverless invocation) counts requests only against its own memory, so the effective limit
  multiplies by however many of those there are, silently. Better Auth accepts a
  `rateLimit.storage: 'secondary-storage'` for exactly this case; wiring one up is outside this
  repo's scope.
- The mobile `redirect_uri` is allow-listed by scheme, server-side, before a ceremony can start.
- Login is discoverable-credential only: no identifier is asked for, so sign-in cannot be used to
  find out whether an account exists.
- A passkey-only account has no email address, so it gets a synthetic one under the reserved
  `.invalid` domain. Nothing is ever sent to it.
