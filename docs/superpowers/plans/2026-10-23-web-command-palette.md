# Web command palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the quick search of the web app: a command palette that `⌘K` / `Ctrl K` opens on every page, and the “Search ⌘K” button of the top bar.

**Architecture:** The ranking rule is a pure function in `@saldo/core` (`rankSearch`). The browser ranks the commands (pages and actions) that the `(app)` layout translates. A Server Action (`searchAction`) reads the session, loads the data of the signed-in user, and ranks accounts, goals, budgets, categories, tags and transactions with the same function. The palette is Base UI `Dialog` + `Autocomplete` (inline), which the app already has.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19, Base UI 1.8 (`Dialog`, `Autocomplete`), Vitest, PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-web-command-palette.html`.

**Branch:** `redesign/web` (shared checkout; no new branch). Stage files by explicit path only.

---

## Decisions this plan takes

- The open questions of the spec (§09) take their defaults: no touch entry below 1000px, no archived items, no admin pages, no recent items, the title and the amount only, `⌘K` and `Ctrl K` on every system.
- The layout passes the Server Action to the palette as a prop (`search={searchAction}`). Thus `src/ui` does not import from `app/`.
- The server sends the two sentences that contain the query (“See all for …”, “Nothing matches …”). The browser has no translator.
- `SEARCH_GROUP_LIMIT` (5) lives in `@saldo/core`, so the client component does not import the server view.
- Two new layout tokens: `paletteWidth` (640) and `searchBreakpoint` (1000).

## File structure

| File | Responsibility |
|---|---|
| `packages/core/src/search.ts` (new) | `textScore`, `amountQuery`, `rankSearch`, `SEARCH_GROUP_LIMIT`. Pure. |
| `packages/core/src/search.test.ts` (new) | Unit tests of the ranking rules (complex logic). |
| `packages/core/src/index.ts` | Export `./search`. |
| `packages/ui/src/tokens.ts` | `layout.paletteWidth`, `layout.searchBreakpoint`. |
| `packages/i18n/src/locales/*.ts` (7) | `web.search.*` (12 keys). |
| `apps/web/src/features/search/commands.ts` (new) | `paletteCommands(t)`: the actions and the pages. |
| `apps/web/src/features/search/searchView.ts` (new) | `searchView(...)`: `UserData` + query → `SearchResult`. |
| `apps/web/src/server/search/search.ts` (new) | `searchFor(userId, query, now, zone)`: loads the user's data and calls `searchView`. |
| `apps/web/src/server/search/search.test.ts` (new) | Integration test on PGlite: two users, scoping, hrefs, archived items. |
| `apps/web/app/(app)/actions.ts` (new) | `searchAction(query)`: session, then `searchFor`. |
| `apps/web/src/ui/CommandPalette.tsx` + `.module.css` (new) | Trigger, `⌘K` listener, dialog, list. |
| `apps/web/src/ui/TopBar.tsx` + `.module.css` | A `search` slot before “New transaction”. |
| `apps/web/app/(app)/layout.tsx` | Builds the commands and the strings, reads the platform, mounts the palette. |
| `apps/web/e2e/command-palette.spec.ts` (new) | Keyboard flow, account and transaction, narrow screens. |
| Docs | Redesign spec open item 5, R1 plan note, `plans/README.md`. |

---

### Task 1: The ranking rule in `@saldo/core`

**Files:**
- Create: `packages/core/src/search.ts`
- Create: `packages/core/src/search.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/search.test.ts
import { describe, expect, it } from 'vitest';
import { amountQuery, rankSearch, SEARCH_SCORE, textScore } from './search';

describe('textScore', () => {
  it('ranks the five text rules from the whole title down to scattered words', () => {
    expect(textScore('Grocery run', 'Grocery run')).toBe(SEARCH_SCORE.exact);
    expect(textScore('groc', 'Grocery run')).toBe(SEARCH_SCORE.prefix);
    expect(textScore('run gro', 'Grocery run')).toBe(SEARCH_SCORE.wordPrefix);
    expect(textScore('cery r', 'Grocery run')).toBe(SEARCH_SCORE.contains);
    expect(textScore('run ocer', 'Grocery run')).toBe(SEARCH_SCORE.allWords);
    expect(textScore('bakery', 'Grocery run')).toBeNull();
  });

  it('ignores case, accents and extra spaces', () => {
    expect(textScore('  CAFFE  ', 'Caffè')).toBe(SEARCH_SCORE.exact);
    expect(textScore('cafe', 'Café de Flore')).toBe(SEARCH_SCORE.prefix);
  });

  it('matches nothing with an empty query', () => {
    expect(textScore('   ', 'Anything')).toBeNull();
  });
});

describe('amountQuery', () => {
  it('reads a whole number as every amount with that whole part', () => {
    expect(amountQuery('12', 2)).toEqual({ min: 1200, max: 1299, exact: 1200 });
  });

  it('reads one or two digits after a separator as decimals, either separator', () => {
    expect(amountQuery('12,50', 2)).toEqual({ min: 1250, max: 1250, exact: 1250 });
    expect(amountQuery('12.5', 2)).toEqual({ min: 1250, max: 1250, exact: 1250 });
    expect(amountQuery('€ 12,50', 2)).toEqual({ min: 1250, max: 1250, exact: 1250 });
  });

  it('reads three digits after a separator as thousands in a two-decimal currency', () => {
    expect(amountQuery('1.234', 2)).toEqual({ min: 123400, max: 123499, exact: 123400 });
    expect(amountQuery('1.234,56', 2)).toEqual({ min: 123456, max: 123456, exact: 123456 });
  });

  it('follows the decimals of the currency', () => {
    expect(amountQuery('1.234', 3)).toEqual({ min: 1234, max: 1234, exact: 1234 });
    expect(amountQuery('1.5', 0)).toEqual({ min: 15, max: 15, exact: 15 });
  });

  it('is not an amount with letters, other symbols, or no digit', () => {
    expect(amountQuery('coop 12', 2)).toBeNull();
    expect(amountQuery('12/10', 2)).toBeNull();
    expect(amountQuery('€', 2)).toBeNull();
  });
});

describe('rankSearch', () => {
  const entries = [
    { value: 'a', text: 'Coop supermarket', amount: 4210, date: '2026-10-01' },
    { value: 'b', text: 'Coop', amount: 1200, date: '2026-09-01' },
    { value: 'c', text: 'Bakery', amount: 1250, date: '2026-10-20' },
    { value: 'd', text: 'Coop', amount: 900, date: '2026-10-15' },
  ];

  it('puts the higher score first, then the newer date', () => {
    expect(rankSearch('coop', entries)).toEqual(['d', 'b', 'a']);
  });

  it('matches an amount on transactions, the exact amount before the whole-number range', () => {
    expect(rankSearch('12', entries, { minorDigits: 2 })).toEqual(['b', 'c']);
    expect(rankSearch('12,5', entries, { minorDigits: 2 })).toEqual(['c']);
  });

  it('keeps the input order for entries with no date', () => {
    const named = [
      { value: 'x', text: 'Savings' },
      { value: 'y', text: 'Savings' },
    ];
    expect(rankSearch('sav', named)).toEqual(['x', 'y']);
  });

  it('stops at the limit and returns nothing for an empty query', () => {
    expect(rankSearch('coop', entries, { limit: 2 })).toEqual(['d', 'b']);
    expect(rankSearch('  ', entries)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to make sure they fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- search`
Expected: FAIL, `Cannot find module './search'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/core/src/search.ts
import type { LocalDate } from './dates';
import { normalizeText } from './filters';
import type { MinorDigits, MinorUnits } from './money';

/**
 * The command palette (spec 2026-10-23, §04): what one row can be found by. A transaction also
 * carries its amount, which a query of digits matches, and its date, which breaks a tie.
 */
