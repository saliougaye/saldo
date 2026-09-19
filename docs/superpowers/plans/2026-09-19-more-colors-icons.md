# More colours and icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the colour palette from 10 to 24 swatches and the icon library by 59 icons, for accounts and categories, and let a budget pick its own icon.

**Architecture:** Colours and icons are plain data in `@saldo/ui` (`tokens.ts`, `icons.ts`); entities store an index / a name, so nothing in storage changes shape. The only schema change is the upper bound of `colorIndex` in `@saldo/core` (9 → 23). The existing colours keep indices 0–9, so no stored row changes meaning. The budget form gains an appearance row that reuses `AppearanceSheet` with the colour grid hidden.

**Tech Stack:** TypeScript strict, zod, vitest (`packages/*`), jest + Testing Library (`apps/mobile`), react-native-svg, Lucide 1.47.0 (ISC) as the icon source.

**Decisions taken with the user on 2026-09-19:** tags stay as they are (a name only, §5.10); budgets get an icon picker only, the colour still comes from the category; about 24 colours; about 60 new icons in themed groups. `SYNC_SCHEMA_VERSION` is **not** bumped (frozen until Saldo is released: there are no active users).

**Spec check:** `colorIndex` bound and the icon list are not fixed by the spec (`grep -n "colorIndex\|0-9\|0–9" docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` to see the wording). If a sentence says "ten colours", fix it in the same commit as Task 1.

## File structure

| File | Responsibility |
|---|---|
| `packages/core/src/entities.ts` | `MAX_COLOR_INDEX`, used by `colorIndex` |
| `packages/ui/src/tokens.ts` | 24 swatches and their names |
| `packages/ui/src/icons.ts` | 59 new icons, extended picker groups |
| `packages/i18n/src/locales/{it,en}.ts` | swatch names, new group names |
| `THIRD-PARTY.md` | Lucide ISC and Feather MIT notices |
| `apps/mobile/src/components/AppearanceSheet.tsx` | `colours` prop to hide the swatch grid |
| `apps/mobile/src/components/appearanceCoverage.test.ts` | palette, names and groups stay in step |
| `apps/mobile/src/features/budgets/*`, `apps/mobile/app/budget/*` | budget icon picker |

Run every command from the worktree root `/Users/saliougaye/sandbox/saldo-more-colors-icons` (branch `feat/more-colors-icons`).

---

### Task 1: Widen the colour index in core

**Files:**
- Modify: `packages/core/src/entities.ts:17`
- Test: `packages/core/src/entities.test.ts` (append; if the file does not exist, create it with the imports shown)

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { categorySchema, MAX_COLOR_INDEX } from './entities';

const base = {
  id: 'c1',
  createdAt: '2026-09-19T10:00:00.000Z',
  updatedAt: '0000000000000-0000-a',
  deletedAt: null,
  name: 'Groceries',
  direction: 'expense' as const,
  parentId: null,
  icon: 'cart',
  archivedAt: null,
  sortOrder: 0,
};

