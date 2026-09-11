# Saldo

Open-source, local-first personal finance app. Track spending period by period, with budgets and statistics, on your
phone. Sign in once with a passkey to a server you run yourself; after that it works offline, and syncs across your
devices when it can. Build it yourself, sideload it, own your data.

> Status: proof of concept in progress. See the [roadmap](docs/superpowers/plans/README.md).

## Repository

| Path | What |
| --- | --- |
| `apps/mobile` | Expo (React Native) app for Android and iOS |
| `apps/web` | Next.js server: API, passkey auth, sync — see [self-hosting](docs/self-hosting.md) |
| `packages/core` | Domain model and calculations (pure TypeScript) |
| `packages/ui` | Design tokens and icon data |
| `packages/i18n` | Italian and English catalogs, formatters |
| `docs/` | Design reference, spec, implementation plans |

## Running it locally

**Node 22**, not newer: `better-sqlite3` ships a native module built for that ABI, and the mobile
test suite will not load under Node 24 or 26. `.nvmrc` says so — `fnm use` or `nvm use` picks it up.
You also need pnpm 10, Docker, and Xcode (or Android Studio) for the app itself.

```bash
fnm use && node --version   # v22.x
pnpm install
```

### 1. What the server talks to

```bash
docker compose -f apps/web/docker/docker-compose.dev.yml up -d
```

Postgres on **5433** — 5432 is usually already taken by some other project — and
[Floci](https://github.com/floci-io/floci) on 4566 standing in for S3, with the attachment bucket
created for you. The server is deliberately *not* in there: it runs from source so a change
reloads without a rebuild.

### 2. The server

```bash
cp apps/web/.env.example apps/web/.env
openssl rand -base64 48        # paste into JWT_SECRET
pnpm --filter web db:migrate
pnpm --filter web dev          # http://localhost:3000
curl -s localhost:3000/api/health
```

Attachments are off by default (`ATTACHMENT_STORAGE=none`), which is a supported way to run: they
stay on the phone. To store them on the server, uncomment either the `fs` line or the `s3` block in
`.env` — the `s3` values are already filled in with what Floci serves.

> If something else is on port 3000, Next starts on 3001 without making a fuss, and the passkey
> ceremony then fails with an opaque WebAuthn error because `PUBLIC_URL` names the wrong origin.
> Free the port, or set `PUBLIC_URL` to the one it picked.

### 3. The app

The server address is baked into the build, so it goes on the command line rather than in a file:

```bash
cd apps/mobile
SALDO_SERVER_URL=http://localhost:3000 npx expo run:ios      # or run:android
```

Afterwards `npx expo start` is enough for JavaScript changes. Two things need the full rebuild
above: a **new native module**, and a **new migration** — for which you also delete the simulator's
database, because Metro caches the inlined SQL:

```bash
xcrun simctl get_app_container booted io.github.saldo.app data
rm -f "<that path>/Documents/SQLite/saldo.db"
```

On first run the app offers "Create account": `REGISTRATION=first-user` lets exactly one through.
The passkey ceremony needs a platform authenticator — on the simulator, enrol Face ID first
(Features → Face ID → Enrolled).

### Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Contributors and coding agents: start with [AGENTS.md](AGENTS.md).

## Self-hosting

The app needs an account on a server — sign-in is the first thing it asks for — and everything
after that is local-first: it works offline and keeps working when the server is down. The server
is what gives you multi-device sync and attachment backup.

See [docs/self-hosting.md](docs/self-hosting.md): one `docker compose` command with
`apps/web/docker/docker-compose.yml` (the deployment file, which builds the server into an image —
not the development one above), plus an HTTPS domain, which passkeys require.

## License

[MIT](LICENSE)