export interface SearchEntry<T> {
  value: T;
  text: string;
  amount?: MinorUnits;
  date?: LocalDate;
}

/** The scores of the rules, best first. A higher score comes first in its group. */
export const SEARCH_SCORE = {
  exact: 400,
  prefix: 300,
  wordPrefix: 200,
  contains: 100,
  allWords: 50,
  amountExact: 300,
  amountWhole: 200,
} as const;

/** The palette shows at most this many rows in one group. */
export const SEARCH_GROUP_LIMIT = 5;

/** Both sides already through `normalizeText`. The first rule that applies wins. */
function scoreNormalized(query: string, text: string): number | null {
  if (query === '') return null;
  if (text === query) return SEARCH_SCORE.exact;
  if (text.startsWith(query)) return SEARCH_SCORE.prefix;
  const words = query.split(' ');
  const textWords = text.split(' ');
  if (words.every((word) => textWords.some((textWord) => textWord.startsWith(word)))) {
    return SEARCH_SCORE.wordPrefix;
  }
  if (text.includes(query)) return SEARCH_SCORE.contains;
  if (words.every((word) => text.includes(word))) return SEARCH_SCORE.allWords;
  return null;
}

/** How well `text` matches `query` (case, accents and spaces ignored), or null for no match. */
export function textScore(query: string, text: string): number | null {
  return scoreNormalized(normalizeText(query), normalizeText(text));
}

/** The amounts a query of digits stands for, in minor units: a whole number is a range. */
export interface AmountQuery {
  min: MinorUnits;
  max: MinorUnits;
  exact: MinorUnits;
}

/**
 * A query of digits read as an amount of a currency with `minorDigits` decimals. Spaces, signs and
 * currency symbols are dropped; anything else (a letter, a `/`) means it is not an amount. The last
 * separator is the decimal one when 1 to `minorDigits` digits follow it, whichever character it is:
 * `12,50` and `12.50` are the same, and `1.234` groups thousands in a two-decimal currency.
 */
export function amountQuery(query: string, minorDigits: MinorDigits): AmountQuery | null {
  if (!/\d/.test(query) || !/^[\s\d.,+\-−\p{Sc}]+$/u.test(query)) return null;
  const compact = query.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  const last = Math.max(compact.lastIndexOf('.'), compact.lastIndexOf(','));
  const decimals = last === -1 ? '' : compact.slice(last + 1);
  const isDecimal = minorDigits > 0 && last !== -1 && decimals.length <= minorDigits;
  const whole = (isDecimal ? compact.slice(0, last) : compact).replace(/[.,]/g, '');
  const scale = 10 ** minorDigits;
  const exact = Number(whole || '0') * scale;
  if (!Number.isSafeInteger(exact)) return null;
  if (isDecimal) {
    const minor = exact + Number(decimals.padEnd(minorDigits, '0'));
    return { min: minor, max: minor, exact: minor };
  }
  return { min: exact, max: exact + scale - 1, exact };
}

function amountScore(query: AmountQuery | null, amount: MinorUnits | undefined): number | null {
  if (query === null || amount === undefined) return null;
  if (amount === query.exact) return SEARCH_SCORE.amountExact;
  if (amount >= query.min && amount <= query.max) return SEARCH_SCORE.amountWhole;
  return null;
}

/**
 * The values of `entries` that match `query`, best first: the higher score, then the newer date,
 * then the order of `entries` (the order a page shows them in). Nothing for an empty query.
 */
export function rankSearch<T>(
  query: string,
  entries: readonly SearchEntry<T>[],
  options: { minorDigits?: MinorDigits; limit?: number } = {},
): T[] {
  const text = normalizeText(query);
  if (text === '') return [];
  const amount = amountQuery(query, options.minorDigits ?? 2);
  const scored: { entry: SearchEntry<T>; index: number; score: number }[] = [];
  entries.forEach((entry, index) => {
    const score = Math.max(
      scoreNormalized(text, normalizeText(entry.text)) ?? -1,
      amountScore(amount, entry.amount) ?? -1,
    );
    if (score >= 0) scored.push({ entry, index, score });
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.entry.date !== undefined && b.entry.date !== undefined
        ? b.entry.date.localeCompare(a.entry.date)
        : 0) ||
      a.index - b.index,
  );
  return scored.slice(0, options.limit ?? scored.length).map((item) => item.entry.value);
}
```

Add to `packages/core/src/index.ts`, after `export * from './rollover';`:

```ts
export * from './search';
```

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `rtk proxy pnpm --filter @saldo/core test -- search`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/search.ts packages/core/src/search.test.ts packages/core/src/index.ts
git commit -m "feat(core): the ranking rule of the command palette"
```

---

### Task 2: Tokens and strings

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `layout` object)
- Modify: `packages/i18n/src/locales/{it,en,de,es,fr,pt,sv}.ts` (the `web` object, after `shell`)

- [ ] **Step 1: Add the tokens** after `searchWidth: 320,` in `layout`:

```ts
  /** Web (palette spec 2026-10-23, §07): the width of the command palette. */
  paletteWidth: 640,
  /**
   * Web (redesign H1): the top bar shows «Search» at and above this width. A media query cannot read
   * a custom property, so the web writes 1000 in its `@media` rule with a comment naming this token.
   */
  searchBreakpoint: 1000,
```

- [ ] **Step 2: Add `web.search`** after the `shell: { … },` block of each catalog. `it`:

