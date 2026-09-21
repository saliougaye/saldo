# Roadmap

Where Saldo goes after the proof of concept, in the order the work has to happen. Each milestone is a
coherent release a self-hoster can update to. The product milestones come first and their order is a
product call, provisional until the one before ships; going public and releasing come last, once the
feature set is what the repository will be judged on, and their order is fixed by dependencies (a release
needs a public repository to publish to).

This file holds the big directions. Bugs, small features and ideas that fit in one plan live in
[`TODO.md`](TODO.md); the POC phases that are already built, with their plans and acceptance criteria, live
in [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md). When a milestone is picked up
it gets a spec section and a plan under `docs/superpowers/plans/` like any other piece of work, and this
file records what was decided.

Every milestone keeps the rules that make Saldo what it is: local-first, integer money, business rules in
`@saldo/core` with tests first, no third-party call the user did not ask for. Where a milestone bends one
of them (the AI milestone bends the last one), the bend is written down here before it is built.

```
0.1 Shared ledger ─────────────────────┐
0.2 AI, bring your own key ────────────┼──> 0.4 Public repository ──> 0.5 Releases & distribution
0.3 Web app & end-to-end encryption ───┘
```

---

## 0.1 — Shared ledger

Saldo exists to replace Spendee's paid features (§1), and shared wallets is one of them. Spec §1.2 excludes
households from the POC; this is the note that it is the next non-goal to fall.

Phase 10b in `docs/superpowers/plans/README.md` is labelled a stopgap, and the proper fix (scoping the
local rows) was put off on 2026-09-12 because *what the rows would be scoped by* is undecided. The two
shapes are already written there and are kept apart on purpose:

- **Two people, one account.** Each registers a passkey on the same user. The server already works this
  way; what is missing is adding a passkey to an existing account — `resolveUser` always mints a new user
  and `addPasskey` wants a session. No local scoping needed. Cheap, and it covers a couple.
- **Two accounts, shared data.** An owning entity (space, household), a membership table, the pull scoped
  to the spaces a user belongs to (`sync_rows` is keyed `(user_id, entity, id)` and the pull is
  `where user_id = ?`), and a rule for rows when somebody leaves. The LWW merge already tolerates more
  writers.

The first shape is a weekend; the second is a phase. They are not exclusive — the first can ship as a
step towards the second, or the second can make the first unnecessary.

**To decide before planning:**

- [ ] Which shape, or which first. This is the decision that unblocks the proper fix to 10b.
- [ ] Trust between members: `SECURITY.md` says today that two people who do not trust each other on one
      server are not served. A shared ledger either keeps that line or has to earn its removal.
- [ ] Spec section (`§5.x Shared ledger`), then the plan.

**Done when:** two phones with two passkeys see the same transactions, budgets and accounts, and the
10b stopgap label comes off.

---

## 0.2 — AI, bring your own key

Spec §17.2 and §17.3. Both halves share the provider settings (Anthropic or an OpenAI-compatible base
URL), the key in `expo-secure-store` — never synced, never sent to the Saldo server — and the consent
question, so whichever is built first builds those for both.

**The thing to settle before building either:** this is the first outbound call to a host the user does
not run, and §18 currently promises no third-party network calls at all. That line changes with the
feature, and the consent has to be explicit rather than a settings toggle nobody reads. Worth a spike
first — the interface, one driver, and the settings screen — rather than a full build.

### Receipt analysis (§17.2)

The spec already fixes the shape: a `ReceiptAnalyzer` in `@saldo/core/ai`, and
"Allega foto" → "Analizza scontrino" → a prefilled transaction sheet the user always confirms. Phase 09b
already shipped everything it stands on: capture, compression, the local file store, the viewer, and the
category list the prompt needs.

### Spending insights (§17.3)

An `InsightsProvider` in `@saldo/core/ai`, fed **aggregates only** — per-cycle category totals, budgets
and trends out of `@saldo/core` — never raw descriptions unless the user opts in, with results cached
locally per cycle. The forecast in `TODO.md` computes exactly the aggregates this would consume; whichever
ships first should expose them from `@saldo/core` in a shape the other can reuse.

**To decide before planning:**

- [ ] Which half first. Receipts have the more visible payoff and the smaller prompt; insights reuse the
      forecast aggregates and never send an image.
