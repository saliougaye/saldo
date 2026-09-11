# Self-hosting Saldo

The Saldo server (`apps/web`) holds the accounts, so a Saldo app needs one: sign-in is the first
thing it asks for. Everything after that is local-first — the app works offline and keeps working
if the server is down — and the server is what gives you multi-device sync and attachment backup.

The app is **built for one server**: you set `SALDO_SERVER_URL` when you build the APK or the iOS
app, and nobody types an address on the phone (§15 of the spec, and `docs/building-*.md`).

## What you need

- A machine with Docker (or Node 22 + Postgres 17 if you prefer to run it directly).
- **A domain served over HTTPS.** This is not a preference: passkeys (WebAuthn) only work in a
  secure context. The single exception browsers make is `http://localhost`, which is why local
  development works without a certificate.

## Configuration

| Variable | Example | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | `https://saldo.example.com` | Origin used for WebAuthn and for links. Must be https, or `http://localhost` for development. |
| `WEBAUTHN_RP_ID` | `saldo.example.com` | Relying party id: the **registrable domain** of `PUBLIC_URL` — no scheme, no port, no path. |
| `WEBAUTHN_RP_NAME` | `Saldo` | The name the passkey prompt shows. |
| `JWT_SECRET` | 32+ random bytes, base64 | Signs access tokens. `openssl rand -base64 48`. |
| `DATABASE_URL` | `postgres://saldo:…@postgres:5432/saldo` | |
| `STORAGE_DIR` | `/data/attachments` | Where attachment blobs are written (used from phase 08). |
| `REGISTRATION` | `first-user` | `open`, `first-user` (allowed only while no account exists) or `closed`. |
| `APP_REDIRECT_SCHEMES` | `saldo` | Comma-separated URL schemes accepted as a mobile redirect target. |

Two things to know before you start:

- **Changing `WEBAUTHN_RP_ID` invalidates every existing passkey.** A credential is bound to the
  relying party it was created for. Pick the hostname you intend to keep.
- Leave `REGISTRATION=first-user` for the first sign-up, then set it to `closed`. With `open`,
  anyone who can reach the server can create an account.

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

## Check that it works

```bash
curl -s https://saldo.example.com/api/health
# {"app":"saldo","apiVersion":1,"version":"0.1.0","registrationAllowed":true}
```

`app` and `apiVersion` are what the mobile app looks for when it reaches the server it was built
for, and `registrationAllowed` is what decides whether it offers "create account".

## Local development

```bash
# Postgres. Use another host port if 5432 is busy, and match DATABASE_URL to it.
docker run --rm -d --name saldo-pg \
  -e POSTGRES_USER=saldo -e POSTGRES_PASSWORD=saldo -e POSTGRES_DB=saldo \
  -p 5432:5432 postgres:17

cp apps/web/.env.example apps/web/.env
# then fill JWT_SECRET with: openssl rand -base64 48

pnpm --filter web db:migrate
pnpm --filter web dev          # http://localhost:3000
```

`pnpm --filter web test` runs the route-handler tests against an in-memory Postgres (PGlite), so
they need no running database.

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

## Security notes

- Authentication is [Better Auth](https://better-auth.com) with its passkey plugin: it owns accounts,
  passkeys, sessions and revocation. A session is renewed as it is used, so the app holds one
  credential rather than an access/refresh pair.
- Signing in on the phone runs the passkey ceremony on this server's `/auth/mobile` page — WebAuthn
  needs a browser — and the session is handed to the app through a **single-use, one-minute** token
  in a `saldo://` link. Another app on the phone can register that scheme, so the narrow window is
  a real (accepted) exposure; closing it properly needs a verified app link
  (`webcredentials:` / `assetlinks.json`), which requires a paid Apple Developer account.
- The auth endpoints are rate limited by Better Auth (20 requests per minute). Like any in-memory
  limiter it is **per process**: behind more than one replica each enforces its own share.
- The mobile `redirect_uri` is allow-listed by scheme, server-side, before a ceremony can start.
- Login is discoverable-credential only: no identifier is asked for, so sign-in cannot be used to
  find out whether an account exists.
- A passkey-only account has no email address, so it gets a synthetic one under the reserved
  `.invalid` domain. Nothing is ever sent to it.
