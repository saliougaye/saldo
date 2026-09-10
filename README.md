# Saldo

Open-source, local-first personal finance app. Track spending by pay cycle, budgets and statistics on your phone,
with optional self-hosted sync and passkey login. Build it yourself, sideload it, own your data.

> Status: proof of concept in progress. See the [roadmap](docs/superpowers/plans/README.md).

## Repository

| Path | What |
| --- | --- |
| `apps/mobile` | Expo (React Native) app for Android and iOS — _phase 02_ |
| `apps/web` | Next.js server: API, passkey auth, sync — _phase 06_ |
| `packages/core` | Domain model and calculations (pure TypeScript) |
| `packages/ui` | Design tokens and icon data |
| `packages/i18n` | Italian and English catalogs, formatters |
| `docs/` | Design reference, spec, implementation plans |

## Development

Requirements: Node 22+, pnpm 10+.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

Contributors and coding agents: start with [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