```ts
    search: {
      title: 'Cerca in Saldo',
      placeholder: 'Cerca pagine, conti, transazioni…',
      actions: 'Azioni',
      goTo: 'Vai a',
      seeAll: 'Vedi tutto per «{{query}}» in Transazioni',
      noResults: 'Nessun risultato per «{{query}}».',
      noResultsHint: 'La ricerca guarda nomi, descrizioni e importi.',
      searching: 'Ricerca in corso…',
      error: 'La ricerca non è riuscita. Riprova.',
      keysMove: 'Sposta',
      keysOpen: 'Apri',
      keysClose: 'Chiudi',
    },
```

`en`:

```ts
    search: {
      title: 'Search Saldo',
      placeholder: 'Search pages, accounts, transactions…',
      actions: 'Actions',
      goTo: 'Go to',
      seeAll: 'See all for “{{query}}” in Transactions',
      noResults: 'Nothing matches “{{query}}”.',
      noResultsHint: 'Search looks at names, descriptions and amounts.',
      searching: 'Searching…',
      error: 'The search did not work. Try again.',
      keysMove: 'Move',
      keysOpen: 'Open',
      keysClose: 'Close',
    },
```

`de`:

```ts
    search: {
      title: 'In Saldo suchen',
      placeholder: 'Seiten, Konten, Buchungen suchen…',
      actions: 'Aktionen',
      goTo: 'Gehe zu',
      seeAll: 'Alle für „{{query}}“ in Buchungen',
      noResults: 'Nichts passt zu „{{query}}“.',
      noResultsHint: 'Die Suche prüft Namen, Beschreibungen und Beträge.',
      searching: 'Suche läuft…',
      error: 'Die Suche hat nicht geklappt. Versuch es noch mal.',
      keysMove: 'Bewegen',
      keysOpen: 'Öffnen',
      keysClose: 'Schließen',
    },
```

`es`:

```ts
    search: {
      title: 'Buscar en Saldo',
      placeholder: 'Busca páginas, cuentas, movimientos…',
      actions: 'Acciones',
      goTo: 'Ir a',
      seeAll: 'Ver todo para «{{query}}» en Movimientos',
      noResults: 'Nada coincide con «{{query}}».',
      noResultsHint: 'La búsqueda mira nombres, descripciones e importes.',
      searching: 'Buscando…',
      error: 'La búsqueda no ha funcionado. Inténtalo de nuevo.',
      keysMove: 'Mover',
      keysOpen: 'Abrir',
      keysClose: 'Cerrar',
    },
```

`fr`:

```ts
    search: {
      title: 'Rechercher dans Saldo',
      placeholder: 'Pages, comptes, opérations…',
      actions: 'Actions',
      goTo: 'Aller à',
      seeAll: 'Tout voir pour « {{query}} » dans Opérations',
      noResults: 'Rien ne correspond à « {{query}} ».',
      noResultsHint: 'La recherche porte sur les noms, les descriptions et les montants.',
      searching: 'Recherche…',
      error: 'La recherche n’a pas marché. Réessaie.',
      keysMove: 'Déplacer',
      keysOpen: 'Ouvrir',
      keysClose: 'Fermer',
    },
```

`pt`:

```ts
    search: {
      title: 'Pesquisar no Saldo',
      placeholder: 'Pesquisa páginas, contas, movimentos…',
      actions: 'Ações',
      goTo: 'Ir para',
      seeAll: 'Ver tudo para «{{query}}» em Movimentos',
      noResults: 'Nada corresponde a «{{query}}».',
      noResultsHint: 'A pesquisa procura em nomes, descrições e valores.',
      searching: 'A pesquisar…',
      error: 'A pesquisa falhou. Tenta outra vez.',
      keysMove: 'Mover',
      keysOpen: 'Abrir',
      keysClose: 'Fechar',
    },
```

`sv`:

```ts
    search: {
      title: 'Sök i Saldo',
      placeholder: 'Sök sidor, konton, transaktioner…',
      actions: 'Åtgärder',
      goTo: 'Gå till',
      seeAll: 'Visa alla för ”{{query}}” i Transaktioner',
      noResults: 'Inget matchar ”{{query}}”.',
      noResultsHint: 'Sökningen tittar på namn, beskrivningar och belopp.',
      searching: 'Söker…',
      error: 'Sökningen fungerade inte. Försök igen.',
      keysMove: 'Flytta',
      keysOpen: 'Öppna',
      keysClose: 'Stäng',
    },
```

Check the formality of each catalog against its `shell` block (`du`/`tu`) before you commit.

- [ ] **Step 3: Run the catalog tests**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS (key structure and variables match `it`).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/tokens.ts packages/i18n/src/locales/it.ts packages/i18n/src/locales/en.ts packages/i18n/src/locales/de.ts packages/i18n/src/locales/es.ts packages/i18n/src/locales/fr.ts packages/i18n/src/locales/pt.ts packages/i18n/src/locales/sv.ts
git commit -m "feat(i18n): the strings and tokens of the command palette"
```

If another agent changed a catalog at the same time, stage only your hunks: `git diff <file> > /tmp/p.diff`, edit the patch, `git apply --cached /tmp/p.diff`.

---

### Task 3: The data search on the server

**Files:**
- Create: `apps/web/src/features/search/searchView.ts`
- Create: `apps/web/src/server/search/search.ts`
- Create: `apps/web/src/server/search/search.test.ts`
- Create: `apps/web/app/(app)/actions.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
// apps/web/src/server/search/search.test.ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { searchFor } from './search';

let harness: TestDatabase;
let seq = 0;

const HLC = '000000000000001-0000-dev';
const CREATED = '2026-09-10T09:00:00.000Z';
const NOW = new Date('2026-10-23T10:00:00.000Z');
const meta = { createdAt: CREATED, updatedAt: HLC, deletedAt: null };

const settings = {
  id: 'settings',
  ...meta,
  periodKind: 'month',
  cycleStartDay: 1,
  currency: 'EUR',
  language: 'en',
  theme: 'system',
  onboardingCompletedAt: CREATED,
  timeZone: 'Europe/Rome',
};

function account(id: string, name: string, archivedAt: string | null = null) {
  return {
    id,
    ...meta,
    name,
    type: 'checking',
    institution: null,
    openingBalance: 10000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'wallet',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt,
    sortOrder: 0,
  };
}

const groceries = {
  id: 'cat-groceries',
  ...meta,
  name: 'Groceries',
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 1,
  archivedAt: null,
  sortOrder: 0,
};

function expense(id: string, description: string, amount: number, date: string) {
  return {
    id,
    ...meta,
    kind: 'expense',
    amount,
    date,
    accountId: 'acc-main',
    toAccountId: null,
    categoryId: 'cat-groceries',
    description,
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  };
}