describe('colorIndex', () => {
  it('accepts every swatch up to MAX_COLOR_INDEX', () => {
    expect(MAX_COLOR_INDEX).toBe(23);
    expect(categorySchema.safeParse({ ...base, colorIndex: 0 }).success).toBe(true);
    expect(categorySchema.safeParse({ ...base, colorIndex: MAX_COLOR_INDEX }).success).toBe(true);
  });

  it('rejects an index beyond the palette', () => {
    expect(categorySchema.safeParse({ ...base, colorIndex: MAX_COLOR_INDEX + 1 }).success).toBe(
      false,
    );
  });
});
```

If `entities.test.ts` already exists, add only the `describe` block and merge the imports.

- [x] **Step 2: Run it and see it fail**

Run: `pnpm --filter @saldo/core test -- entities`
Expected: FAIL, `MAX_COLOR_INDEX` is not exported (the first test fails on `undefined`).

- [x] **Step 3: Implement**

In `packages/core/src/entities.ts` replace line 17:

```ts
/** Number of swatches in `categoryColors` (`@saldo/ui`) minus one; a test in the mobile app keeps them equal. */
export const MAX_COLOR_INDEX = 23;
const colorIndex = z.number().int().min(0).max(MAX_COLOR_INDEX);
```

Check that `packages/core/src/index.ts` re-exports `entities` with `export *`; if it lists names, add `MAX_COLOR_INDEX`.

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @saldo/core test`
Expected: all pass. `backup.test.ts` still rejects `colorIndex: 99`.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/entities.ts packages/core/src/entities.test.ts packages/core/src/index.ts
git commit -m "feat(core): allow 24 colour indices"
```

---

### Task 2: Fourteen new swatches, named

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `categoryColors` and `categoryColorNames` arrays and their comment)
- Modify: `packages/ui/src/tokens.test.ts` (the `categoryColors` describe block)
- Modify: `packages/i18n/src/locales/en.ts:695-706`, `packages/i18n/src/locales/it.ts:700-711`

- [x] **Step 1: Write the failing test**

Replace the `describe('categoryColors', …)` block in `packages/ui/src/tokens.test.ts`:

```ts
describe('categoryColors', () => {
  it('has twenty-four swatches, the original ten first', () => {
    expect(categoryColors).toHaveLength(24);
    // Stored indices must keep their meaning: a row saved with 4 was teal and stays teal.
    expect(categoryColors.slice(0, 10)).toEqual([
      '#C57B4E',
      '#B4894A',
      '#8F9152',
      '#63926F',
      '#4F8D8B',
      '#5A82A6',
      '#7A79AC',
      '#A06FA0',
      '#AF6B7B',
      '#8A8A8A',
    ]);
  });

  it('are valid, distinct hex colours', () => {
    for (const colour of categoryColors) expect(colour).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(categoryColors).size).toBe(categoryColors.length);
  });

  it('names every one of them', () => {
    // An unnamed swatch is announced as a hex code, which is the state this list exists to end.
    expect(categoryColorNames).toHaveLength(categoryColors.length);
    expect(new Set(categoryColorNames).size).toBe(categoryColorNames.length);
  });
});
```

- [x] **Step 2: Run it and see it fail**

Run: `pnpm --filter @saldo/ui test -- tokens`
Expected: FAIL, `expected 10 to be 24`.

- [x] **Step 3: Implement**

In `packages/ui/src/tokens.ts` change the doc comment to `/** Category and account colours; entities store an index 0-23. Never reorder: an index is stored. */` and append to the two arrays (keep the existing ten untouched):

```ts
  // categoryColors, after '#8A8A8A'
  '#B5584F',
  '#D0806A',
  '#C9A048',
  '#78934A',
  '#4A8560',
  '#5FA890',
  '#5B9BC0',
  '#4F6FB0',
  '#6461A8',
  '#8E5C93',
  '#B36FA8',
  '#B35878',
  '#8A6A55',
  '#6B7785',
```

```ts
  // categoryColorNames, after 'grey'
  'brick',
  'coral',
  'amber',
  'moss',
  'forest',
  'mint',
  'sky',
  'cobalt',
  'indigo',
  'plum',
  'orchid',
  'raspberry',
  'coffee',
  'slate',
```

In `en.ts`, inside `colors`, after `grey: 'Grey',`:

```ts
    brick: 'Brick',
    coral: 'Coral',
    amber: 'Amber',
    moss: 'Moss',
    forest: 'Forest',
    mint: 'Mint',
    sky: 'Sky',
    cobalt: 'Cobalt',
    indigo: 'Indigo',
    plum: 'Plum',
    orchid: 'Orchid',
    raspberry: 'Raspberry',
    coffee: 'Coffee',
    slate: 'Slate',
