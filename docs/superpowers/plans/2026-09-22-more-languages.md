# Five more languages (fr, de, sv, es, pt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saldo speaks French, German, Swedish, Spanish and (European) Portuguese as well as Italian and English: a
catalog each, hand-written formatting tables that follow CLDR, a wider `language` setting, device tags such as `pt-BR`
or `de-AT` resolving to the base language, and a Language screen that names each language in its own tongue.

**Architecture:** `@saldo/i18n` stays `Intl`-free: `format.ts` moves from `locale === 'it' ? … : …` branches to one
`CONVENTIONS: Record<AppLocale, Conventions>` table (separators, grouping, symbol position, first weekday, month and
weekday names, date patterns). `resolveLocale` and a new `matchLocale` map any BCP 47 tag to an `AppLocale`. The
setting's enum lives in `@saldo/core` (`LANGUAGE_PREFERENCES`), and the mobile schema/seed reuse `Settings['language']`
instead of repeating the union. Catalogs are typed `Messages`, so a missing key fails `tsc` before the parity test.

**Tech Stack:** TypeScript strict, vitest (`@saldo/i18n`, `@saldo/core`), jest-expo (mobile), i18next 26.

**Branch:** `feat/more-languages`.

---

## Decisions

**Taken by the user (2026-09-22):**

- **One `pt` catalog, European Portuguese.** `pt-BR`, `pt-PT`, `pt-AO`… all resolve to it. Vocabulary is European
  (`ecrã`, `telemóvel`, `registar`), and so are the number conventions (see below).
- **Machine-drafted catalogs are acceptable for now.** They follow the Italian tone (plain, second person, short
  labels). **Each of `fr`, `de`, `sv`, `es`, `pt` needs a native read before release** — tracked in the checklist at
  the end.
- **`SYNC_SCHEMA_VERSION` is not bumped.** Widening `settings.language` from `system | it | en` to eight values means
  an older build rejects a settings row written by a newer one that picked a new language. No build is public, so this
  is accepted; once Saldo is released, such a change needs a changelog line (and a version bump if older clients are
  still around).

**Taken here (spec silent or needing verification):**

- **Formatting follows CLDR, verified with Node 22's ICU** (`Intl.NumberFormat` / `DateTimeFormat`), then hand-written:

  | | group | decimal | 4-digit | symbol | week starts | day + month | long date |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | fr | U+202F (narrow nbsp) | `,` | `1 234` | `12,50 €` | Monday | `18 avr.` | `18 avril 2026` |
  | de | `.` | `,` | `1.234` | `12,50 €` | Monday | `18. Apr.` | `18. April 2026` |
  | sv | U+00A0 (nbsp) | `,` | `1 234` | `12,50 €` | Monday | `18 apr.` | `18 april 2026` |
  | es | `.` | `,` | `1234` | `12,50 €` | Monday | `18 abr` | `18 de abril de 2026` |
  | pt | U+00A0 (nbsp) | `,` | `1234` | `12,50 €` | Sunday | `18 abr.` | `18 de abril de 2026` |

  - The TODO guessed `pt` groups with `.`; that is `pt-BR`. `pt-PT` (the catalog we chose) uses a no-break space. It
    guessed a narrow no-break space for `sv` too; CLDR's `sv` uses U+00A0, `fr` U+202F.
  - `es` and `pt` have CLDR `minimumGroupingDigits = 2`: a four-digit integer stays ungrouped (`1234,50 €`,
    `12.345,50 €`). New `Conventions.minimumGroupingDigits` implements it, for `formatMoney` and `formatMajor` both.
  - CLDR `pt-PT` formats day + short month numerically (`18/04`); every other locale here uses words, and the cycle
    range reads better in words, so `pt` uses `18 abr.`.
  - German has two short-month forms: the format one after a day (`18. Sept.`, `18. März`) and the stand-alone one
    (`Sep`, `Mär`). The chart tick (a month alone in an 11px slot) uses the stand-alone forms, via an optional
    `monthsTick` override; every other locale ticks with its format forms.
  - `pt` starts the calendar grid on Sunday (CLDR `firstDay` for PT). Display only: ISO weeks are untouched (§5.2).
- **`resolveLocale` picks the first *supported* device language**, not just the first one: `['nl-NL', 'de-DE']` →
  `de`. That is how iOS picks a localisation for an app, and with seven languages "first or English" is wrong more
  often than it used to be. `['en-GB', 'it-IT']` still gives `en`.