- [ ] The wording of the §18 change and of the consent screen.
- [ ] Spike, then spec update, then the plan.

**Done when:** a user with their own key scans a receipt into a prefilled sheet (or reads a cycle
insight), a user without a key never sees a network call leave the phone, and §18 says exactly what
leaves and when.

---

## 0.3 — Web app & end-to-end encryption

Two futures that constrain each other, recorded so the first one built does not close the second by
accident. Neither is next; they are here so 0.1 and 0.2 do not decide them by default.

**Web app (spec §17.1).** D3 says `apps/web` «becomes the web app later»; today `apps/web/app/page.tsx` is
fifteen lines. The spec offers two data paths and decides neither: query `sync_rows` server-side through
`@saldo/core` (D11 foresees a «typed projection»), or run local-first in the browser with SQLite WASM and
the same sync client. The second reuses what the phone already has; the first makes the server read the
data.

**End-to-end encryption.** The server is already nearly a blob store:
`packages/core/src/sync/protocol.ts:27` carries `data: z.unknown()`, D11 stores it opaquely, and no route
has relational logic. What stands in the way is small but real: `apps/web/src/server/sync/push.ts:16`
validates every row against `entitySchemas` (the server reads the content), attachment bytes sit on the
server in clear, and `deletedAt` stays visible in the envelope. Key handling is the hard part — the
passkey PRF extension is out of reach through the browser ceremony and one-time token handoff, so it would
be a separate key the user has to keep, with the recovery story that implies.

**The constraint:** a server-side web app needs to read rows; encrypted rows cannot be read. Pick one
before either is built. A shared ledger (0.1) with the «two accounts, shared data» shape adds a third
party to the key question: who holds the space's key, and how a new member gets it.

**To decide before planning:**

- [ ] Web app data path: server-side projection or browser local-first.
- [ ] Whether E2EE is a goal at all, and if so what the recovery story is when the key is lost.
- [ ] Dedicated spec (§17.1 says so), then the plan.

**Done when:** the decision is written in the spec, whichever is built first, and the other is either
scheduled or explicitly dropped with the reason.

---

## 0.4 — Public repository

What stands between this repository and its first public push. Audited on 2026-09-18. The repository has
no remote yet, so the first push publishes all 316 commits at once.

**Verified clean and needing nothing:** no `.env`, keystore, `.p12` or personal CSV was ever added in
history; no `sk-`/`ghp_`/`AKIA`/private-key patterns in tracked files; `.env*`, `.vercel`, `.screenshots`
and `transactions_export_*.csv` are ignored; the screenshots in `docs/screenshots/` are demo data with no
real figures; the Spendee fixture is anonymised (`"A Person"`, `"My Money"`); dependency licences hold no
copyleft trap (`node-forge` is dual BSD-3/GPL-2, `@img/sharp-libvips-*` is an LGPL native binary Next pulls
in). The commit author address stays as it is: the repository will be `saliougaye/saldo`, so the name is
public either way.

### Blockers — none of these survive the first push

- [ ] **A security contact.** `SECURITY.md` still says
      `**<!-- SECURITY CONTACT: set this before publishing -->**`, which renders as bold nothing. Put a real
      address there, and turn on GitHub's private vulnerability reporting once the repo exists — the file
      already says that is the better channel.
- [ ] **The repository slug.** `apps/web/app/page.tsx:11`, `docs/building-android.md:107`,
      `docs/building-ios.md:60` and `docs/self-hosting.md:44` name `github.com/saldo-app/saldo`, which does
      not exist; the first is on the landing page every server instance serves. All become `saliougaye/saldo`.
- [ ] **References to a prototype that is not published.** `docs/design/` is gitignored and stays that way,
      but `AGENTS.md:11` sends every implementing agent to `docs/design/README.md` and the line ranges of
      `Spese.dc.html`, `CONTRIBUTING.md:11` links the same README, and source comments cite its line numbers
      (`packages/ui/src/icons.ts:3`, `packages/ui/src/tokens.ts:1`, `packages/i18n/src/locales/it.ts:1`,
      `src/features/stats/CashflowChart.tsx`, `SpendHistoryChart.tsx`, `scripts/generate-demo-data.mjs`). A
      public contributor follows those to a 404. Rewrite each reference to say what the file *was* and that
      it is not part of the repository, without pretending the tokens and icons came from nowhere.