```

In `it.ts`, inside `colors`, after `grey: 'Grigio',`:

```ts
    brick: 'Mattone',
    coral: 'Corallo',
    amber: 'Ambra',
    moss: 'Muschio',
    forest: 'Foresta',
    mint: 'Menta',
    sky: 'Cielo',
    cobalt: 'Cobalto',
    indigo: 'Indaco',
    plum: 'Prugna',
    orchid: 'Orchidea',
    raspberry: 'Lampone',
    coffee: 'Caffè',
    slate: 'Ardesia',
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter @saldo/ui test && pnpm --filter @saldo/i18n test`
Expected: PASS (the i18n parity test checks both files have the same keys).

- [x] **Step 5: Commit**

```bash
git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts packages/i18n/src/locales
git commit -m "feat(ui): grow the category palette to 24 colours"
```

---

### Task 3: Fifty-nine new icons and the picker groups

**Files:**
- Modify: `packages/ui/src/icons.ts` (`iconMarkup`, `categoryIconGroups`, `accountIconOptions`, header comment)
- Modify: `packages/ui/src/icons.test.ts`
- Modify: `packages/i18n/src/locales/en.ts:707-714`, `packages/i18n/src/locales/it.ts:712-719`

The markup below was generated from `lucide-static@1.47.0`; `line` and `polyline` elements were rewritten as `path` because `parseIconMarkup` only understands `path`, `circle` and `rect`. Three of the icons (`headphones`, `percent`, `tv`) are Feather-derived and MIT-licensed, see Task 4.

- [x] **Step 1: Write the failing tests**

In `packages/ui/src/icons.test.ts` change the `icon set` count test and add a group test:

```ts
  it('contains the 74 design icons plus the Lucide additions, each with at least one node', () => {
    expect(ICON_NAMES).toHaveLength(134);
    // Added beyond the design's set; see the comment on `iconMarkup`.
    expect(ICON_NAMES).toContain('chevUD');
    for (const name of ICON_NAMES) {
      expect(iconNodes[name].length, name).toBeGreaterThan(0);
    }
    expect(iconNodes.grip.filter((node) => node.tag === 'circle')).toHaveLength(6);
  });

  it('offers every category icon exactly once in the picker', () => {
    const offered = categoryIconGroups.flatMap((group) => group.icons);
    expect(new Set(offered).size).toBe(offered.length);
    for (const name of ['sofa', 'dog', 'shirt', 'laptop', 'banknote']) {
      expect(offered).toContain(name);
    }
  });
