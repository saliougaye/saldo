# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared ledger, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

None open.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### Loading states where they are missing

- [ ] Asked for on 2026-09-22. Give every screen that reads the database a loading state, with the primitives that
      already exist.

The pieces are there: `SkeletonList`/`SkeletonRow` (`src/components/Skeleton.tsx`), `LoadingScreen`, `useDelayed`
(no flash on a fast load) and the `loaded` flag of the `use*Query` hooks (`src/db/hooks.ts`). Only three screens use
them: Transazioni (`SkeletonList`), Statistiche (`StatsSkeleton` behind `useDelayed`) and `account/edit/[id]`
(`LoadingScreen`). The rest, as of today:

- **Blank while loading** (`!loaded ? null`) — `budgets.tsx`, `recurrences.tsx`, `settings/categories.tsx`, and the
  detail screens `account/[id]`, `category/[id]`, `transaction/[id]` (`if (!loaded) return null`). Also check
  `recurrence/[id]` and `tag/[id]`, `settings/tags.tsx`.
- **No `loaded` check at all** — Home (`(tabs)/index.tsx`), Conti (`(tabs)/accounts.tsx`), `budget/[id]`,
  `category/edit/[id]`, `transaction/edit/[id]`, `settings/archived-accounts.tsx`, `settings/archived-categories.tsx`.
  These may show the empty state (or an empty form) for a frame before the data lands — verify on the simulator.

Lists get a skeleton shaped like their rows; detail and edit screens get `LoadingScreen`; everything goes through
`useDelayed`. Never the empty state before `loaded`. Home and Conti may want their own skeletons (hero balance,
account cards) like `StatsSkeleton`.

### Five more languages: French, German, Swedish, Spanish, Portuguese

- [ ] Asked for on 2026-09-21. Scope the catalogs and the formatting tables, then plan.

Today the app speaks `it` and `en` only (`SUPPORTED_LOCALES` in
`packages/i18n/src/format.ts:13`). A language is more than a catalog:

- **The catalog.** `packages/i18n/src/locales/{fr,de,sv,es,pt}.ts`, ~760 keys each, registered in `resources`
  (`packages/i18n/src/index.ts`). The parity test (`locales.test.ts`) only compares `it` against `en`; it has to
  check every catalog against `it`, keys and `{{variables}}` both.
- **The formatting tables.** `format.ts` hand-writes, per locale, the separators, short and long months and short and
  long weekdays (`Record<AppLocale, …>`, no `Intl`). Each new locale fills all five, and the separators differ:
  `de`/`es`/`pt` `.` and `,`, `fr` and `sv` a (narrow) no-break space and `,`. Pin them with `format.test.ts` cases.
- **The setting.** `language` is `z.enum(['system', 'it', 'en'])` in `packages/core/src/entities.ts:50`, a synced
  field, plus the column type in `apps/mobile/src/db/schema.ts:33` and `seed.ts`. Widening the enum means an older
  build rejects a settings row written by a newer one — acceptable before release (see the frozen
  `SYNC_SCHEMA_VERSION`), worth a line in the changelog after. `resolveLocale` must map `pt-BR`/`pt-PT`, `es-*`
  etc. to the base language.
- **The Language screen** (`app/profile/language.tsx`) grows from three rows to seven; each language named in its
  own tongue, not translated.
- **Quality.** Machine-drafted text is fine for a start, but the Italian copy is written with care (tone, short
  labels that fit the design). Each catalog needs a native read before it ships, and German will overflow some
  buttons and chips — check the longest strings on the simulator.

Open point: `pt` as one catalog, or `pt-PT` and `pt-BR` separately (they differ in vocabulary more than in grammar).
Suggested: one `pt` (European) for now.

## Ideas

Directions worth keeping, not yet asked for as work. Most reopen a product decision.

### Mascot states

The mark is Rocky, the 3D raccoon generated in github.com/saliougaye/mascots (branch `mascot/saldo`); the app icons,
splash and favicon in `apps/mobile/assets/` are copies of its `out/saldo/icons/`.

The kit also carries Lottie state animations and illustrations (empty, loading, error, success, thinking, idle).
The empty states (§13) are the obvious first use: variant D of their design review would replace `GhostStack`.