- **i18next is given `pt-PT`, not `pt`,** as its language code (`i18nextLanguage`). The catalog stays under `pt` and
  i18next falls back to it, but plural rules then come from `Intl.PluralRules('pt-PT')`: `0` is plural in Portugal
  (`0 transações`) and singular in Brazil. `matchLocale('pt-PT')` is `pt`, so `useAppLocale` is unaffected.
- **`_many` plurals.** CLDR gives `fr`, `es`, `pt` — and `it`, already today — a `many` category for round millions,
  and i18next then asks for `key_many`; missing, it falls back to *English*. Catalogs keep `_one`/`_other` only (the
  parity test compares key sets), and `resources` copies every `_other` to a `_many` sibling (`withManyPlurals`), which
  is what `many` means in all four languages.
- **Language names are autonyms, not translations**: `LANGUAGE_NAMES` in `@saldo/i18n` (`Italiano`, `English`,
  `Français`, `Deutsch`, `Svenska`, `Español`, `Português`). `profile.italian` / `profile.english` go away. The screen
  lists *Sistema* (translated), then Italiano, English, then the rest alphabetically by autonym: 8 rows (the TODO
  says seven; it counted three today, but `system` + seven languages is eight).
- **iOS permission prompts** (`apps/mobile/locales/*.json`, Face ID / camera / photos) get the five languages too:
  they are user-visible strings. `withAndroidLocaleDefaults` reads whatever `locales` lists, so nothing else changes.
- **Quotes**: fr `« … »` with U+202F inside, de `„…“`, sv `”…”`, es `«…»`, pt `«…»` — the house style of each.
- **No DB migration.** `settings.language` is a `text` column with a TypeScript-only `$type`, no CHECK constraint.
- The confirm word of §8.6 is translated: fr `SUPPRIMER`, de `LÖSCHEN`, sv `RADERA`, es `BORRAR`, pt `APAGAR`.
- Existing copy bug carried over, not fixed here: `accounts.missing_taken` and `categories.missing_taken` say "tag"
  in `it`/`en`; the new catalogs translate them faithfully so they are fixed in one go later.

---

## File map

| File | Change |
| --- | --- |
| `packages/i18n/src/format.ts` | `CONVENTIONS` table; `matchLocale`, `resolveLocale`, `i18nextLanguage`; grouping rule |
| `packages/i18n/src/format.test.ts` | Cases for every new locale |
| `packages/i18n/src/languageNames.ts` (new) | `LANGUAGE_NAMES` autonyms |
| `packages/i18n/src/plurals.ts` (new) + test | `withManyPlurals` |
| `packages/i18n/src/locales/{fr,de,sv,es,pt}.ts` (new) | Catalogs typed `Messages` |
| `packages/i18n/src/index.ts` | Register catalogs in `resources` |
| `packages/i18n/src/locales.test.ts` | Parity of every catalog against `it`: keys and `{{variables}}` |
| `packages/core/src/entities.ts` (+ test) | `LANGUAGE_PREFERENCES`, wider `language` enum |
| `apps/mobile/src/db/schema.ts`, `src/db/seed.ts` | `Settings['language']` |
| `apps/mobile/src/i18n/index.ts`, `useAppLocale.ts`, `i18n.test.ts` | `i18nextLanguage`, `matchLocale` |
| `apps/mobile/app/(onboarding)/{period,cycle-day}.tsx` | `useAppLocale()` instead of `=== 'it'` |
| `apps/mobile/src/components/AmountInput.tsx` | `parts.decimalSeparator` instead of `=== 'it'` |
| `apps/mobile/app/profile/language.tsx`, `app/profile.tsx` | 8 rows, autonyms |
| `apps/mobile/locales/{fr,de,sv,es,pt}.json`, `app.config.ts` | iOS permission prompts |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | §1.7, §4 settings, §12 |
| `TODO.md` | Remove the item |

---

### Task 1: Formatting tables for the new locales (TDD)

**Files:** Modify `packages/i18n/src/format.ts`, `packages/i18n/src/format.test.ts`

- [x] **Step 1: Write the failing tests.** Append to `format.test.ts` (and change the `fr-FR` expectation of the
  existing `resolveLocale` test, which becomes `fr`):