```

- [x] **Step 2: Run it and see it fail**

Run: `pnpm --filter @saldo/ui test -- icons`
Expected: FAIL, `expected 75 to have a length of 134`.

- [x] **Step 3: Add the markup**

Append inside `iconMarkup` in `packages/ui/src/icons.ts`, after the `piggy` entry and before `} as const satisfies`:

```ts
  // home
  sofa:
    '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/>',
  bath:
    '<path d="M10 4 8 6"/><path d="M17 19v2"/><path d="M2 12h20"/><path d="M7 19v2"/><path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  lamp:
    '<path d="M12 12v6"/><path d="M4.077 10.615A1 1 0 0 0 5 12h14a1 1 0 0 0 .923-1.385l-3.077-7.384A2 2 0 0 0 15 2H9a2 2 0 0 0-1.846 1.23Z"/><path d="M8 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/>',
  hammer:
    '<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
  flame:
    '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  plug:
    '<path d="M12 22v-5"/><path d="M15 8V2"/><path d="M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z"/><path d="M9 8V2"/>',
  showerHead:
    '<path d="m4 4 2.5 2.5"/><path d="M13.5 6.5a4.95 4.95 0 0 0-7 7"/><path d="M15 5 5 15"/><path d="M14 17v.01"/><path d="M10 16v.01"/><path d="M13 13v.01"/><path d="M16 10v.01"/><path d="M11 20v.01"/><path d="M17 14v.01"/><path d="M20 11v.01"/>',
  // transport
  ship:
    '<path d="M12 2v2"/><path d="M12 9.189V13"/><path d="M19 12V6a2 2 0 00-2-2H7a2 2 0 00-2 2v6"/><path d="M19.38 19A11.6 11.6 0 0021 13l-8.188-3.639a2 2 0 00-1.624 0L3 13.001a11.6 11.6 0 002.81 7.76"/><path d="M2 20c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  truck:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  tramFront:
    '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
  circleParking:
    '<circle cx="12" cy="12" r="10"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  sailboat:
    '<path d="M10 2v15"/><path d="M7 22a4 4 0 0 1-4-4 1 1 0 0 1 1-1h16a1 1 0 0 1 1 1 4 4 0 0 1-4 4z"/><path d="M9.159 2.46a1 1 0 0 1 1.521-.193l9.977 8.98A1 1 0 0 1 20 13H4a1 1 0 0 1-.824-1.567z"/>',
  // food
  beer:
    '<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>',
  cake:
    '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>',
  croissant:
    '<path d="M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487"/><path d="M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132"/><path d="M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42"/><path d="M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14"/><path d="M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676"/>',
  iceCreamCone:
    '<path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/><path d="M17 7A5 5 0 0 0 7 7"/><path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>',
  sandwich:
    '<path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777"/><path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25"/><path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9"/><path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2"/><rect width="20" height="4" x="2" y="11" rx="1"/>',
  salad:
    '<path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1"/><path d="m13 12 4-4"/><path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2"/>',
  cookie:
    '<path d="M11 17h.01"/><path d="M11.496 2c.324-.016.558.292.529.615a4 4 0 004.235 4.368.713.713 0 01.758.757 4 4 0 004.366 4.237c.323-.03.63.204.614.527a10 10 0 01-2.915 6.566A1 1 0 114.93 4.918 10 10 0 0111.496 2"/><path d="M12 12h.01"/><path d="M16 16h.01"/><path d="M16 3h.01"/><path d="M21 4h.01"/><path d="M21 8h.01"/><path d="M7 14h.01"/><path d="M9 8h.01"/>',
  // health
  stethoscope:
    '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  syringe:
    '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
  bandage:
    '<path d="M10 10.01h.01"/><path d="M10 14.01h.01"/><path d="M14 10.01h.01"/><path d="M14 14.01h.01"/><path d="M18 6v12"/><path d="M6 6v12"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
  glasses:
    '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>',
  baby:
    '<path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/><path d="M9 12h.01"/>',
  // leisure
  tent:
    '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
  mountain:
    '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  popcorn:
    '<path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4"/><path d="M10 22 9 8"/><path d="m14 22 1-14"/><path d="M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z"/>',
  dice5:
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>',
  palette:
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  guitar:
    '<path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z"/><path d="m6 16 2 2"/><path d="M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z"/>',
  partyPopper:
    '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
  trophy:
    '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
  umbrella:
    '<path d="M12 13v7a2 2 0 0 0 4 0"/><path d="M12 2v2"/><path d="M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z"/>',
  // nature
  dog:
    '<path d="M11.25 16.25h1.5L12 17z"/><path d="M16 14v.5"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309"/><path d="M8 14v.5"/><path d="M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/>',
  cat:
    '<path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75Z"/>',
  pawPrint:
    '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  leaf:
    '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/>',
  flower2:
    '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/><path d="M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>',
  treePalm:
    '<path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/>',
  // shopping
  shirt:
    '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  watch:
    '<path d="M12 10v2.2l1.6 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/><circle cx="12" cy="12" r="6"/>',
  gem:
    '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>',
  store:
    '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  package:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="M3.29L7L12L12L20.71L7"/><path d="m7.5 4.27 9 5.15"/>',
  shoppingBasket:
    '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  scissors:
    '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  // tech
  laptop:
    '<path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/>',
  headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  printer:
    '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  tv:
    '<path d="m17 2-5 5-5-5"/><rect width="20" height="15" x="2" y="7" rx="2"/>',
  router:
    '<rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.31 0"/>',
  // finance
  banknote:
    '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  receipt:
    '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  percent:
    '<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  handCoins:
    '<path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17"/><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 16 6 6"/><circle cx="16" cy="9" r="2.9"/><circle cx="6" cy="5" r="3"/>',
  circleDollarSign:
    '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  vault:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><path d="m7.9 7.9 2.7 2.7"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/><path d="m13.4 10.6 2.7-2.7"/><circle cx="7.5" cy="16.5" r=".5" fill="currentColor"/><path d="m7.9 16.1 2.7-2.7"/><circle cx="16.5" cy="16.5" r=".5" fill="currentColor"/><path d="m13.4 13.4 2.7 2.7"/><circle cx="12" cy="12" r="2"/>',
  calculator:
    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6L16 6"/><path d="M16 14L16 18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  bitcoin:
    '<path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"/>',