async function seed(userId: string, entity: string, row: { id: string }): Promise<void> {
  seq += 1;
  await harness.db
    .insert(syncRows)
    .values({ userId, entity, id: row.id, updatedAt: HLC, deletedAt: null, data: row, seq });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('searchFor', () => {
  it('finds only the rows of the user it searches for', async () => {
    await seed('user-a', 'settings', settings);
    await seed('user-a', 'account', account('acc-main', 'Coop card'));
    await seed('user-b', 'settings', settings);
    await seed('user-b', 'account', account('acc-other', 'Coop savings'));

    const result = await searchFor('user-a', 'coop', NOW, 'Europe/Rome');

    const ids = result.groups.flatMap((group) => group.hits.map((hit) => hit.href));
    expect(ids).toEqual(['/accounts?a=acc-main']);
  });

  it('leaves archived accounts out and links a transaction to its period', async () => {
    await seed('user-a', 'settings', settings);
    await seed('user-a', 'account', account('acc-main', 'Main account'));
    await seed('user-a', 'account', account('acc-old', 'Main account old', CREATED));
    await seed('user-a', 'category', groceries);
    await seed('user-a', 'transaction', expense('tx-now', 'Grocery run', 4210, '2026-10-21'));
    await seed('user-a', 'transaction', expense('tx-then', 'Grocery run', 1860, '2026-09-14'));

    const accounts = await searchFor('user-a', 'main', NOW, 'Europe/Rome');
    expect(accounts.groups.map((group) => group.key)).toEqual(['account']);
    expect(accounts.groups[0]?.hits.map((hit) => hit.title)).toEqual(['Main account']);

    const groceriesResult = await searchFor('user-a', 'grocery', NOW, 'Europe/Rome');
    const txs = groceriesResult.groups.find((group) => group.key === 'transaction');
    expect(txs?.hits.map((hit) => hit.href)).toEqual([
      '/transactions?t=tx-now',
      '/transactions?t=tx-then&p=2026-09-01',
    ]);
    expect(groceriesResult.seeAll.href).toBe('/transactions?q=grocery');
  });

  it('finds a transaction by its amount', async () => {
    await seed('user-a', 'settings', settings);
    await seed('user-a', 'account', account('acc-main', 'Main account'));
    await seed('user-a', 'category', groceries);
    await seed('user-a', 'transaction', expense('tx-now', 'Grocery run', 4210, '2026-10-21'));

    const result = await searchFor('user-a', '42,10', NOW, 'Europe/Rome');
    const txs = result.groups.find((group) => group.key === 'transaction');
    expect(txs?.hits.map((hit) => hit.title)).toEqual(['Grocery run']);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `rtk proxy pnpm --filter web exec vitest run src/server/search`
Expected: FAIL, `Cannot find module './search'`.

- [ ] **Step 3: Write the view**

```ts
// apps/web/src/features/search/searchView.ts
import {
  accountBalances,
  bankBalance,
  type CurrencyCode,
  getCurrency,
  isPocket,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  rankSearch,
  SEARCH_GROUP_LIMIT,
  type SearchEntry,
  transactionRow,
  type UserData,
} from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMoney } from '@saldo/i18n/format';
import type { Translate } from '@saldo/i18n/translate';
import { ICON_NAMES } from '@saldo/ui';
import { periodHref } from '../period/periodParams';

export type SearchKind = 'account' | 'goal' | 'budget' | 'category' | 'tag' | 'transaction';

/** One row of the palette: what it shows, and where it goes. Only what the row draws. */
export interface SearchHit {
  id: string;
  title: string;
  detail: string | null;
  figure: string | null;
  icon: string;
  href: string;
}

export interface SearchGroup {
  key: SearchKind;
  label: string;
  hits: SearchHit[];
}

export interface SearchResult {
  /** The query this answers: the palette drops an answer to a query that is no longer typed. */
  query: string;
  groups: SearchGroup[];
  /** The last row: the Transactions list with the same query, which searches more fields. */
  seeAll: { label: string; href: string };
  /** «Nothing matches …», for the palette to show when no command matches either. */
  noMatch: string;
}

const ICONS: ReadonlySet<string> = new Set(ICON_NAMES);

/** A stored icon name the design set no longer has must not break the row. */
function iconOr(name: string, fallback: string): string {
  return ICONS.has(name) ? name : fallback;
}

/**
 * Palette spec §03: the user's own items and transactions that match `query`, in groups of at most
 * `SEARCH_GROUP_LIMIT` rows, in a fixed order. Archived accounts, goals and categories stay out.
 * A transaction is found by the title its row shows and by its amount.
 */
export function searchView(input: {
  data: UserData;
  query: string;
  today: LocalDate;
  def: PeriodDef;
  currency: CurrencyCode;
  locale: AppLocale;
  t: Translate;
}): SearchResult {
  const { data, today, def, currency, locale, t } = input;
  const query = input.query.trim();
  const seeAll = {
    label: t('web.search.seeAll', { query }),
    href: `/transactions?${new URLSearchParams({ q: query }).toString()}`,
  };
  const noMatch = t('web.search.noResults', { query });
  if (query === '') return { query, groups: [], seeAll, noMatch };

  const minorDigits = getCurrency(currency).minorDigits;
  const rank = <T>(entries: SearchEntry<T>[]): T[] =>
    rankSearch(query, entries, { minorDigits, limit: SEARCH_GROUP_LIMIT });
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const names = new Map(data.accounts.map((account) => [account.id, account.name]));
  const live = data.accounts.filter((account) => account.archivedAt === null);
  const balances = accountBalances(data.accounts, data.transactions, today);

  const accounts = rank(
    live.filter((account) => !isPocket(account)).map((account) => ({ value: account, text: account.name })),
  ).map((account) => ({
    id: account.id,
    title: account.name,
    detail: t(`accountTypes.${account.type}`),
    figure: money(bankBalance(data.accounts, balances, account.id)),
    icon: iconOr(account.icon, 'wallet'),
    href: `/accounts?a=${encodeURIComponent(account.id)}`,
  }));

  const goals = rank(
    live.filter(isPocket).map((goal) => ({ value: goal, text: goal.name })),
  ).map((goal) => ({
    id: goal.id,
    title: goal.name,
    detail: names.get(goal.parentAccountId ?? '') ?? null,
    figure: typeof goal.goalTarget === 'number' ? money(goal.goalTarget) : null,
    icon: iconOr(goal.icon, 'piggy'),
    href: `/accounts?g=${encodeURIComponent(goal.id)}`,
  }));

  const budgets = rank(data.budgets.map((budget) => ({ value: budget, text: budget.name }))).map(
    (budget) => ({
      id: budget.id,
      title: budget.name,
      detail: null,
      figure: money(budget.amount),
      icon: iconOr(budget.icon, 'target'),
      href: `/profile/budgets?b=${encodeURIComponent(budget.id)}`,
    }),
  );

  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const categories = rank(
    data.categories
      .filter((category) => category.archivedAt === null)
      .map((category) => ({ value: category, text: category.name })),
  ).map((category) => ({
    id: category.id,
    title: category.name,
    detail:
      category.parentId === null
        ? t(`kinds.${category.direction}`)
        : (categoryById.get(category.parentId)?.name ?? null),
    figure: null,
    icon: iconOr(category.icon, 'tag'),
    href: `/profile/categories?c=${encodeURIComponent(category.id)}`,
  }));

  const tags = rank(data.tags.map((tag) => ({ value: tag, text: tag.name }))).map((tag) => ({
    id: tag.id,
    title: `#${tag.name}`,
    detail: null,
    figure: null,
    icon: 'tag',
    href: `/profile/tags?tag=${encodeURIComponent(tag.id)}`,
  }));

  const rows = data.transactions.map((tx) => ({
    tx,
    row: transactionRow(tx, {
      category: (id) => categoryById.get(id),
      accountName: (id) => names.get(id) ?? '',
      kindLabel: (kind) => t(`kinds.${kind}`),
      viewpointAccountId: null,
    }),
  }));
  const transactions = rank(
    rows.map((item) => ({ value: item, text: item.row.title, amount: item.tx.amount, date: item.tx.date })),
  ).map(({ tx, row }) => ({
    id: tx.id,
    title: row.title,
    detail: `${formatDayMonth(tx.date, locale)} · ${row.subtitle}`,
    figure: formatMoney(row.amount.minor, currency, locale, row.amount.signDisplay),
    icon: iconOr(row.icon, 'tag'),
    href: periodHref('/transactions', periodContaining(def, tx.date), def, today, { t: tx.id }),
  }));

  const groups: SearchGroup[] = [
    { key: 'account' as const, label: t('accounts.title'), hits: accounts },
    { key: 'goal' as const, label: t('goals.title'), hits: goals },
    { key: 'budget' as const, label: t('budgets.title'), hits: budgets },
    { key: 'category' as const, label: t('categories.title'), hits: categories },
    { key: 'tag' as const, label: t('tags.title'), hits: tags },
    { key: 'transaction' as const, label: t('transactions.title'), hits: transactions },
  ].filter((group) => group.hits.length > 0);
  return { query, groups, seeAll, noMatch };
}
```

- [ ] **Step 4: Write the server function and the action**

```ts
// apps/web/src/server/search/search.ts
import type { SearchResult } from '../../features/search/searchView';
import { searchView } from '../../features/search/searchView';
import { userI18n } from '../../i18n/server';
import { pageState } from '../page/context';
import { loadUserData } from '../userData/load';

/** The longest query the palette sends: longer than any name or description it can match. */
export const MAX_SEARCH_QUERY = 120;

/**
 * Palette spec §05: the data search of one user. `userId` comes from the session, never from the
 * request — the caller (`searchAction`) reads it. `loadUserData` reads that user's rows only.
 */
export async function searchFor(
  userId: string,
  query: string,
  now: Date,
  fallbackTimeZone: string,
): Promise<SearchResult> {
  const [data, i18n] = await Promise.all([loadUserData(userId), userI18n(userId)]);
  const state = pageState({ data, now, fallbackTimeZone, params: {} });
  return searchView({
    data,
    query: query.slice(0, MAX_SEARCH_QUERY),
    today: state.today,
    def: state.def,
    currency: state.currency,
    locale: i18n.locale,
    t: i18n.t,
  });
}
```

```ts
// apps/web/app/(app)/actions.ts
'use server';

import type { SearchResult } from '../../src/features/search/searchView';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { env } from '../../src/server/env';
import { searchFor } from '../../src/server/search/search';

/**
 * The command palette's data search (spec 2026-10-23, §05). A Server Action is a public endpoint,
 * whatever page rendered the palette: it reads the session itself and searches that user only.
 */
export async function searchAction(query: unknown): Promise<SearchResult> {
  const user = await requireWebUser();
  return searchFor(user.id, typeof query === 'string' ? query : '', new Date(), env().defaultTimeZone);
}
```

- [ ] **Step 5: Run the test to make sure it passes**

Run: `rtk proxy pnpm --filter web exec vitest run src/server/search`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/search/searchView.ts apps/web/src/server/search/search.ts apps/web/src/server/search/search.test.ts "apps/web/app/(app)/actions.ts"
git commit -m "feat(web): the data search of the command palette"
```

---

### Task 4: The commands

**Files:**
- Create: `apps/web/src/features/search/commands.ts`

- [ ] **Step 1: Write the list** (a constant list: no test, per AGENTS.md «Tests»)

```ts
// apps/web/src/features/search/commands.ts
import type { Translate } from '@saldo/i18n/translate';
import { navItems } from '../shell/nav';

/** A page or an action of the palette (spec 2026-10-23, §03). The browser ranks these itself. */
export interface PaletteCommand {
  id: string;
  label: string;
  icon: string;
  href: string;
  /** Shown with an empty query: every action, and the five main pages. */
  primary: boolean;
}

export interface PaletteCommands {
  actions: PaletteCommand[];
  pages: PaletteCommand[];
}

/** `NEW_TRANSACTION_HREF` of `NewTransactionLink`, which is a client module a server list cannot import. */
const NEW_TRANSACTION = '/transactions?new';

export function paletteCommands(t: Translate): PaletteCommands {
  const action = (id: string, labelKey: string, href: string): PaletteCommand => ({
    id,
    label: t(labelKey),
    icon: 'plus',
    href,
    primary: true,
  });
  const page = (id: string, labelKey: string, icon: string, href: string): PaletteCommand => ({
    id,
    label: t(labelKey),
    icon,
    href,
    primary: false,
  });
  return {
    actions: [
      action('new-transaction', 'web.shell.newTransaction', NEW_TRANSACTION),
      action('new-account', 'accounts.newAccount', '/accounts?new'),
      action('new-goal', 'goals.newGoal', '/profile/goals?new'),
      action('new-budget', 'budgets.newBudget', '/profile/budgets?new'),
      action('new-category', 'categories.newCategory', '/profile/categories?new'),
      action('new-tag', 'tags.newTag', '/profile/tags?new'),
    ],
    pages: [
      ...navItems().map((item) => ({
        id: item.key,
        label: t(item.labelKey),
        icon: item.icon,
        href: item.href,
        primary: true,
      })),
      { ...page('profile', 'profile.title', 'settings', '/profile'), primary: true },
      page('passkeys', 'web.passkeys.title', 'key', '/profile/passkeys'),
      page('preferences', 'settings.preferences', 'wrench', '/profile/preferences'),
      page('categories', 'categories.title', 'grip', '/profile/categories'),
      page('tags', 'tags.title', 'tag', '/profile/tags'),
      page('budgets', 'budgets.title', 'target', '/profile/budgets'),
      page('goals', 'goals.title', 'piggy', '/profile/goals'),
      page('connectors', 'web.connectors.title', 'plug', '/profile/connectors'),
      page('data', 'web.data.title', 'archive', '/profile/data'),
    ],
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/search/commands.ts
git commit -m "feat(web): the pages and actions of the command palette"
```

---

### Task 5: The palette component and the top bar

**Files:**
- Create: `apps/web/src/ui/CommandPalette.tsx`
- Create: `apps/web/src/ui/CommandPalette.module.css`
- Modify: `apps/web/src/ui/TopBar.tsx` (a `search` slot)
- Modify: `apps/web/app/(app)/layout.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/ui/CommandPalette.tsx
'use client';

import { Autocomplete } from '@base-ui/react/autocomplete';
import { Dialog } from '@base-ui/react/dialog';
import { rankSearch, SEARCH_GROUP_LIMIT } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { PaletteCommand, PaletteCommands } from '../features/search/commands';
import type { SearchResult } from '../features/search/searchView';
import styles from './CommandPalette.module.css';
import { Icon } from './Icon';
import { useNavTransition } from './NavPending';
import { NEW_TRANSACTION_HREF, openNewTransaction } from './NewTransactionLink';
import { VisuallyHidden } from './VisuallyHidden';

interface Row {
  id: string;
  title: string;
  detail: string | null;
  figure: string | null;
  icon: string;
  href: string;
}

interface Group {
  value: string;
  label: string;
  items: Row[];
}

interface Props {
  commands: PaletteCommands;
  /** `searchAction`, handed down by the layout: `src/ui` does not import from `app/`. */
  search: (query: string) => Promise<SearchResult>;
  /** The platform from the request's `User-Agent`: `⌘K` on Apple systems, `Ctrl K` elsewhere. */
  apple: boolean;
  strings: {
    button: string;
    title: string;
    placeholder: string;
    actions: string;
    goTo: string;
    searching: string;
    error: string;
    noResultsHint: string;
    move: string;
    open: string;
    close: string;
  };
}

/** Palette spec §05: a request 150ms after the last key, not one per character. */
const DEBOUNCE_MS = 150;

/**
 * What owns the keyboard while it is open (palette spec §02): a confirmation, another dialog, the
 * transaction form. A `Panel` (`data-panel`) does not: the palette opens over a detail.
 */
const OTHER_OWNER =
  '[role="dialog"]:not([data-panel]):not([data-palette]), [role="alertdialog"], form[data-owns-keys]';

function otherOwnerOpen(): boolean {
  for (const owner of document.querySelectorAll(OTHER_OWNER)) {
    if (owner.getClientRects().length > 0) return true;
  }
  return false;
}

function commandRow(command: PaletteCommand): Row {
  return {
    id: `command:${command.id}`,
    title: command.label,
    detail: null,
    figure: null,
    icon: command.icon,
    href: command.href,
  };
}

/**
 * The command palette (spec 2026-10-23): the top bar's «Search» and `⌘K` / `Ctrl K` on every page.
 * Base UI's `Autocomplete`, inline in a `Dialog`, is the combobox and the listbox; the browser ranks
 * the commands, and `search` ranks the user's data on the server.
 */
export function CommandPalette({ commands, search, apple, strings }: Props) {
  const router = useRouter();
  const startNav = useNavTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** The query typed now: an answer to any other one is dropped. */
  const latest = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Set when a row is chosen: the page or the form takes the focus, not the trigger. */
  const leaving = useRef(false);

  const reset = () => {
    clearTimeout(timer.current);
    latest.current = '';
    setQuery('');
    setResult(null);
    setPending(false);
    setFailed(false);
  };

  const changeOpen = (next: boolean) => {
    if (next) leaving.current = false;
    else reset();
    setOpen(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      if (!open && otherOwnerOpen()) return;
      event.preventDefault();
      if (open) reset();
      else leaving.current = false;
      setOpen(!open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  const onQuery = (next: string) => {
    setQuery(next);
    latest.current = next;
    clearTimeout(timer.current);
    if (next.trim() === '') {
      setResult(null);
      setPending(false);
      setFailed(false);
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      search(next).then(
        (answer) => {
          if (latest.current !== next) return;
          setResult(answer);
          setPending(false);
          setFailed(false);
        },
        () => {
          if (latest.current !== next) return;
          setPending(false);
          setFailed(true);
        },
      );
    }, DEBOUNCE_MS);
  };

  const go = (href: string) => {
    leaving.current = true;
    changeOpen(false);
    if (href === NEW_TRANSACTION_HREF && openNewTransaction(true)) return;
    startNav(() => router.push(href));
  };

  const text = query.trim();
  const rankCommands = (list: PaletteCommand[]) =>
    text === ''
      ? list.filter((command) => command.primary)
      : rankSearch(
          text,
          list.map((command) => ({ value: command, text: command.label })),
          { limit: SEARCH_GROUP_LIMIT },
        );
  const current = result !== null && result.query === text ? result : null;
  const groups: Group[] = [
    { value: 'actions', label: strings.actions, items: rankCommands(commands.actions).map(commandRow) },
    { value: 'pages', label: strings.goTo, items: rankCommands(commands.pages).map(commandRow) },
    ...(text === '' || result === null
      ? []
      : result.groups.map((group) => ({
          value: group.key,
          label: group.label,
          items: group.hits.map((hit) => ({ ...hit, id: `${group.key}:${hit.id}` })),
        }))),
  ].filter((group) => group.items.length > 0);
  const nothing = current !== null && !pending && groups.length === 0;
  if (current !== null) {
    groups.push({
      value: 'all',
      label: '',
      items: [
        { id: 'all', title: current.seeAll.label, detail: null, figure: null, icon: 'search', href: current.seeAll.href },
      ],
    });
  }
  const status = failed
    ? strings.error
    : pending
      ? strings.searching
      : nothing && current !== null
        ? current.noMatch
        : '';

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger className={styles.trigger} aria-keyshortcuts="Meta+K Control+K">
        <Icon name="search" size={16} />
        <span>{strings.button}</span>
        <kbd className={styles.kbd} aria-hidden="true">
          {apple ? '⌘K' : 'Ctrl K'}
        </kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup
          className={styles.popup}
          aria-label={strings.title}
          data-palette=""
          initialFocus={input}
          finalFocus={() => !leaving.current}
        >
          <Autocomplete.Root
            open
            inline
            items={groups}
            value={query}
            onValueChange={(next, details) => {
              if (details.reason === 'input-change' || details.reason === 'input-clear') onQuery(next);
            }}
            filter={null}
            autoHighlight="always"
            keepHighlight
            itemToStringValue={(row: Row) => row.title}
          >
            <div className={styles.head}>
              <Icon name="search" size={16} className={styles.headIcon} />
              <Autocomplete.Input
                ref={input}
                className={styles.input}
                placeholder={strings.placeholder}
                aria-label={strings.title}
              />
              {pending ? (
                <span className={styles.pending} aria-hidden="true">
                  {strings.searching}
                </span>
              ) : null}
              <Dialog.Close className={styles.close} aria-label={strings.close}>
                <kbd className={styles.kbd}>Esc</kbd>
              </Dialog.Close>
            </div>
            <div className={styles.body}>
              <Autocomplete.Status>
                <VisuallyHidden>{status}</VisuallyHidden>
              </Autocomplete.Status>
              {nothing && current !== null ? (
                <div className={styles.message}>
                  <p className={styles.messageTitle}>{current.noMatch}</p>
                  <p className={styles.messageHint}>{strings.noResultsHint}</p>
                </div>
              ) : null}
              {failed ? <p className={styles.message}>{strings.error}</p> : null}
              <Autocomplete.List className={styles.list}>
                {(group: Group) => (
                  <Autocomplete.Group key={group.value} items={group.items} className={styles.group}>
                    {group.label === '' ? null : (
                      <Autocomplete.GroupLabel className={styles.groupLabel}>
                        {group.label}
                      </Autocomplete.GroupLabel>
                    )}
                    <Autocomplete.Collection>
                      {(row: Row) => (
                        <Autocomplete.Item
                          key={row.id}
                          value={row}
                          className={styles.item}
                          onClick={() => go(row.href)}
                        >
                          <span className={styles.itemIcon}>
                            <Icon name={row.icon as IconName} size={16} />
                          </span>
                          <span className={styles.itemText}>
                            <span className={styles.itemTitle}>{row.title}</span>
                            {row.detail === null ? null : (
                              <span className={styles.itemDetail}>{row.detail}</span>
                            )}
                          </span>
                          {row.figure === null ? null : (
                            <span className={styles.itemFigure}>{row.figure}</span>
                          )}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.Collection>
                  </Autocomplete.Group>
                )}
              </Autocomplete.List>
            </div>
            <div className={styles.foot} aria-hidden="true">
              <span>
                <kbd className={styles.kbd}>↑</kbd>
                <kbd className={styles.kbd}>↓</kbd>
                {strings.move}
              </span>
              <span>
                <kbd className={styles.kbd}>↵</kbd>
                {strings.open}
              </span>
              <span>
                <kbd className={styles.kbd}>Esc</kbd>
                {strings.close}
              </span>
            </div>
          </Autocomplete.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Write the styles**

```css
/* apps/web/src/ui/CommandPalette.module.css */
/* Redesign H1: «Search» between the space and «New transaction», from `--layout-search-breakpoint`. */
.trigger {
  display: none;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 6px 0 10px;
  border-radius: var(--radius-input);
  box-shadow: inset 0 0 0 1px var(--color-border-strong);
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  white-space: nowrap;
  transition: color var(--motion-press) var(--motion-easing);
}

.trigger:hover {
  color: var(--color-text);
}

/* `--layout-search-breakpoint` (1000): a media query cannot read a custom property. */
@media (min-width: 1000px) {
  .trigger {
    display: inline-flex;
  }
}

.kbd {
  font: inherit;
  font-size: var(--font-size-caption);
  line-height: 1.5;
  padding: 0 5px;
  border-radius: var(--radius-icon-box);
  background: var(--color-raised);
  color: var(--color-text-muted);
}

/* Above the panel (20, 21) and the toast (30), as the confirmation dialog. */
.backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
  background: var(--color-dialog-scrim);
  transition: opacity var(--motion-dialog-fade) var(--motion-easing);
}