```ts
describe('resolveLocale / matchLocale', () => {
  it('maps a regional tag to its base language', () => {
    expect(resolveLocale('system', ['pt-BR'])).toBe('pt');
    expect(resolveLocale('system', ['pt-PT'])).toBe('pt');
    expect(resolveLocale('system', ['es-MX'])).toBe('es');
    expect(resolveLocale('system', ['de-AT'])).toBe('de');
    expect(resolveLocale('system', ['fr-CA'])).toBe('fr');
    expect(resolveLocale('system', ['sv-FI'])).toBe('sv');
    expect(resolveLocale('system', ['zh-Hans-CN'])).toBe('en');
  });

  it('takes the first device language it supports', () => {
    expect(resolveLocale('system', ['nl-NL', 'de-DE'])).toBe('de');
    expect(resolveLocale('system', ['en-GB', 'it-IT'])).toBe('en');
    expect(resolveLocale('sv', ['de-DE'])).toBe('sv');
  });

  it('reads underscores and case as Android and iOS report them', () => {
    expect(matchLocale('pt_BR')).toBe('pt');
    expect(matchLocale('DE')).toBe('de');
    expect(matchLocale('nb-NO')).toBeUndefined();
  });

  it('hands i18next the Portuguese of Portugal, for its plural rules', () => {
    expect(i18nextLanguage('pt')).toBe('pt-PT');
    expect(i18nextLanguage('de')).toBe('de');
  });
});

describe('formatMoney in the new locales', () => {
  const NNBSP = ' ';
  const NBSP = ' ';

  it('separates thousands the way each locale does', () => {
    expect(formatMoney(184260, 'EUR', 'fr')).toBe(`1${NNBSP}842,60 €`);
    expect(formatMoney(184260, 'EUR', 'de')).toBe('1.842,60 €');
    expect(formatMoney(184260, 'EUR', 'sv')).toBe(`1${NBSP}842,60 €`);
    expect(formatMoney(-1234567, 'SEK', 'sv')).toBe(`−12${NBSP}345,67 kr`);
  });

  it('leaves four digits ungrouped in Spanish and Portuguese', () => {
    expect(formatMoney(184260, 'EUR', 'es')).toBe('1842,60 €');
    expect(formatMoney(1234560, 'EUR', 'es')).toBe('12.345,60 €');
    expect(formatMoney(184260, 'EUR', 'pt')).toBe('1842,60 €');
    expect(formatMoney(1234560, 'EUR', 'pt')).toBe(`12${NBSP}345,60 €`);
    expect(formatMajor(184260, 'EUR', 'es')).toBe('+1843');
    expect(formatMajor(1234560, 'EUR', 'es')).toBe('+12.346');
  });

  it('puts the symbol after the amount', () => {
    expect(formatMoneyParts(500, 'USD', 'de').symbolPosition).toBe('suffix');
    expect(formatMoney(500, 'USD', 'fr', 'always')).toBe('+5,00 $');
  });
});

describe('dates in the new locales', () => {
  it('formats day and month', () => {
    expect(formatDayMonth('2026-04-18', 'fr')).toBe('18 avr.');
    expect(formatDayMonth('2026-04-18', 'de')).toBe('18. Apr.');
    expect(formatDayMonth('2026-04-18', 'sv')).toBe('18 apr.');
    expect(formatDayMonth('2026-04-18', 'es')).toBe('18 abr');
    expect(formatDayMonth('2026-04-18', 'pt')).toBe('18 abr.');
  });

  it('formats long dates', () => {
    expect(formatLongDate('2026-04-18', 'fr')).toBe('18 avril 2026');
    expect(formatLongDate('2026-04-18', 'de')).toBe('18. April 2026');
    expect(formatLongDate('2026-04-18', 'sv')).toBe('18 april 2026');
    expect(formatLongDate('2026-04-18', 'es')).toBe('18 de abril de 2026');
    expect(formatLongDate('2026-04-18', 'pt')).toBe('18 de abril de 2026');
  });

  it('writes day and long month, and the month over the grid', () => {
    expect(formatDayMonthLong('2026-09-18', 'de')).toBe('18. September');
    expect(formatDayMonthLong('2026-09-18', 'es')).toBe('18 de septiembre');
    expect(formatMonthYear({ year: 2026, month: 4 }, 'pt')).toBe('abril de 2026');
    expect(formatMonthYear({ year: 2026, month: 4 }, 'fr')).toBe('avril 2026');
  });

  it('names the year in a range the same way', () => {
    const range = { start: '2025-12-27', end: '2026-01-26' };
    expect(formatCycleRange(range, 'de', '2026-09-11')).toBe('27. Dez. 2025 – 26. Jan.');
    expect(formatCycleRange(range, 'fr', '2026-09-11')).toBe('27 déc. 2025 – 26 janv.');
  });

  it('ticks German months with the stand-alone forms', () => {
    expect(formatPeriodTick('2026-03-01', 'month', 'de')).toBe('Mär');
    expect(formatDayMonth('2026-03-18', 'de')).toBe('18. März');
    expect(formatPeriodTick('2026-09-01', 'month', 'fr')).toBe('sept.');
  });

  it('names weekdays', () => {
    expect(formatWeekday('2026-09-18', 'fr')).toBe('vendredi');
    expect(formatWeekday('2026-09-18', 'de')).toBe('Freitag');
    expect(formatWeekday('2026-09-18', 'sv')).toBe('fredag');
    expect(formatWeekday('2026-09-18', 'es')).toBe('viernes');
    expect(formatWeekday('2026-09-18', 'pt')).toBe('sexta-feira');
  });

  it('starts the grid where each locale does', () => {
    expect(firstWeekdayFor('fr')).toBe('monday');
    expect(firstWeekdayFor('de')).toBe('monday');
    expect(firstWeekdayFor('sv')).toBe('monday');
    expect(firstWeekdayFor('es')).toBe('monday');
    expect(firstWeekdayFor('pt')).toBe('sunday');
    expect(weekdayLabels('es', 'monday')).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(weekdayLabels('sv', 'monday')).toEqual(['M', 'T', 'O', 'T', 'F', 'L', 'S']);
    expect(weekdayLabels('pt', 'sunday')).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
  });
});
```