```

- [x] **Step 4: Extend the picker groups**

In the same file, replace `categoryIconGroups` and `accountIconOptions`:

```ts
export const categoryIconGroups = [
  { key: 'home', icons: ['house', 'key', 'bed', 'bulb', 'wrench', 'zap', 'drop', 'sofa', 'bath', 'lamp', 'hammer', 'flame', 'plug', 'showerHead'] },
  { key: 'transport', icons: ['train', 'car', 'bus', 'bike', 'fuel', 'plane', 'ship', 'truck', 'tramFront', 'circleParking', 'sailboat'] },
  { key: 'food', icons: ['cart', 'utensils', 'coffee', 'pizza', 'wine', 'apple', 'beer', 'cake', 'croissant', 'iceCreamCone', 'sandwich', 'salad', 'cookie'] },
  { key: 'health', icons: ['heart', 'pill', 'cross', 'activity', 'dumbbell', 'stethoscope', 'syringe', 'bandage', 'glasses', 'baby'] },
  { key: 'leisure', icons: ['film', 'music', 'gamepad', 'ticket', 'book', 'gift', 'tent', 'mountain', 'popcorn', 'dice5', 'palette', 'guitar', 'partyPopper', 'trophy', 'umbrella'] },
  { key: 'nature', icons: ['dog', 'cat', 'pawPrint', 'leaf', 'flower2', 'treePalm'] },
  { key: 'work', icons: ['briefcase', 'monitor', 'cap', 'trend', 'phone', 'coins'] },
  { key: 'shopping', icons: ['bag', 'tag', 'shirt', 'watch', 'gem', 'store', 'package', 'shoppingBasket', 'scissors'] },
  { key: 'tech', icons: ['laptop', 'headphones', 'printer', 'tv', 'router'] },
  { key: 'finance', icons: ['banknote', 'receipt', 'percent', 'handCoins', 'circleDollarSign', 'vault', 'calculator', 'bitcoin'] },
] as const satisfies readonly { key: string; icons: readonly IconName[] }[];

export const accountIconOptions = [
  'landmark',
  'card',
  'coins',
  'piggy',
  'trend',
  'phone',
  'briefcase',
  'shield',
  'banknote',
  'vault',
  'handCoins',
  'circleDollarSign',
  'bitcoin',
] as const satisfies readonly IconName[];
```

The `work` group is unchanged; every other icon appears in exactly one group (the exactly-once test in Step 1 enforces it). `bag` and `tag` were in no group before and join `shopping`.

Update the header comment of `icons.ts` to say the extra icons come from Lucide 1.47.0 and point at `THIRD-PARTY.md`.

- [x] **Step 5: Group names**

`en.ts`, `iconGroups` (keep `work`, add four keys after it):

```ts
    nature: 'Pets & nature',
    shopping: 'Shopping',
    tech: 'Tech',
    finance: 'Money',
```

`it.ts`, `iconGroups` (keep `work`, add four keys after it):

```ts
    nature: 'Animali e natura',
    shopping: 'Acquisti',
    tech: 'Tecnologia',
    finance: 'Denaro',
```

- [x] **Step 6: Run the tests**

Run: `pnpm --filter @saldo/ui test && pnpm --filter @saldo/i18n test && pnpm typecheck`
Expected: PASS. Icons all have nodes, so a malformed markup string shows up as a zero-node failure naming the icon.

- [x] **Step 7: Commit**

```bash
git add packages/ui packages/i18n
git commit -m "feat(ui): 59 more icons in themed picker groups"
```

---

### Task 4: Third-party notices

**Files:**
- Create: `THIRD-PARTY.md`
- Modify: `TODO.md` (tick "Third-party notices" under "Going public"; remove the "More colours and icons" bullet from "Tags: freeze, palette and layout", keeping the other two)

- [x] **Step 1: Write `THIRD-PARTY.md`**

```markdown
# Third-party notices

## Lucide icons

Part of the icon set in \`packages/ui/src/icons.ts\` is copied from [Lucide](https://lucide.dev)
(\`lucide-static\` 1.47.0), with \`line\` and \`polyline\` elements rewritten as \`path\`.

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### Feather

The icons \`headphones\`, \`percent\` and \`tv\` derive from Feather and are under the MIT licence:

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

(In the file itself the backticks are plain backticks; they are escaped here only because this plan is Markdown.)

The icons Lucide-derived **before** this change (`chevUD`, and any others noted in the `icons.ts` header) are covered by the same Lucide notice.

- [x] **Step 2: Update `TODO.md`**

Tick the "Third-party notices" box and delete the "More colours and icons" bullet.

- [x] **Step 3: Commit**

```bash
git add THIRD-PARTY.md TODO.md
git commit -m "docs: third-party notices for Lucide and Feather icons"
```

---

### Task 5: Keep palette, names and groups in step (mobile)

**Files:**
- Create: `apps/mobile/src/components/appearanceCoverage.test.ts`

The mobile app is the one place that sees core, ui and i18n together, so the cross-package guarantees live here.

- [x] **Step 1: Write the test**

```ts
import { MAX_COLOR_INDEX } from '@saldo/core';
import { en, it } from '@saldo/i18n';
import { categoryColorNames, categoryColors, categoryIconGroups } from '@saldo/ui';

