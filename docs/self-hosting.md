# Self-hosting Saldo

The Saldo server (`apps/web`) is optional. The app is local-first: everything works without it. You
need a server only for passkey sign-in, multi-device sync and attachment backup.

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

`app` and `apiVersion` are what the mobile app looks for when you type a server URL into it, and
`registrationAllowed` is what decides whether it offers "create account".

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

## Security notes

- Tokens: a 15-minute access JWT plus a rotating refresh token. Presenting a refresh token that was
  already rotated revokes the whole chain, so a stolen token cannot be used for long.
- The auth endpoints are rate limited to 10 requests per minute per IP. The limiter is in-memory,
  which means it is **per process**: behind more than one replica each one enforces its own share.
- Auth codes are single-use with a 60 second lifetime, PKCE is mandatory, and the mobile
  `redirect_uri` is allow-listed by scheme.
- Sign-in errors never say whether an account exists.