- [x] **Step 2: Run, expect failures** — `rtk proxy pnpm --filter @saldo/i18n test` → type errors / FAIL on the new
  locales.
- [x] **Step 3: Implement.** Replace the per-table records and every `locale === 'it'` in `format.ts` with:

```ts
export const SUPPORTED_LOCALES = ['it', 'en', 'fr', 'de', 'sv', 'es', 'pt'] as const;

interface Conventions {
  group: string;
  decimal: string;
  /** CLDR `minimumGroupingDigits`: at 2, a four-digit integer stays ungrouped (es `1234`, `12.345`). */
  minimumGroupingDigits: 1 | 2;
  symbolPosition: 'prefix' | 'suffix';
  firstWeekday: FirstWeekday;
  /** Format-context abbreviations, the ones that follow a day number. */
  monthsShort: readonly string[];
  /** Stand-alone abbreviations for a month shown alone, where CLDR's differ (de `Mär`, not `März`). */
  monthsTick?: readonly string[];
  monthsLong: readonly string[];
  /** Monday-first, as `weekdayOf` counts. */
  weekdaysShort: readonly string[];
  weekdaysLong: readonly string[];
  dayMonth: (day: number, month: string) => string;
  dayMonthYear: (dayMonth: string, year: number) => string;
  dayMonthLong: (day: number, month: string) => string;
  longDate: (day: number, month: string, year: number) => string;
  monthYear: (month: string, year: number) => string;
}
```

  with one `CONVENTIONS: Record<AppLocale, Conventions>` entry per locale holding the table values of **Decisions**
  (names copied from CLDR as printed by Node's `Intl`), plus:

```ts
export function matchLocale(tag: string): AppLocale | undefined {
  const base = tag.toLowerCase().split(/[-_]/)[0] ?? '';
  return SUPPORTED_LOCALES.find((locale) => locale === base);
}

export function resolveLocale(preference: LanguagePreference, deviceLanguages: readonly string[]): AppLocale {
  if (preference !== 'system') return preference;
  for (const tag of deviceLanguages) {
    const locale = matchLocale(tag);
    if (locale !== undefined) return locale;
  }
  return 'en';
}

export function i18nextLanguage(locale: AppLocale): string {
  return locale === 'pt' ? 'pt-PT' : locale;
}

function groupThousands(digits: string, conventions: Conventions): string {
  if (digits.length < 3 + conventions.minimumGroupingDigits) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, conventions.group);
}
```

- [x] **Step 4: Run** `rtk proxy pnpm --filter @saldo/i18n test` → all green, old and new cases.
- [x] **Step 5: Commit** `feat(i18n): formatting tables for fr, de, sv, es, pt`.

### Task 2: Language setting and autonyms

**Files:** `packages/core/src/entities.ts` (+ `entities.test.ts`), `packages/i18n/src/languageNames.ts`,
`packages/i18n/src/format.test.ts`, `packages/i18n/src/index.ts`, `apps/mobile/src/db/schema.ts`,
`apps/mobile/src/db/seed.ts`

- [x] **Step 1: Failing tests.** In `entities.test.ts`:

```ts
it('accepts every language the app speaks', () => {
  for (const language of ['system', 'it', 'en', 'fr', 'de', 'sv', 'es', 'pt']) {
    expect(settingsSchema.safeParse({ ...settings, language }).success).toBe(true);
  }
  expect(settingsSchema.safeParse({ ...settings, language: 'nl' }).success).toBe(false);
});
```

  In `packages/i18n/src/languageNames.test.ts`:

```ts
import { LANGUAGE_PREFERENCES } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from './format';
import { LANGUAGE_NAMES } from './languageNames';

describe('languages', () => {
  it('keeps the setting and the supported locales in step', () => {
    expect(LANGUAGE_PREFERENCES).toEqual(['system', ...SUPPORTED_LOCALES]);
  });

  it('names every language in its own tongue', () => {
    expect(LANGUAGE_NAMES).toEqual({
      it: 'Italiano', en: 'English', fr: 'Français', de: 'Deutsch',
      sv: 'Svenska', es: 'Español', pt: 'Português',
    });
  });
});
```

- [x] **Step 2: Run, expect failures.**
- [x] **Step 3: Implement.** `entities.ts`:
  `export const LANGUAGE_PREFERENCES = ['system', 'it', 'en', 'fr', 'de', 'sv', 'es', 'pt'] as const;` and
  `language: z.enum(LANGUAGE_PREFERENCES)`. `languageNames.ts` exports `LANGUAGE_NAMES: Record<AppLocale, string>`,
  re-exported from `index.ts`. `schema.ts` → `text('language').$type<Settings['language']>()`; `seed.ts` →
  `language: Settings['language']`.
- [x] **Step 4: Run** core + i18n tests, `rtk proxy pnpm typecheck`.
- [x] **Step 5: Commit** `feat(core): widen the language setting to seven languages`.

### Task 3: Parity test for every catalog, `_many` plurals

**Files:** `packages/i18n/src/locales.test.ts`, `packages/i18n/src/plurals.ts`, `packages/i18n/src/plurals.test.ts`,
`packages/i18n/src/index.ts`

- [ ] **Step 1: Failing tests.** `locales.test.ts` iterates `SUPPORTED_LOCALES` over `resources`' source catalogs
  (`catalogs: Record<AppLocale, Messages>` exported from `index.ts`) and, for each non-`it` one, compares `keyPaths`
  and the `{{variables}}` of each leaf *by key path* (not by position). `plurals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withManyPlurals } from './plurals';

describe('withManyPlurals', () => {
  it('gives every _other a _many sibling and leaves the rest alone', () => {
    const source = { a: { n_one: 'one', n_other: 'other', plain: 'x' } };
    expect(withManyPlurals(source)).toEqual({
      a: { n_one: 'one', n_other: 'other', n_many: 'other', plain: 'x' },
    });
    expect(source.a).not.toHaveProperty('n_many');
  });
});
```

- [ ] **Step 2: Run, expect failures** (catalogs missing).
- [ ] **Step 3: Implement** `withManyPlurals` (recursive copy) and `resources = { it: { translation:
  withManyPlurals(it) }, … }`.
- [ ] **Step 4–5:** run, commit `test(i18n): check every catalog against it`.

### Task 4: The five catalogs

**Files:** create `packages/i18n/src/locales/{fr,de,sv,es,pt}.ts`, each `export const xx: Messages = { … }`.

Rules for every catalog (the content is the step; `Messages` makes `tsc` reject a missing or extra key):

- Translate from `it.ts`, cross-checking `en.ts`; keep every `{{variable}}` and every `_one`/`_other` pair.
- Match the Italian register: informal second person (fr *tu*, de *du*, sv *du*, es *tú*, pt *tu*), plain verbs,
  no exclamation marks. Labels on buttons, chips, tabs and tiles stay as short as Italian or shorter.
- Quotes per **Decisions**. `seed.*` names are the ones a speaker would type for their own categories.
- Keep brand/tech words: Saldo, Spendee, CSV, JSON, ZIP, PDF, passkey (fr/es/pt/sv/de each use the platform term:
  fr `clé d’accès`, de `Passkey`, sv `nyckel`, es `llave de acceso`, pt `chave de acesso`).

- [ ] **Step 1:** write `fr.ts`, `de.ts`, `sv.ts`, `es.ts`, `pt.ts`; register them in `index.ts`.
- [ ] **Step 2:** `rtk proxy pnpm --filter @saldo/i18n test` and `typecheck` → green.
- [ ] **Step 3:** commit one `feat(i18n): … catalog` per language.

### Task 5: Mobile wiring

**Files:** `apps/mobile/src/i18n/index.ts`, `useAppLocale.ts`, `i18n.test.ts`, `app/(onboarding)/period.tsx`,
`app/(onboarding)/cycle-day.tsx`, `src/components/AmountInput.tsx`, `app/profile/language.tsx`, `app/profile.tsx`

- [ ] **Step 1: Failing tests** in `apps/mobile/src/i18n/i18n.test.ts`:

```ts
it('follows a regional device language to its base catalog', async () => {
  const i18n = await createI18n('system', ['de-AT']);
  expect(i18n.t('tabs.accounts')).toBe('Konten');
});

it('pluralises Portuguese the way Portugal does', async () => {
  const i18n = await createI18n('pt', []);
  expect(i18n.t('home.upcomingCount', { count: 0 })).toBe('0 movimentos');
  expect(i18n.t('home.upcomingCount', { count: 1 })).toBe('1 movimento');
});

it('never falls back to English for a round million', async () => {
  const i18n = await createI18n('fr', []);
  expect(i18n.t('home.upcomingCount', { count: 1_000_000 })).toBe('1000000 opérations');
});
```

- [ ] **Step 2: Implement.** `createI18n` passes `lng: i18nextLanguage(language)`; `useAppLocale` returns
  `matchLocale(i18n.language) ?? 'en'`; the two onboarding screens call `useAppLocale()`; `AmountInput` uses
  `parts.decimalSeparator`; the Language screen maps
  `['system', 'it', 'en', 'de', 'es', 'fr', 'pt', 'sv']` to `t('profile.system')` or `LANGUAGE_NAMES[value]`, and the
  Profile row does the same. Delete `profile.italian` / `profile.english` from every catalog.
- [ ] **Step 3:** `rtk proxy pnpm --filter @saldo/mobile test` → green (the keys test proves nothing asks for the
  deleted keys).
- [ ] **Step 4:** commit `feat(mobile): offer the five new languages`.

### Task 6: iOS permission prompts, spec, TODO

- [ ] Add `apps/mobile/locales/{fr,de,sv,es,pt}.json` (same three keys) and list them in `app.config.ts` `locales`.
- [ ] Spec: §1 item 7, §4 `language` row, §12 (catalogs, plurals, `resolveLocale`, formatter examples).
- [ ] Remove the TODO item. Commit `docs: five more languages in the spec`.

### Task 7: Gates

- [ ] `rtk proxy pnpm lint` — no `lint/…` lines, no `× Some errors were emitted`.
- [ ] `rtk proxy pnpm typecheck`, `rtk proxy pnpm test` — read the output.

---

## Before release (not part of this branch)

- [ ] Native read of `fr.ts` (+ `locales/fr.json`)
- [ ] Native read of `de.ts` (+ `locales/de.json`)
- [ ] Native read of `sv.ts` (+ `locales/sv.json`)
- [ ] Native read of `es.ts` (+ `locales/es.json`)
- [ ] Native read of `pt.ts` (+ `locales/pt.json`), by a European Portuguese speaker
- [ ] On device, in German: check the strings most likely to overflow (listed in the branch report and below).
- [ ] Changelog line for the widened `language` enum once Saldo is public.

**German strings to eyeball** (the longest against their slot): tab `Transaktionen` / `Statistiken`;
`stats.discretionaryBar` `Frei verfügbar`; `accounts.spendable` `Verfügbar gesamt`; `onboarding.startImport`
`Export importieren`; the account-type tiles `Kreditkarte` / `Debitkarte` / `Investitionen` (three-column grid);
`permissions.activate` / `later` buttons; `recurrenceScope.thisAndFollowing`; `budgets.rollover`; the confirm word
`LÖSCHEN`; the period chips `Kalendermonat` / `Gehaltszyklus`; `txForm.exclude` `Aus Summen ausnehmen`.
