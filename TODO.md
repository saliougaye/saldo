# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared ledger, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

None open.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### Onboarding: a better UI, and a step for the system permissions

- [x] Rework the onboarding screens (§6.29) — done as "Fuoco" (`docs/superpowers/plans/2026-09-22-onboarding-fuoco.md`):
      the old step dissolves, the new one arrives block by block, progress is 2px segments.
- [ ] Let the pay cycle start on the 29th–31st. §5.2 caps `cycleStartDay` at 28 "because February", but the core
      already clamps (`effectiveStart = min(S, daysInMonth)`, the S=31 example is in the spec). Offer the full 1–31 in
      the onboarding `cycle-day` grid and in Profile's day sheet, most likely as an "Ultimo giorno del mese" key
      standing for S=31 (that is the real question of anyone paid at month end), plus a one-line explanation that
      February counts the 28th. Touches §5.2, `DayOfMonthSheet`, `cycle-day.tsx` and one i18n key in both locales.
- [ ] Add a step that asks for the system permissions up front, each one with a sentence saying what it is for and
      a "Più tardi" that skips it. Today every permission is asked at the moment it is first needed:
  - **notifications** — budget alerts (§5.8), requested by `src/features/budgets/BudgetAlertsGate.tsx`;
  - **camera and photos** — attachments, requested by `src/attachments/capture.ts`;
  - **Face ID / biometrics** — the app lock (`app/lock.tsx`); this one is an opt-in setting, so the step offers to
    turn the lock on rather than asking for a permission.

  Open points: whether the step sits on both paths (*Da zero* and the import) or only after "Inizia"; that a denied
  permission cannot be asked again by iOS, so the step must not burn the one prompt the in-context request relies on
  (show our own explanation first, call the system prompt only on "Attiva"); and that Profile needs a place to see
  and change each one afterwards (a denied one links to the system settings).

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

### A mascotte in 3D — scope undecided

The idea is a 3D character, possibly a panda. The brand today is a raccoon: `docs/brand/mascotte/procione*.svg`
plus thirteen generator pages that render nine outputs (iOS light, dark and tinted; Android background, foreground
and monochrome; splash light and dark; favicon).

Two constraints to decide against, recorded so they are not re-derived:

- **Android monochrome and iOS tinted flatten to a single-channel silhouette.** Shading does not survive them, so
  those variants stay vector whatever the hero art becomes.
- **The current pipeline is HTML/CSS/SVG → PNG.** A 3D render needs a renderer alongside it, and 3D sits against
  an interface drawn in flat 1.5px strokes.

The cheap shape is therefore: keep the vector set for icons and splashes, and use 3D only where shading survives —
README, docs, a future landing page. Whether the character stays a raccoon or becomes a panda is a free choice
either way. The empty states (§13) already have a mascot variant waiting: variant D of their design review, the
raccoon peeking over the ghost stack, would replace `GhostStack` alone.

### Considered on 2026-09-18 and not planned

Kept so they are not re-derived.

- **Settling an account ("Controlla il saldo").** Analysed in
  `docs/superpowers/analysis/2026-09-17-settle-an-account.md` (a balance checkpoint after an import). Dropped on
  2026-09-21: onboarding's import path already asks each imported account's current balance (§6.29), and the
  account sheet's balance field covers a balance that drifts later.
- **Field-level merge.** `packages/core/src/sync/merge.ts` is whole-row last-writer-wins; the settle analysis
  shows the cost (a rename on one phone can undo a balance edit on another). Rare in practice — rename against
  colour, one settings toggle against another. Not worth the machinery.
- **Native passkeys (§9.4).** D13 still holds: a free Apple ID cannot sign Associated Domains, and the app is
  sideloaded. Pointless until there is a store build.
- **Multi-currency.** §1.2 excludes it with a reason (historical rates per transaction date). A decision, not a gap.