describe('appearance data', () => {
  it('has exactly as many swatches as the schema allows', () => {
    expect(categoryColors).toHaveLength(MAX_COLOR_INDEX + 1);
  });

  it('translates every swatch name in both languages', () => {
    for (const name of categoryColorNames) {
      expect(en.colors[name], `en.colors.${name}`).toEqual(expect.any(String));
      expect(it.colors[name], `it.colors.${name}`).toEqual(expect.any(String));
    }
  });

  it('translates every icon group in both languages', () => {
    for (const { key } of categoryIconGroups) {
      expect(en.iconGroups[key], `en.iconGroups.${key}`).toEqual(expect.any(String));
      expect(it.iconGroups[key], `it.iconGroups.${key}`).toEqual(expect.any(String));
    }
  });
});
```

- [x] **Step 2: Run it**

Run: `pnpm --filter mobile test -- appearanceCoverage` (use the package name from `apps/mobile/package.json` if it differs)
Expected: PASS, since Tasks 1–3 already made the data consistent. If it fails, the failure names the missing key: fix the data, not the test.

- [x] **Step 3: Commit**

```bash
git add apps/mobile/src/components/appearanceCoverage.test.ts
git commit -m "test(mobile): palette, names and icon groups stay in step"
```

---

### Task 6: A colour-less AppearanceSheet

**Files:**
- Modify: `apps/mobile/src/components/AppearanceSheet.tsx`
- Modify: `apps/mobile/src/components/AppearanceSheet.test.tsx`

A budget's colour comes from its category, so its sheet must not offer swatches that would do nothing.

- [x] **Step 1: Write the failing test**

Add to the `describe` in `AppearanceSheet.test.tsx`, following the pattern of the first test (same `Host`, `GROUPS`):

```tsx
  it('hides the swatches when colours are turned off', async () => {
    await render(
      <Host>
        <AppearanceSheet
          visible
          onClose={jest.fn()}
          colorIndex={0}
          icon="landmark"
          groups={GROUPS}
          colours={false}
          onChange={jest.fn()}
        />
      </Host>,
    );
    expect(screen.queryByRole('button', { name: 'Terracotta' })).toBeNull();
    expect(screen.getByRole('button', { name: 'card' })).toBeTruthy();
  });
```

- [x] **Step 2: Run it and see it fail**

Run: `pnpm --filter mobile test -- AppearanceSheet`
Expected: FAIL, the Terracotta swatch is still rendered (TypeScript also flags `colours` as an unknown prop).

- [x] **Step 3: Implement**

In `AppearanceSheetProps` add:

```ts
  /** `false` hides the swatch grid, for things whose colour is not theirs to choose (a budget takes its category's). */
  colours?: boolean;
```

Destructure `colours = true`, and wrap the swatch `<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>…</View>` in `{colours ? ( … ) : null}`.

- [x] **Step 4: Run the tests**

Run: `pnpm --filter mobile test -- AppearanceSheet`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/components/AppearanceSheet.tsx apps/mobile/src/components/AppearanceSheet.test.tsx
git commit -m "feat(mobile): AppearanceSheet can hide the colour grid"
```

---

### Task 7: A budget picks its icon

**Files:**
- Modify: `apps/mobile/src/features/budgets/budgetFormValues.ts`
- Create: `apps/mobile/src/features/budgets/budgetFormValues.test.ts`
- Modify: `apps/mobile/src/features/budgets/BudgetForm.tsx` (the `detailsCard`, imports, sheet state)
- Modify: `apps/mobile/app/budget/new.tsx:39`, `apps/mobile/app/budget/[id].tsx` (the `update` call)

`icon: null` in the form means "follow the first category", which is what a new budget did before; once a user picks, the choice is stored and kept.

- [x] **Step 1: Write the failing test**

`apps/mobile/src/features/budgets/budgetFormValues.test.ts`:

```ts
import type { Budget } from '@saldo/core';
import { budgetFormFrom, emptyBudgetForm } from './budgetFormValues';

const budget: Budget = {
  id: 'b1',
  createdAt: '2026-09-19T10:00:00.000Z',
  updatedAt: '0000000000000-0000-a',
  deletedAt: null,
  name: 'Food',
  categoryIds: ['c1'],
  amount: 30000,
  period: 'period',
  alertThreshold: 90,
  rollover: false,
  icon: 'pizza',
  sortOrder: 0,
};

describe('budget form icon', () => {
  it('starts unchosen for a new budget, so it can follow the category', () => {
    expect(emptyBudgetForm().icon).toBeNull();
  });

  it('starts from the stored icon when editing', () => {
    expect(budgetFormFrom(budget, 2).icon).toBe('pizza');
  });
});
```