### Worth doing in the same pass

- [ ] **Community health files.** No `CODE_OF_CONDUCT.md`, no `.github/ISSUE_TEMPLATE/`, no
      `PULL_REQUEST_TEMPLATE.md`, no `dependabot.yml`. `CONTRIBUTING.md` tells people to open an issue
      describing the behaviour before sending a fix, and gives them no template to shape it.
- [ ] **Decide what happens to `.claude/`, `.agents/` and `skills-lock.json`.** All three are untracked
      *and* un-ignored, so a `git add .` before the first push commits them. Either ignore them or commit
      them on purpose.
- [ ] **Local paths and a first name in tracked files.** `/Users/saliougaye/…` and `rtk proxy` (a private
      local wrapper) appear in `docs/superpowers/plans/2026-09-13-11-release-and-hardening.md:978,1076,1250`
      and `2026-09-19-more-colors-icons.md`, and `apps/web/src/server/auth/admin.test.ts:88` uses `'Saliou'`
      as a display name. Cosmetic, but the paths read as an accident rather than a choice.
- [ ] **A dependency gate in CI.** `.github/workflows/ci.yml` runs lint, typecheck and test only. A public
      repo gets Dependabot, CodeQL and secret-scanning push protection for free; `pnpm audit` is one more
      step.
- [ ] **The phase index understates what works.** The passkey ceremony was run on a real phone on
      2026-09-18 and it works. Six phases still end with a sentence saying it has never been driven — 06,
      06b, 07, 08, 10 and 11 in `docs/superpowers/plans/README.md`, and with it the `SALDO_SCHEME` round
      trip, the invite burn in `afterVerification`, the first-account-becomes-admin rule and the connected
      state of §6.30. That index is the first thing a visitor reads, so correct it before the repository is
      public: record what was actually exercised on the device, and leave the rest listed as still open.

**Done when:** the repository is public at `github.com/saliougaye/saldo`, private vulnerability reporting
is on, and a stranger can follow every link in `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and
`AGENTS.md` without hitting a 404 or a private path.

---

## 0.5 — Releases & distribution

Self-hosting currently means building the server from source, and installing the app means owning a Mac
or an Android SDK. `.github/workflows/ci.yml` is the only workflow: nothing is published anywhere. Found
on 2026-09-18 while asking what an open-source self-hoster sees.

### Releases first: there is nothing to update *to*

`git tag` returns nothing, there is no `CHANGELOG`, and `apps/web/src/server/version.ts:5` hard-codes
`APP_VERSION = '0.1.0'`, so `/api/health` and the landing page report the same version whatever commit is
running. `docs/self-hosting.md` §Updating explains the order (server first, then the phones) but the only
thing to update to is `main`, and a `SYNC_SCHEMA_VERSION` bump with no release note is discovered as a
`409` on the phone. The image and the fork workflow below need a tag to hang on anyway, so this comes
first:

- [ ] Semver tags (`v0.1.0` …) and a `CHANGELOG.md` whose entries say in the first line whether
      `SYNC_SCHEMA_VERSION` or `apiVersion` moved — that line is what a self-hoster reads before pulling.
- [ ] `APP_VERSION` derived from the tag at build time (the file's own comment says why it cannot read
      `package.json` at runtime; a build-time inject keeps that property).

### Then distribution

`SALDO_SERVER_URL` is baked in at build time (08b), so **one official APK cannot exist** — but two things
can:

- [ ] A tagged server image on `ghcr.io`, so `docker compose` pulls instead of building. Tagged with the
      same version as the release, and `latest` only on a tagged build.
- [ ] A reusable workflow a user runs in their own fork, with their own `SALDO_SERVER_URL` and signing
      secrets, producing a signed APK as an artifact. It pins itself to a tag too, so the APK a user builds
      says which release it is.

The second one needs care in the writing: keystore-in-secrets guidance, and a hard rule that this
repository never publishes an APK of its own, because any APK it built would point at the wrong server.

**Done when:** `docs/self-hosting.md` quick start pulls an image instead of cloning, `/api/health` reports
the tag it was built from, and a fork owner gets a signed APK without a Mac.