.backdrop[data-starting-style],
.backdrop[data-ending-style] {
  opacity: 0;
}

/* Spec §07: 640px, at 12% of the height; below 760px the width of the screen, 8px from each edge. */
.popup {
  position: fixed;
  z-index: 41;
  top: 8px;
  left: 50%;
  translate: -50% 0;
  width: calc(100vw - 16px);
  max-height: calc(100dvh - 16px);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-dialog);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 16px 40px var(--color-shadow);
  overflow: hidden;
  transition-property: opacity, translate;
  transition-duration: var(--motion-dialog-fade);
  transition-timing-function: var(--motion-easing);
}

/* §08: in with a fade and 4px of travel; out at once. */
.popup[data-starting-style] {
  opacity: 0;
  translate: -50% -4px;
}

.popup[data-ending-style] {
  transition: none;
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .popup {
    top: 12vh;
    width: min(var(--layout-palette-width), calc(100vw - 32px));
    max-height: 76vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .popup[data-starting-style] {
    translate: -50% 0;
  }
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 16px;
  min-height: 52px;
  border-bottom: 1px solid var(--color-border);
}

.headIcon {
  flex: none;
  color: var(--color-text-muted);
}

.input {
  flex: 1;
  min-width: 0;
  height: 52px;
  border: 0;
  outline: none;
  background: none;
  color: var(--color-text);
  font-size: var(--font-size-body);
}

.input::placeholder {
  color: var(--color-text-faint);
}

.pending {
  flex: none;
  color: var(--color-text-faint);
  font-size: var(--font-size-footnote);
}

.close {
  flex: none;
  display: grid;
  place-items: center;
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px;
  scroll-padding-block: 6px;
}

.message {
  padding: 16px 10px 8px;
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.messageTitle {
  color: var(--color-text);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
}

.messageHint {
  margin-top: 2px;
}

.group + .group {
  margin-top: 4px;
}

.groupLabel {
  padding: 10px 10px 6px;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: var(--radius-input);
  cursor: default;
  user-select: none;
}

.item[data-highlighted] {
  background: var(--color-raised);
}

.itemIcon {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--layout-icon-box-small);
  height: var(--layout-icon-box-small);
  border-radius: var(--radius-icon-box);
  background: var(--color-raised);
  color: var(--color-text);
}

.item[data-highlighted] .itemIcon {
  background: var(--color-bg);
}

.itemText {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.itemTitle,
.itemDetail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.itemTitle {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
}

.itemDetail {
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
}

.itemFigure {
  flex: none;
  font-size: var(--font-size-footnote);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 10px 16px;
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
}

.foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* §07: the keys mean nothing on a touch screen. */
@media (pointer: coarse) {
  .foot {
    display: none;
  }
}
```

- [ ] **Step 3: Give the top bar a slot** — in `apps/web/src/ui/TopBar.tsx` add `search: ReactNode;` to `Props` (import `type ReactNode` from `react`), take `search` in the parameters, and render `{search}` as the first child of `<div className={styles.actions}>`, before `NewTransactionLink`. Change the doc comment: “From left to right the brand, the four destinations, «Search» (from 1000px, `CommandPalette`), «New transaction» and the avatar”.

- [ ] **Step 4: Mount it in the layout** — in `apps/web/app/(app)/layout.tsx`:

```tsx
import { headers } from 'next/headers';
import { paletteCommands } from '../../src/features/search/commands';
import { CommandPalette } from '../../src/ui/CommandPalette';
import { searchAction } from './actions';
// …
  const apple = /Mac|iPhone|iPad/.test((await headers()).get('user-agent') ?? '');
// …
        <TopBar
          items={items}
          user={…}
          strings={…}
          search={
            <CommandPalette
              commands={paletteCommands(t)}
              search={searchAction}
              apple={apple}
              strings={{
                button: t('common.search'),
                title: t('web.search.title'),
                placeholder: t('web.search.placeholder'),
                actions: t('web.search.actions'),
                goTo: t('web.search.goTo'),
                searching: t('web.search.searching'),
                error: t('web.search.error'),
                noResultsHint: t('web.search.noResultsHint'),
                move: t('web.search.keysMove'),
                open: t('web.search.keysOpen'),
                close: t('web.search.keysClose'),
              }}
            />
          }
        />
```

- [ ] **Step 5: Typecheck and lint**

Run: `rtk proxy pnpm --filter web typecheck` and `rtk proxy pnpm lint`
Expected: no errors; no `lint/…` lines.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/ui/CommandPalette.tsx apps/web/src/ui/CommandPalette.module.css apps/web/src/ui/TopBar.tsx "apps/web/app/(app)/layout.tsx"
git commit -m "feat(web): the command palette and Search in the top bar"
```

---

### Task 6: End-to-end test

**Files:**
- Create: `apps/web/e2e/command-palette.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// apps/web/e2e/command-palette.spec.ts
import { expect, test } from './fixtures';
import { addTransaction } from './support/ledger';
import { createMember } from './support/members';

const MAIN = 'Conto principale';

test.describe('command palette', () => {
  test('the keyboard opens it, finds an account and a transaction, and opens them', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Paletta', email: 'palette@e2e.test' });
    const { page } = member;
    await addTransaction(page, t, { amount: '12,34', description: 'Gelateria Pistacchio' });

    await page.goto('/home');
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: t('web.search.title') });
    const field = palette.getByRole('combobox', { name: t('web.search.title') });
    await expect(field).toBeFocused();
    // An empty query: the actions and the main pages.
    await expect(palette.getByRole('option', { name: t('web.shell.newTransaction') })).toBeVisible();

    await field.fill('principale');
    await expect(palette.getByRole('option', { name: new RegExp(MAIN) })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/accounts\?a=/);
    await expect(palette).toBeHidden();
    await expect(page.getByRole('dialog', { name: MAIN })).toBeVisible();

    await page.goto('/home');
    await page.keyboard.press('ControlOrMeta+k');
    await field.fill('12,34');
    const tx = palette.getByRole('option', { name: /Gelateria Pistacchio/ });
    await expect(tx).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/transactions\?t=/);
    await expect(page.getByRole('dialog', { name: t('txForm.editTitle') })).toBeVisible();

    // No match: a sentence, and the row that opens Transactions with the query.
    await page.goto('/home');
    await page.keyboard.press('ControlOrMeta+k');
    await field.fill('zzzz');
    await expect(palette.getByText(t('web.search.noResults', { query: 'zzzz' }))).toBeVisible();
    await palette.getByRole('option', { name: t('web.search.seeAll', { query: 'zzzz' }) }).click();
    await expect(page).toHaveURL(/\/transactions\?q=zzzz$/);

    // Esc closes it, and the focus goes back to the button that opened it.
    const trigger = page.getByRole('banner').getByRole('button', { name: t('common.search') });
    await trigger.click();
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(trigger).toBeFocused();
    await member.context.close();
  });

  test('«Search» shows from 1000px; the shortcut opens the palette at every width', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Stretta', email: 'palette-narrow@e2e.test' });
    const { page } = member;
    const trigger = page.getByRole('banner').getByRole('button', { name: t('common.search') });
    const palette = page.getByRole('dialog', { name: t('web.search.title') });

    for (const [width, shown] of [
      [1280, true],
      [900, false],
      [390, false],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/home');
      if (shown) await expect(trigger).toBeVisible();
      else await expect(trigger).toBeHidden();
      await page.keyboard.press('ControlOrMeta+k');
      await expect(palette).toBeVisible();
      await page.keyboard.press('ControlOrMeta+k');
      await expect(palette).toBeHidden();
    }
    await member.context.close();
  });
});
```

- [ ] **Step 2: Run it** from `apps/web` (a `next dev` of the user's runs on port 3000; do not use `E2E_DEV=1`, and do not stop that server):

Run: `E2E_PORT=3198 E2E_DB_PORT=54398 rtk proxy pnpm exec playwright test e2e/01-setup.spec.ts e2e/command-palette.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/command-palette.spec.ts
git commit -m "test(web): the command palette from the keyboard, at three widths"
```

---

### Task 7: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-20-web-home-redesign.html` (open item 5)
- Modify: `docs/superpowers/plans/2026-10-21-web-redesign-r1-shell-home.md` (the “No Search” decision)
- Modify: `docs/superpowers/plans/README.md` (web redesign section)

- [ ] **Step 1:** In the redesign spec, append to open item 5: “Done on 2026-10-23: see <code>2026-10-23-web-command-palette.html</code>. “Search” is in the top bar from 1000px.”
- [ ] **Step 2:** In the R1 plan, append to the “No Search” bullet: “The palette shipped on 2026-10-23 (`2026-10-23-web-command-palette.md`). “Search” is now in the top bar.”
- [ ] **Step 3:** In `plans/README.md`, add a row for the palette to the web redesign table, with this plan and the spec, status done.
- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-20-web-home-redesign.html docs/superpowers/plans/2026-10-21-web-redesign-r1-shell-home.md docs/superpowers/plans/README.md docs/superpowers/plans/2026-10-23-web-command-palette.md
git commit -m "docs: the command palette done, open item 5 of the redesign closed"
```

---

### Task 8: Gates and a look in the browser

- [ ] **Step 1:** `rtk proxy pnpm lint` — clean means no `lint/…` lines and no `× Some errors were emitted`.
- [ ] **Step 2:** `rtk proxy pnpm typecheck --continue` — `site` may fail only on the Node ≥ 22.22 engine check.
- [ ] **Step 3:** `rtk proxy pnpm test` — every package green.
- [ ] **Step 4:** From `apps/web`: `E2E_PORT=3198 E2E_DB_PORT=54398 rtk proxy pnpm e2e` — the full suite green.
- [ ] **Step 5:** Take screenshots of the palette at 1440px and 390px, light and dark, with a temporary Playwright script outside the repository. Delete the script and the images.