- [x] **Step 2: Run it and see it fail**

Run: `pnpm --filter mobile test -- budgetFormValues`
Expected: FAIL, `icon` is undefined.

- [x] **Step 3: Implement the values**

In `budgetFormValues.ts` add to `BudgetFormValues`:

```ts
  /** `null` until the user picks one; a new budget then takes its first category's icon. */
  icon: IconName | null;
```

with `import type { IconName } from '@saldo/ui';`, `icon: null,` in `emptyBudgetForm` and `icon: budget.icon as IconName,` in `budgetFormFrom`.

- [x] **Step 4: Wire the routes**

`new.tsx`, replace `icon: first?.icon ?? 'target',` with:

```ts
          icon: values.icon ?? first?.icon ?? 'target',
```

`[id].tsx`, in the `repos.budgets.update(budget.id, { … })` object add `icon: values.icon ?? budget.icon,`.

- [x] **Step 5: Add the row and the sheet**

In `BudgetForm.tsx`: import `AppearanceSheet` from `'../../components/AppearanceSheet'`, `ListRow` next to `IconBox` (`import { IconBox, ListRow } from '../../components/ListRow'`) and `categoryIconGroups` (`import { categoryIconGroups, type IconName } from '@saldo/ui'`, replacing the type-only import). Add state next to the others:

```ts
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const firstCategory = categories.find((category) => category.id === values.categoryIds[0]);
  const icon = (values.icon ?? firstCategory?.icon ?? 'target') as IconName;
  const iconColour = theme.categoryColor(firstCategory?.colorIndex ?? 9);
```

In `detailsCard`, right after the `TextField` for the name, insert:

```tsx
        <ListRow
          title={t('common.appearance')}
          leading={<IconBox name={icon} colour={iconColour} />}
          onPress={() => setAppearanceOpen(true)}
          chevron
        />
```

Render the sheet once, as the last child of the form's fragment (next to where `detailsCard()` is rendered for the edit page and the wizard — put it outside `detailsCard` so the sheet is not duplicated):

```tsx
      <AppearanceSheet
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        colorIndex={firstCategory?.colorIndex ?? 9}
        icon={icon}
        groups={categoryIconGroups}
        searchable
        colours={false}
        onChange={({ icon: next }) => set({ icon: next })}
      />
```

Check `ListRow` accepts `title`, `leading`, `onPress`, `chevron` exactly as `AccountForm.tsx:193` uses them, and that a `ListRow` inside a padded `Card` matches how the account form nests it (it wraps rows in `<Card padded={false}>` with a 4-pt vertical padding); if the row looks cramped inside the padded card, wrap it the same way.

- [x] **Step 6: Run the checks**

Run: `pnpm --filter mobile test -- budgets && pnpm typecheck`
Expected: PASS. `useBudgetProgress.test.ts` and `budgetAlerts.test.ts` build `Budget` objects directly and need no change.

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/features/budgets apps/mobile/app/budget
git commit -m "feat(mobile): a budget can pick its own icon"
```

---

### Task 8: Verify on the device and close out

- [ ] **Step 1: Gates** (use `rtk proxy`, see AGENTS.md "Reading the results")

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines and no trailing `× Some errors were emitted`; typecheck and tests green.

- [ ] **Step 2: Look at it on the simulator**

Restart Metro with `--clear`. Open, in this order: new account → Aspetto (24 swatches wrap without overflow, the new finance icons show, the selected swatch has its ring); new category → Aspetto (groups Animali e natura, Acquisti, Tecnologia, Denaro appear; the search finds `dog`); edit an old category whose colour was 4 (still teal); new budget → last step → Aspetto (no swatches, icon changes on the row and on Home). Check dark and light. Any icon that looks broken is a markup problem: fix it in `icons.ts` and say which in the commit message.

- [ ] **Step 3: Sync round trip**

Create an account with colour index 20 on a phone and confirm the server accepts the push (no 4xx in the server log): the server validates rows with the same `entitySchemas`, so this proves the bound moved on both sides. Do **not** touch `SYNC_SCHEMA_VERSION`.

- [ ] **Step 4: Request code review and merge**

Use **requesting-code-review**, then merge `feat/more-colors-icons` to `main` and update the roadmap README with a line for this work.
