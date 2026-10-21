# Web redesign R2 — the centred dialog and the edit form from a row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every detail and every form of the web app opens in one dialog in the centre of the screen (a sheet at the bottom below 760px), and a transaction row opens «Edit transaction» at once.

**Architecture:** `Panel` (`apps/web/src/ui/Panel.tsx`) is the one dialog of the app. Its CSS changes from a trailing panel to a centred dialog, and its `sheet` prop becomes `form`, which only sets the width. On Transactions the read-only detail goes: `?t={id}` opens the edit form, the form's foot gets «Delete», and the arrows move the focus along the rows.

**Tech Stack:** Next.js (App Router), CSS Modules with the `@saldo/ui` token variables, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-web-pages-redesign.html`, decisions W1–W4 and section 02 «The dialog».

**Branch:** `redesign/web`. R1 is done on it.

---

## Decisions this plan takes where the spec leaves a choice

- **The edit form still comes with a navigation.** The form needs the row's own balances, which only the server has. A row click loads `?t={id}`, and the dialog plays its entrance when the page arrives. The new form stays in place, as before.
- **«Delete» asks no question.** The spec says Delete removes the row and shows a toast with «Undo». The confirmation dialog goes, also for an occurrence of a recurrence: «Undo» brings it back.
- **After Save and after «Undo», the page shows the list with no dialog.** Before, they opened the row's detail, which no longer exists.
- **↑ ↓ move the focus, not the URL.** With no detail, a selection that opens on each arrow would load a form for each key. The arrows move the focus along the rows, and ↵ follows the focused row's link. `E` goes: the row is the edit form. R3 adds `N` and `/` (W5).
- **W4 needs no code.** On Accounts, «Edit» already changes the same dialog into the form (a navigation that the dialog follows with no entrance). Task 6 adds an e2e check for it. Profile and Admin get their details in R6.

## File structure

| File | Change |
|---|---|
| `packages/ui/src/tokens.ts` | `panelWidth` goes; `dialogDetailWidth: 440` and `dialogFormWidth: 480` come. |
| `apps/web/src/ui/Panel.tsx`, `Panel.module.css` | The centred dialog (W1), the sheet below 760px (W2), the motion of section 02. Prop `sheet` → `form`. |
| `apps/web/src/ui/PanelSwitch.tsx` and 8 pages | `sheet` → `form`. |
| `apps/web/src/features/transactions/panelState.ts` (+ test) | `?t={id}` is the edit form; the `detail` kind goes. |
| `apps/web/src/ui/ListKeys.tsx`, `PanelNav.tsx` | The arrows move the focus along `[data-select-id]` rows. |
| `apps/web/app/(app)/transactions/TransactionsPanels.tsx` | Only the new form and the edit form. |
| `apps/web/app/(app)/transactions/page.tsx` | The detail goes; the edit form gets «Delete»; Save and «Undo» land on the list. |
| `apps/web/app/(app)/transactions/TransactionForm.tsx`, `.module.css` | A `deleteControl` slot on the left of the foot. |
| `apps/web/app/(app)/transactions/DeleteTransaction.tsx` | Deletes at once, no question. |
| `apps/web/app/(app)/transactions/transactions.module.css` | The detail's rules go. |
| `apps/web/e2e/support/txPage.ts`, `transactions.spec.ts`, `accounts-goals.spec.ts` | The tests follow W1–W4. |
| `docs/superpowers/plans/README.md` | R2 ticked. |

---

### Task 1: The dialog tokens and the centred dialog (W1, W2)

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `panelWidth` line, about line 300)
- Modify: `apps/web/src/ui/Panel.tsx`
- Replace: `apps/web/src/ui/Panel.module.css`
- Modify: `apps/web/src/ui/PanelSwitch.tsx`
- Modify: `apps/web/app/(app)/admin/settings/page.tsx`, `admin/accounts/page.tsx`, `admin/invites/page.tsx`, `profile/goals/page.tsx`, `profile/tags/page.tsx`, `profile/budgets/page.tsx`, `profile/categories/page.tsx`, `accounts/page.tsx`, `transactions/TransactionsPanels.tsx`

No unit test: this is CSS and a prop name. Task 6 checks the geometry with Playwright.

- [x] **Step 1: Replace the panel width token**

In `packages/ui/src/tokens.ts`, replace:

```ts
  /** Web: the trailing panel where details and forms open (Transazioni, Conti, Profilo, Admin). */
  panelWidth: 420,
```

with:

```ts
  /** Web (W1, 2026-10-21): the centred dialog where a detail opens. */
  dialogDetailWidth: 440,
  /** Web (W1): the centred dialog where a form opens. */
  dialogFormWidth: 480,
```

Run: `rtk grep -rn "panelWidth\|panel-width" packages apps --exclude-dir=node_modules`
Expected: only `apps/web/src/ui/Panel.module.css`, which Step 3 replaces.

- [x] **Step 2: Rename `sheet` to `form` in `Panel.tsx`**

In `apps/web/src/ui/Panel.tsx`:

Replace:

```tsx
  /** Below the breakpoint, a bottom sheet over a scrim instead of the whole screen: the form's shape. */
  sheet?: boolean;
```

with:

```tsx
  /** A form: 480px wide on a wide screen, where a detail is 440px (W1). */
  form?: boolean;
```

Replace the first paragraph of the comment above `export function Panel`:

```tsx
 * §17.1.7: the trailing panel of Transazioni, Conti and Profilo — a 420px dialog over the page, with a
 * scrim, on a wide screen (D3, 2026-10-11); the whole screen, or a bottom sheet for a form, on a narrow one. Rendered only when something is selected, so it mounts —
 * and slides in — when the panel opens, and stays put while the selection moves between rows. A page
 * may instead keep the panel mounted and hidden in `<Activity>`: it then slides in each time it shows.
```

with:

```tsx
 * W1, W2 (2026-10-21): the one dialog of the web app — in the centre of the screen over a scrim,
 * 440px for a detail and 480px for a form; a sheet at the bottom of the screen below 760px.
 * Rendered only when something is open, so it mounts — and plays its entrance — when it opens, and
 * stays put while the selection moves between rows. A page may instead keep the panel mounted and
 * hidden in `<Activity>`: it then plays its entrance each time it shows.
```

In the parameter list, replace `  sheet = false,` with `  form = false,`.

Replace:

```tsx
        data-sheet={sheet ? '' : undefined}
      >
        {sheet ? <span className={styles.handle} aria-hidden="true" /> : null}
```

with:

```tsx
        data-form={form ? '' : undefined}
      >
        {/* Below 760px every dialog is a sheet (W2); the CSS hides the handle on a wide screen. */}
        <span className={styles.handle} aria-hidden="true" />
```

- [x] **Step 3: Replace `Panel.module.css`**

Replace the whole of `apps/web/src/ui/Panel.module.css` with:

```css
/**
 * W1, W2 (2026-10-21): a detail or a form opens in a dialog in the centre of the screen, over a
 * scrim — 440px for a detail, 480px for a form. Below 760px the dialog is a sheet at the bottom of
 * the screen. The page does not move. Dialog and scrim arrive and leave together.
 */
.panel {
  position: fixed;
  inset: auto 0 0;
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-block-size: 92dvh;
  padding: 8px var(--layout-screen-padding-x) calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--color-surface);
  animation: sheet-in 260ms cubic-bezier(0.23, 1, 0.32, 1);
  transition-property: opacity, translate, scale;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}

/* The sheet leaves the way it came: down. */
.panel[data-closing] {
  translate: 0 100%;
}

@keyframes sheet-in {
  from {
    translate: 0 100%;
  }
}

.handle {
  flex: none;
  inline-size: var(--layout-sheet-handle-width);
  block-size: var(--layout-sheet-handle-height);
  margin: 0 auto;
  border-radius: var(--radius-pill);
  background: var(--color-border-strong);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  min-width: 0;
  overflow-wrap: anywhere;
}

.close {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: var(--layout-header-button);
  block-size: var(--layout-header-button);
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
}

.close:hover {
  background: var(--color-raised);
  color: var(--color-text);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 4px;
}

/* Focus lands here; the heading is not a control, so it draws no ring. */
.title:focus {
  outline: none;
}

/* A panel whose body opens with its own heading: the ✕ alone on the head, no rule under it. */
.bare {
  justify-content: flex-end;
  padding-bottom: 0;
  border-bottom: 0;
}

.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.scrim {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: var(--color-scrim);
  animation: scrim-in 200ms cubic-bezier(0.23, 1, 0.32, 1);
  transition: opacity 150ms cubic-bezier(0.23, 1, 0.32, 1);
}

.scrim[data-closing] {
  opacity: 0;
  pointer-events: none;
}

@keyframes scrim-in {
  from {
    opacity: 0;
  }
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .panel {
    inset: 0;
    inline-size: min(var(--layout-dialog-detail-width), calc(100vw - 32px));
    block-size: fit-content;
    max-block-size: calc(100dvh - 64px);
    margin: auto;
    gap: 0;
    padding: 0;
    overflow: hidden;
    border-radius: var(--radius-dialog);
    box-shadow:
      0 0 0 1px var(--color-border-strong) inset,
      0 1px 2px var(--color-shadow),
      0 12px 32px color-mix(in srgb, var(--color-shadow) 60%, transparent);
    animation: dialog-in 200ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .panel[data-form] {
    inline-size: min(var(--layout-dialog-form-width), calc(100vw - 32px));
  }

  /* The dialog leaves in place: it fades and shrinks a little. */
  .panel[data-closing] {
    opacity: 0;
    translate: none;
    scale: 0.96;
  }

  .handle {
    display: none;
  }

  .head {
    padding: 12px 12px 12px 22px;
  }

  .bare {
    padding-bottom: 12px;
  }

  .title {
    font-size: var(--font-size-headline);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--tracking-tight);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    gap: 24px;
    padding: 8px 22px 22px;
  }
}

@keyframes dialog-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
}

/* Section 02: with reduced motion, opacity only. */
@media (prefers-reduced-motion: reduce) {
  .panel {
    animation-name: panel-fade;
    transition-property: opacity;
  }

  .panel[data-closing] {
    opacity: 0;
    translate: none;
    scale: none;
  }
}

@keyframes panel-fade {
  from {
    opacity: 0;
  }
}

/* Opened from the keyboard: there on the next frame. Latched each time the panel shows. */
.panel[data-still],
.scrim[data-still] {
  animation: none;
}

/* Closed from the keyboard: gone on the next frame. */
.panel[data-instant],
.scrim[data-instant] {
  transition: none;
}
```

- [x] **Step 4: Rename `sheet` to `form` in `PanelSwitch`**

In `apps/web/src/ui/PanelSwitch.tsx`, replace:

```tsx
  /** Below the breakpoint, a bottom sheet (a form) and not the whole screen. */
  sheet?: boolean;
```

with:

```tsx
  /** A form: the wider dialog (W1). */
  form?: boolean;
```

Replace:

```tsx
        key={spec.sheet === true ? 'form' : 'detail'}
        title={spec.title}
        sheet={spec.sheet}
```

with:

```tsx
        key={spec.form === true ? 'form' : 'detail'}
        title={spec.title}
        form={spec.form}
```

- [x] **Step 5: Rename the prop in the pages**

Run from `apps/web`:

```bash
sed -i '' 's/sheet: true,/form: true,/' \
  "app/(app)/admin/settings/page.tsx" "app/(app)/admin/accounts/page.tsx" \
  "app/(app)/admin/invites/page.tsx" "app/(app)/profile/goals/page.tsx" \
  "app/(app)/profile/tags/page.tsx" "app/(app)/profile/budgets/page.tsx" \
  "app/(app)/profile/categories/page.tsx" "app/(app)/accounts/page.tsx"
```

In `apps/web/app/(app)/transactions/TransactionsPanels.tsx`, replace the two lines that hold only `sheet` (inside the two `<Panel` elements) with `form`. Task 4 rewrites this file; this step only keeps it compiling.

Run: `rtk grep -rn "sheet: true\|spec.sheet\|data-sheet" apps/web/app apps/web/src`
Expected: no match.

- [x] **Step 6: Typecheck and test**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS. `cssTokens.test.ts` passes: the new CSS has no typed colour, radius or font size.

- [x] **Step 7: Look at the dialog**

Run: `rtk proxy pnpm --filter web dev`. Open `/accounts`, click an account, then «Edit». Do it at 1440px and at 390px, in the light and the dark theme.
Expected: at 1440px the detail is 440px wide in the centre of the screen and the form 480px; at 390px both are sheets at the bottom, with the handle. Esc, ✕ and a click on the scrim close it.

- [x] **Step 8: Commit**

```bash
rtk git add packages/ui/src/tokens.ts apps/web/src/ui/Panel.tsx apps/web/src/ui/Panel.module.css apps/web/src/ui/PanelSwitch.tsx "apps/web/app/(app)"
rtk git commit -m "feat(web): details and forms open in a centred dialog, a sheet below 760px (W1, W2)"
```

---

### Task 2: `?t={id}` opens the edit form (W3, the URL)

**Files:**
- Modify: `apps/web/src/features/transactions/panelState.ts`
- Test: `apps/web/src/features/transactions/panelState.test.ts`

- [x] **Step 1: Change the tests first**

Replace the whole of `apps/web/src/features/transactions/panelState.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { panelFromSearch, panelHref, panelOnlyChange, samePanel } from './panelState';

const search = (query: string) => new URLSearchParams(query);
const at = (query: string) => ({ pathname: '/transactions', search: search(query) });

describe('panelFromSearch', () => {
  it('reads the panel: `?new` first, then the row, which opens its edit form (W3)', () => {
    expect(panelFromSearch(search(''))).toEqual({ kind: 'none' });
    expect(panelFromSearch(search('new&t=a'))).toEqual({ kind: 'new' });
    expect(panelFromSearch(search('t=a'))).toEqual({ kind: 'edit', id: 'a' });
    expect(panelFromSearch(search('t='))).toEqual({ kind: 'none' });
  });

  // A link from before W3 carries `&edit`: it opens the same form.
  it('reads an old `&edit` link as the same form', () => {
    expect(panelFromSearch(search('t=a&edit'))).toEqual({ kind: 'edit', id: 'a' });
  });
});

describe('panelOnlyChange', () => {
  it('opens and closes a panel over the same list', () => {
    expect(panelOnlyChange(at('direction=expense'), '/transactions?direction=expense&t=a')).toEqual(
      { kind: 'edit', id: 'a' },
    );
    expect(panelOnlyChange(at('direction=expense&t=a'), '/transactions?direction=expense')).toEqual(
      { kind: 'none' },
    );
    expect(panelOnlyChange(at('t=a'), '/transactions?new=')).toEqual({ kind: 'new' });
  });

  it('ignores the order of the parameters', () => {
    expect(panelOnlyChange(at('p=2026-09&q=bar'), '/transactions?q=bar&p=2026-09&t=a')).toEqual({
      kind: 'edit',
      id: 'a',
    });
  });

  it('is a navigation for another filter, another period or another page', () => {
    expect(panelOnlyChange(at('direction=expense'), '/transactions?t=a')).toBeNull();
    expect(panelOnlyChange(at('p=2026-09'), '/transactions?p=2026-10&t=a')).toBeNull();
    expect(panelOnlyChange(at(''), '/accounts?a=x')).toBeNull();
  });

  // A toast and a prefilled form belong to the page the server rendered: leaving them is a navigation.
  it('is a navigation while a delete toast or a prefill is in the URL', () => {
    expect(panelOnlyChange(at('deleted=a'), '/transactions?t=b')).toBeNull();
    expect(panelOnlyChange(at('new=&from=x'), '/transactions')).toBeNull();
  });
});

describe('panelOnlyChange, links that leave the page', () => {
  it('is a navigation for another origin', () => {
    expect(panelOnlyChange(at(''), 'https://evil.example/transactions?t=x')).toBeNull();
    expect(panelOnlyChange(at(''), '//evil.example/transactions?t=x')).toBeNull();
  });

  it('is a navigation for a link with a fragment', () => {
    expect(panelOnlyChange(at(''), '/transactions?t=x#top')).toBeNull();
  });
});

describe('panelHref', () => {
  it('replaces the panel that the base already has, an old `edit` included', () => {
    expect(panelHref('/transactions?t=old&edit=&q=1', { kind: 'edit', id: 'a' })).toBe(
      '/transactions?q=1&t=a',
    );
    expect(panelHref('/transactions?new=&q=1', { kind: 'none' })).toBe('/transactions?q=1');
  });

  it('adds the panel after the list parameters', () => {
    expect(panelHref('/transactions?direction=expense', { kind: 'edit', id: 'a' })).toBe(
      '/transactions?direction=expense&t=a',
    );
    expect(panelHref('/transactions', { kind: 'new' })).toBe('/transactions?new=');
    expect(panelHref('/transactions', { kind: 'none' })).toBe('/transactions');
  });
});

describe('samePanel', () => {
  it('compares the kind and the row', () => {
    expect(samePanel({ kind: 'edit', id: 'a' }, { kind: 'edit', id: 'a' })).toBe(true);
    expect(samePanel({ kind: 'edit', id: 'a' }, { kind: 'edit', id: 'b' })).toBe(false);
    expect(samePanel({ kind: 'new' }, { kind: 'none' })).toBe(false);
    expect(samePanel({ kind: 'none' }, { kind: 'none' })).toBe(true);
  });
});
```

- [x] **Step 2: Run the test to see it fail**

Run: `rtk proxy pnpm --filter web exec vitest run src/features/transactions/panelState.test.ts`
Expected: FAIL. `panelFromSearch(search('t=a'))` gives `{ kind: 'detail', id: 'a' }`.

- [x] **Step 3: Change `panelState.ts`**

In `apps/web/src/features/transactions/panelState.ts`, replace:

```ts
/** `?new` opens «Nuova transazione»; `?t={id}&edit` turns the detail into the form (decision 8). */
export const NEW_PARAM = 'new';
export const EDIT_PARAM = 'edit';
```

with:

```ts
/** `?new` opens «Nuova transazione»; `?t={id}` opens «Modifica transazione» on that row (W3). */
export const NEW_PARAM = 'new';
/** Before W3, `?t={id}&edit` turned the detail into the form. An old link still carries it; it changes nothing. */
const EDIT_PARAM = 'edit';
```

Replace:

```ts
export type PanelState =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; id: string };

/** What a URL opens, with the precedence the page always had: `?new`, then `?t=…&edit`, then `?t=`. */
export function panelFromSearch(search: URLSearchParams): PanelState {
  if (search.has(NEW_PARAM)) return { kind: 'new' };
  const id = search.get(SELECTION_PARAM);
  if (id === null || id === '') return { kind: 'none' };
  return search.has(EDIT_PARAM) ? { kind: 'edit', id } : { kind: 'detail', id };
}
```

with:

```ts
export type PanelState = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; id: string };

/** What a URL opens: `?new` first, then the row's edit form. A row has no read-only detail (W3). */
export function panelFromSearch(search: URLSearchParams): PanelState {
  if (search.has(NEW_PARAM)) return { kind: 'new' };
  const id = search.get(SELECTION_PARAM);
  if (id === null || id === '') return { kind: 'none' };
  return { kind: 'edit', id };
}
```

Replace:

```ts
  if (panel.kind === 'detail' || panel.kind === 'edit') {
    url.searchParams.set(SELECTION_PARAM, panel.id);
  }
  if (panel.kind === 'edit') url.searchParams.set(EDIT_PARAM, '');
```

with:

```ts
  if (panel.kind === 'edit') url.searchParams.set(SELECTION_PARAM, panel.id);
```

- [x] **Step 4: Run the test to see it pass**

Run: `rtk proxy pnpm --filter web exec vitest run src/features/transactions/panelState.test.ts`
Expected: PASS.

The typecheck now fails in `TransactionsPanels.tsx` and `page.tsx`, which still name `detail` and `EDIT_PARAM`. Task 4 fixes them. Do not commit yet: commit Tasks 2, 3 and 4 together at the end of Task 4, so every commit compiles.

---

### Task 3: The arrows move the focus along the rows

**Files:**
- Replace: `apps/web/src/ui/ListKeys.tsx`
- Modify: `apps/web/src/ui/PanelNav.tsx`

No unit test: Task 6 covers the keys with Playwright.

- [x] **Step 1: Mark each row link**

In `apps/web/src/ui/PanelNav.tsx`, in `PanelLink`, replace:

```tsx
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
```

with:

```tsx
      aria-current={selected ? 'true' : undefined}
      // The arrows of Transazioni walk the rows through this (`ListKeys`).
      data-select-id={selectId}
      onClick={onClick}
```

- [x] **Step 2: Replace `ListKeys.tsx`**

Replace the whole of `apps/web/src/ui/ListKeys.tsx` with:

```tsx
'use client';

import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';

/** The rows the arrows walk: every row link of the list, in the order of the page. */
const ROWS = '#content [data-select-id]';

/**
 * Transazioni's arrows (W3): ↑ ↓ move the focus through the rows that are on screen; ↵ opens the
 * focused row, which is a link to its edit form. A row inside a closed disclosure has no box, so it
 * is not in the walk. At either end an arrow does nothing; with no row focused, ↓ takes the first
 * row and ↑ the last.
 */
export function ListKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (key !== 'ArrowDown' && key !== 'ArrowUp') return;
      if (event.shiftKey || ignoresShortcut(event)) return;
      const rows = [...document.querySelectorAll<HTMLElement>(ROWS)].filter(
        (row) => row.getClientRects().length > 0,
      );
      if (rows.length === 0) return;
      const index = rows.findIndex((row) => row === document.activeElement);
      const next =
        index === -1
          ? key === 'ArrowDown'
            ? rows[0]
            : rows[rows.length - 1]
          : rows[key === 'ArrowDown' ? index + 1 : index - 1];
      if (next === undefined) return;
      event.preventDefault();
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return null;
}
```

Do not commit yet (see Task 2 Step 4).

---

### Task 4: Transactions — the row opens the form, «Delete» in its foot (W3)

**Files:**
- Replace: `apps/web/app/(app)/transactions/TransactionsPanels.tsx`
- Replace: `apps/web/app/(app)/transactions/DeleteTransaction.tsx`
- Modify: `apps/web/app/(app)/transactions/TransactionForm.tsx`
- Modify: `apps/web/app/(app)/transactions/TransactionForm.module.css`
- Modify: `apps/web/app/(app)/transactions/page.tsx`
- Modify: `apps/web/app/(app)/transactions/transactions.module.css`

- [x] **Step 1: Replace `TransactionsPanels.tsx`**

Replace the whole of `apps/web/app/(app)/transactions/TransactionsPanels.tsx` with:

```tsx
'use client';

import { Activity, Fragment, type ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  type PanelState,
  panelFromSearch,
  panelHref,
  panelOnlyChange,
  samePanel,
} from '../../../src/features/transactions/panelState';
import { ListKeys } from '../../../src/ui/ListKeys';
import { NEW_TRANSACTION_EVENT, wantsInstant } from '../../../src/ui/NewTransactionLink';
import { type CloseFrom, Panel } from '../../../src/ui/Panel';
import { type PanelNav, PanelNavContext } from '../../../src/ui/PanelNav';
import { usePanelController } from '../../../src/ui/usePanelController';
import styles from './transactions.module.css';

const NONE: PanelState = { kind: 'none' };

interface Props {
  /** The list: the period, the search, the filters and the days. */
  children: ReactNode;
  /** The list's URL with no panel: its filters and its period. */
  baseHref: string;
  newTitle: string;
  editTitle: string;
  closeLabel: string;
  /**
   * «Nuova transazione», rendered once by the server. It waits hidden in `<Activity>`, and a new
   * draft takes its place in the background each time it leaves the screen.
   */
  newForm: ReactNode;
  /**
   * «Modifica transazione», only on a page loaded with `?t=…`: the form needs the row's own
   * balances, so a row opens it with a navigation (W3).
   */
  edit: { id: string; form: ReactNode } | null;
}

/** `next` takes the place of `previous`: a new form that leaves is spent, and the next one is a new draft. */
function spendsDraft(previous: PanelState, next: PanelState): boolean {
  return previous.kind === 'new' && next.kind !== 'new';
}

/**
 * The dialog of Transazioni (W1, W3), in client state (`usePanelController`). The new form is on
 * the page from the start; the edit form comes with the page that `?t=…` loads.
 */
export function TransactionsPanels(props: Props) {
  const { baseHref, edit, newForm } = props;
  const { view, viewRef, go, side } = usePanelController<PanelState>({
    parse: panelFromSearch,
    same: samePanel,
    isNone: (state) => state.kind === 'none',
    none: NONE,
    onlyChange: (current, href) => {
      const next = panelOnlyChange(current, href);
      // The edit form is not on the page until the server renders it: that one stays a navigation.
      return next === null || next.kind === 'edit' ? null : { state: next };
    },
    spends: spendsDraft,
  });

  // The top bar's button, the FAB and N: on this page they open the form here.
  useEffect(() => {
    const onNew = (event: Event) => {
      // No form to show here (the URL holds a deletion notice or a prefill): the link navigates.
      if (newForm === null) return;
      const current = viewRef.current;
      // Already open: N must not replace it, nor its prefill, with a navigation.
      if (current.panel.kind === 'new' && !current.closing) {
        event.preventDefault();
        return;
      }
      const href = panelHref(baseHref, { kind: 'new' });
      if (go(href, { instant: wantsInstant(event) })) event.preventDefault();
    };
    window.addEventListener(NEW_TRANSACTION_EVENT, onNew);
    return () => window.removeEventListener(NEW_TRANSACTION_EVENT, onNew);
  }, [go, viewRef, baseHref, newForm]);

  const { panel } = view;
  // The row whose form is on screen: none while the exit plays.
  const panelId = panel.kind === 'edit' ? panel.id : null;
  const selectedId = view.closing ? null : panelId;
  const nav = useMemo<PanelNav>(() => ({ selectedId, go }), [selectedId, go]);
  const editing = panelId !== null && edit?.id === panelId ? edit : null;

  // Stable across renders: `Panel` subscribes Esc through it. Esc closes with no motion; the ✕
  // and the scrim play the exit.
  const closeToList = useCallback(
    (from: CloseFrom) => go(baseHref, { instant: from === 'key' }),
    [go, baseHref],
  );

  // Decision 9: the new form waits hidden, so «Nuova» only shows it. `<Activity>` renders it in the
  // background, keeps it out of the layout with `display: none`, and runs its effects (Esc, the
  // focus) only while it shows. Shown again, the panel plays its entrance from the start.
  const creating = panel.kind === 'new';
  const newPanel =
    newForm === null ? null : (
      <Activity mode={creating ? 'visible' : 'hidden'}>
        <Panel
          form
          bare
          title={props.newTitle}
          closeHref={baseHref}
          closeLabel={props.closeLabel}
          onClose={closeToList}
          closing={creating && view.closing}
          instant={view.instant}
        >
          {/* The new form's key changes when the form leaves the screen, so the next opening is a
              new draft, which React renders hidden in the background meanwhile. */}
          <Fragment key={view.epoch}>{newForm}</Fragment>
        </Panel>
      </Activity>
    );

  // W3: the row opens the form at once. The form comes with a navigation, which the controller
  // follows with no motion; the dialog still plays its entrance, and only Esc closes it with none.
  const editPanel =
    editing === null ? null : (
      <Panel
        key="form"
        form
        bare
        title={props.editTitle}
        closeHref={baseHref}
        closeLabel={props.closeLabel}
        onClose={closeToList}
        closing={view.closing}
        instant={view.closing && view.instant}
      >
        {editing.form}
      </Panel>
    );

  const formOpen = creating || editing !== null;
  return (
    <PanelNavContext value={nav}>
      <div className={styles.layout}>
        <div className={styles.list}>{props.children}</div>
        <div className={styles.side} ref={side}>
          {newPanel}
          {editPanel}
        </div>
      </div>
      {/* ↑ ↓ belong to the list; while a form is open the keys are the form's. */}
      {formOpen ? null : <ListKeys />}
    </PanelNavContext>
  );
}
```

- [x] **Step 2: Replace `DeleteTransaction.tsx`**

Replace the whole of `apps/web/app/(app)/transactions/DeleteTransaction.tsx` with:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { WriteError } from '../../../src/server/write/transactions';
import { actionApplied } from '../../../src/ui/actionApplied';
import { Icon } from '../../../src/ui/Icon';
import { deleteTransactionAction } from './actions';
import styles from './TransactionForm.module.css';

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** Where the page goes once the row is a tombstone: the list without `t`, plus `deleted={id}`. */
  deletedHref: string;
  strings: {
    /** «Elimina». */
    action: string;
    busy: string;
    /** `web.form.error_<error>`, resolved by the page for every error the action can return, and a throw. */
    errors: Record<WriteError | 'unexpected', string>;
  };
}

/**
 * «Elimina» on the left of the edit form's foot (W3). It deletes at once: the page moves to
 * `?deleted={id}`, which closes the dialog and shows the toast with «Annulla» for 5 seconds.
 * A refusal stays in the form and says why.
 */
export function DeleteTransaction({ id, updatedAt, deletedHref, strings }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteTransactionAction>>;
      try {
        result = await deleteTransactionAction(id, updatedAt);
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        await actionApplied();
        // `replace`: Back must not open the form of a row that is gone.
        router.replace(deletedHref);
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  return (
    <div className={styles.deleteSlot}>
      <button
        type="button"
        className={styles.delete}
        onClick={remove}
        disabled={pending}
        aria-busy={pending}
      >
        <Icon name="trash" size={14} />
        {pending ? strings.busy : strings.action}
      </button>
      {error === null ? null : (
        <span className={styles.deleteError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
```

- [x] **Step 3: Give the form a slot for «Delete»**

In `apps/web/app/(app)/transactions/TransactionForm.tsx`:

Add `type ReactNode,` to the `react` import, after `type KeyboardEvent,`.

In `interface Props`, replace:

```tsx
  closeHref: string;
  /** `/transactions?…&t=__ID__`: where a save lands. */
  afterSave: string;
}
```

with:

```tsx
  closeHref: string;
  /** Where a save lands. `__ID__`, if there, becomes the saved row's id. */
  afterSave: string;
  /** The edit form's «Elimina» (W3): on the left of the foot, where the new form shows its key hint. */
  deleteControl?: ReactNode;
}
```

In the parameter list of `TransactionForm`, after `  afterSave,` add `  deleteControl,`.

Replace:

```tsx
        <span className={styles.hint}>{t('web.form.keyboardHint')}</span>
```

with:

```tsx
        {deleteControl ?? <span className={styles.hint}>{t('web.form.keyboardHint')}</span>}
```

In `apps/web/app/(app)/transactions/TransactionForm.module.css`, after the `.cancel { … }` rule, add:

```css
/* W3: «Elimina» leads the edit form's foot, in the accent ink. */
.deleteSlot {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-inline-end: auto;
}

.delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 12px;
  border-radius: var(--radius-button);
  color: var(--color-accent);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: background-color var(--motion-press) var(--motion-easing);
}

.delete:hover {
  background: var(--color-raised);
}

.deleteError {
  font-size: var(--font-size-caption);
  color: var(--color-accent);
}
```

- [x] **Step 4: Remove the detail from `page.tsx`**

In `apps/web/app/(app)/transactions/page.tsx`:

1. In the `panelState` import, remove `EDIT_PARAM,`.
2. In the `detailView` import, keep only `detailView` (remove `type DetailFactKind,` and `type DetailView,`).
3. Replace `import { type DetailPanel, TransactionsPanels } from './TransactionsPanels';` with `import { TransactionsPanels } from './TransactionsPanels';`.
4. Delete the `MISSING` constant and the `FACT_LABELS` constant, with their comments.
5. Replace:

```tsx
  // `new URLSearchParams({ edit: '' })` writes `edit=`: presence is what counts, so `?edit` works too.
  const editForm =
    selectedId !== undefined && params[EDIT_PARAM] !== undefined
      ? formView({ data: page.data, today, currency, mode: 'edit', id: selectedId })
      : null;
```

with:

```tsx
  // W3: `?t={id}` is the row's edit form. `?new` wins, as `panelFromSearch` reads it.
  const editForm =
    selectedId !== undefined && !creating
      ? formView({ data: page.data, today, currency, mode: 'edit', id: selectedId })
      : null;
```

6. Delete the `recurringIds` constant and its comment (`// Decision 10: …`).
7. Delete the `fact` function, the `noteText` function and the `detailBody` function, with their comments.
8. Delete the block from `// Every row of the list, and the one the URL selected …` to the end of the `for (const id of detailIds) { … }` loop.
9. Replace:

```tsx
  // A closing expense ends on Conti, where the goal has just left the list.
  const afterSave = (form: { closeGoalId: string | null }) =>
    form.closeGoalId === null ? href({ [SELECTION_PARAM]: '__ID__' }) : '/accounts';
```

with:

```tsx
  // Save closes the dialog: the list (W3). A closing expense ends on Conti, where the goal has just
  // left the list.
  const afterSave = (form: { closeGoalId: string | null }) =>
    form.closeGoalId === null ? href() : '/accounts';
```

10. Replace the `edit={…}` prop of `<TransactionsPanels>`, and the three props after it, with:

```tsx
        edit={
          editForm === null || editForm.id === null
            ? null
            : {
                id: editForm.id,
                form: (
                  <TransactionForm
                    key={`edit:${editForm.id}`}
                    view={editForm}
                    {...formProps}
                    closeHref={href()}
                    afterSave={afterSave(editForm)}
                    deleteControl={
                      editForm.updatedAt === null ? undefined : (
                        <DeleteTransaction
                          id={editForm.id}
                          updatedAt={editForm.updatedAt}
                          deletedHref={href({ [DELETED_PARAM]: editForm.id })}
                          strings={{
                            action: t('common.delete'),
                            busy: t('common.loading'),
                            errors: writeErrors,
                          }}
                        />
                      )
                    }
                  />
                ),
              }
        }
      >
```

The old props `details`, `upcomingIds`, `ids` and `upcomingDisclosureId` go.

11. In the «In arrivo» card (`<div className={styles.cardRows}>`), delete the line `selectId={row.id}` from its `ListRow`. The arrows walk the list, not the card.
12. In `<UndoToast>`, replace `restoredHref={href({ [SELECTION_PARAM]: deletedId })}` with `restoredHref={href()}`.

In `apps/web/app/(app)/transactions/UndoToast.tsx`, replace the comment of `restoredHref`:

```tsx
  /** Where «Annulla» lands once the row is back: the list with `t={id}`, so it is selected again. */
```

with:

```tsx
  /** Where «Annulla» lands once the row is back: the list, with the row in it again. */
```

- [x] **Step 5: Remove the detail's CSS**

In `apps/web/app/(app)/transactions/transactions.module.css`, delete the rules `.facts`, `.fact`, `.fact:first-child`, `.factLabel`, `.factValue`, `.factLink`, `.actions`, `.action`, `.action:active`, `.kbd`, `.spacer` and `.danger`, with their comments.

Run: `rtk grep -rn "styles\.\(facts\|fact\|factLabel\|factValue\|factLink\|actions\|action\|kbd\|spacer\|danger\)\b" "apps/web/app/(app)/transactions"`
Expected: no match.

- [x] **Step 6: Lint, typecheck and test**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines. If Biome reports an unused import in `page.tsx` (for example `VisuallyHidden`, `formatLongDate`, `endLabel`, `cadenceLabel`), delete it and run lint again.

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS.

- [x] **Step 7: Commit Tasks 2, 3 and 4**

```bash
rtk git add apps/web/src/features/transactions/panelState.ts apps/web/src/features/transactions/panelState.test.ts apps/web/src/ui/ListKeys.tsx apps/web/src/ui/PanelNav.tsx "apps/web/app/(app)/transactions"
rtk git commit -m "feat(web): a transaction row opens its edit form, with Delete in the foot (W3)"
```

---

### Task 5: Look at Transactions in the browser

- [ ] **Step 1: Check the flow by hand**

Run: `rtk proxy pnpm --filter web dev`. Sign in with a seeded user and open `/transactions` at 1440px.

Expected:
- A click on a row opens «Edit transaction», 480px wide, in the centre, with its fields filled. The amount field does not have the focus.
- «Delete» is on the left of the foot, then «Cancel» and «Save».
- «Save» closes the dialog and the list shows the change.
- «Delete» closes the dialog and the toast shows «Deleted “…”» with «Undo». «Undo» puts the row back.
- ↓ and ↑ move the focus along the rows; ↵ opens the focused row.

Do it again at 390px: the form is a sheet at the bottom of the screen.

Fix any problem before Task 6, and commit the fix as `fix(web): …`.

---

### Task 6: e2e follows W1–W4

**Files:**
- Modify: `apps/web/e2e/support/txPage.ts`
- Modify: `apps/web/e2e/transactions.spec.ts`
- Modify: `apps/web/e2e/accounts-goals.spec.ts`

- [ ] **Step 1: `createExpense` reads the id from the new row**

In `apps/web/e2e/support/txPage.ts`, replace:

```ts
/** Fills «Nuova transazione» as an expense and saves it. Returns the id the page lands on. */
```

with:

```ts
/** Fills «Nuova transazione» as an expense and saves it. Returns the id of the new row. */
```

and replace:

```ts
  await form.getByRole('button', { name: t('txForm.create') }).click();
  await page.waitForURL(/[?&]t=/);
  const id = new URL(page.url()).searchParams.get('t');
  if (id === null) throw new Error('the saved transaction is not selected');
  return id;
```

with:

```ts
  await form.getByRole('button', { name: t('txForm.create') }).click();
  // Save closes the dialog and lands on the list (W3): the new row's link carries its id.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const href = await page
    .getByRole('link', { name: input.description })
    .first()
    .getAttribute('href');
  const id = href === null ? null : new URL(href, page.url()).searchParams.get('t');
  if (id === null) throw new Error('the saved transaction has no row');
  return id;
```

At the top of `txPage.ts`, replace:

```ts
import type { Locator, Page } from '@playwright/test';
```

with:

```ts
import { expect, type Locator, type Page } from '@playwright/test';
```

- [ ] **Step 2: The row test opens the form**

In `apps/web/e2e/transactions.spec.ts`, replace the whole test `'a row opens its detail in the panel, and the panel closes again'` with:

```ts
  test('a row opens its edit form in the dialog, and the dialog closes again', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Dettaglio',
      email: 'tx-detail@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const target = ledger.transactions.find((tx) => tx.description === 'Idraulico');
    if (target === undefined) throw new Error('the seed has no «Idraulico»');

    await page.goto(`/transactions?p=${target.date}`);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // W3: the row opens «Edit transaction» at once, with its fields filled.
    await page.getByRole('link', { name: 'Idraulico' }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]t=${target.id}`));
    const form = page.getByRole('dialog', { name: t('txForm.editTitle') });
    await expect(form).toBeVisible();
    await expect(form.getByLabel(t('txForm.descriptionExpense'))).toHaveValue('Idraulico');
    await expect(form.getByLabel(t('txForm.amount'))).not.toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await form.getByRole('link', { name: t('common.close') }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]t=/);

    // Esc closes it too.
    await page.getByRole('link', { name: 'Idraulico' }).click();
    await expect(form).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await member.context.close();
  });

  test('the dialog is in the centre of a wide screen and at the bottom of a narrow one', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Dialogo',
      email: 'tx-dialog@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const target = ledger.transactions.find((tx) => tx.description === 'Idraulico');
    if (target === undefined) throw new Error('the seed has no «Idraulico»');
    const form = page.getByRole('dialog', { name: t('txForm.editTitle') });
    const box = async () => {
      const value = await form.boundingBox();
      if (value === null) throw new Error('the dialog has no box');
      return value;
    };

    // W1: a form is 480px wide, in the centre of the screen. The poll waits for the entrance.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/transactions?t=${target.id}`);
    await expect(form).toBeVisible();
    await expect.poll(async () => Math.round((await box()).width)).toBe(480);
    const wide = await box();
    expect(Math.abs(wide.x + wide.width / 2 - 640)).toBeLessThanOrEqual(1);
    expect(Math.abs(wide.y + wide.height / 2 - 400)).toBeLessThanOrEqual(1);

    // W2: below 760px it is a sheet at the bottom of the screen, as wide as the screen.
    await page.setViewportSize({ width: 390, height: 800 });
    await expect
      .poll(async () => {
        const narrow = await box();
        return Math.round(narrow.y + narrow.height);
      })
      .toBe(800);
    expect(Math.round((await box()).width)).toBe(390);
    await member.context.close();
  });

  test('↑ ↓ walk the rows and ↵ opens the row with the focus', async ({ browser, t }) => {
    const member = await createMember(browser, t, {
      name: 'Tasti',
      email: 'tx-keys@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    // A closed month: no «In arrivo», so every row in the DOM is on screen.
    const month = previousMonth(monthOf(ledger.today));
    await page.goto(`/transactions?p=${month.start}`);
    const rows = page.locator('#content [data-select-id]');
    await expect(rows.nth(1)).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toBeFocused();

    const id = await rows.first().getAttribute('data-select-id');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`[?&]t=${id}`));
    await expect(page.getByRole('dialog', { name: t('txForm.editTitle') })).toBeVisible();
    await member.context.close();
  });
```

- [ ] **Step 3: Create, edit and delete**

In the test `'create an expense, edit it, delete it: the list and Home follow'`, replace everything from `    // Create.` to the line before `    await member.context.close();` with:

```ts
    // Create: Save closes the dialog, and the row is in the list.
    const id = await createExpense(page, t, {
      amount: '12,50',
      description: 'Pranzo di prova',
      category: t('seed.restaurants'),
    });
    const today = ledger.today;
    const day = sectionOf(page, dayHeading(today, today, t, appLocale(locale)));
    await expect(day.getByRole('link', { name: 'Pranzo di prova' })).toContainText(money(-1250));
    await expect(day.locator(':scope > div').first()).toContainText(money(1250));
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(1250));

    // Edit: `?t=` opens the form at once (W3); Save closes it.
    await page.goto(`/transactions?t=${id}`);
    const form = page.getByRole('dialog', { name: t('txForm.editTitle') });
    await form.getByLabel(t('txForm.amount')).fill('20');
    await form.getByLabel(t('txForm.descriptionExpense')).fill('Cena di prova');
    await form.getByRole('button', { name: t('txForm.save') }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Cena di prova' })).toContainText(money(-2000));
    await expect(page.getByRole('link', { name: 'Pranzo di prova' })).toHaveCount(0);
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(2000));

    // Delete: no question. The dialog closes and the toast offers «Undo».
    await page.goto(`/transactions?t=${id}`);
    await form.getByRole('button', { name: t('common.delete'), exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]deleted=${id}`));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The shell has its own status element (the navigation bar's «Loading…»): find the toast by its text.
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: t('transactions.deleted', { name: 'Cena di prova' }) }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cena di prova' })).toHaveCount(0);
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(0));
```

- [ ] **Step 4: «Undo»**

In the test `'«Annulla» brings a deleted transaction back'`, replace everything from `    await page.getByRole('button', { name: t('common.delete') }).click();` to the line before `    await page.goto('/home');` with:

```ts
    await page.getByRole('link', { name: 'Caffè di prova' }).click();
    await page
      .getByRole('dialog', { name: t('txForm.editTitle') })
      .getByRole('button', { name: t('common.delete'), exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`[?&]deleted=${id}`));
    await expect(page.getByRole('link', { name: 'Caffè di prova' })).toHaveCount(0);

    // The toast stays five seconds: «Undo» writes the row back into the list.
    await page.getByRole('button', { name: t('common.undo') }).click();
    await expect(page).not.toHaveURL(/[?&]deleted=/);
    await expect(page.getByRole('link', { name: 'Caffè di prova' })).toContainText(money(-800));
```

- [ ] **Step 5: The conflict test**

In the test `'saving a transaction that moved since it was opened shows the conflict'`:

Replace:

```ts
    await expect(first.getByRole('dialog', { name: 'Bolletta del primo' })).toBeVisible();
```

with:

```ts
    await expect(first.getByRole('link', { name: 'Bolletta del primo' })).toBeVisible();
```

Replace:

```ts
    await second.goto(`/transactions?t=${id}`);
    await expect(second.getByRole('dialog', { name: 'Bolletta del primo' })).toBeVisible();
```

with:

```ts
    await second.goto(`/transactions?t=${id}`);
    await expect(
      second
        .getByRole('dialog', { name: t('txForm.editTitle') })
        .getByLabel(t('txForm.descriptionExpense')),
    ).toHaveValue('Bolletta del primo');
```

The two `goto(…&edit)` lines stay: they check that an old `&edit` link still opens the form.

- [ ] **Step 6: W4 on Accounts**

In `apps/web/e2e/accounts-goals.spec.ts`, after:

```ts
  await expect(edit.getByLabel(t('accounts.name'), { exact: true })).toHaveValue('Risparmi');
```

add:

```ts
  // W4: «Edit» changes the same dialog into the form; a second dialog does not open.
  await expect(page.getByRole('dialog')).toHaveCount(1);
```

Replace the comment `// D3: the panel is a dialog over the page, so the list is out of reach until it is closed.` with `// W1: the dialog is over the page, so the list is out of reach until it is closed.`

- [ ] **Step 7: Run the e2e suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes. If a test of another page fails because it relied on the old panel width or on the full-screen panel below 1024px, fix the test, not the dialog, and say why in the commit.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/web/e2e
rtk git commit -m "test(web): the centred dialog, the edit form from a row and the arrows (W1–W4)"
```

---

### Task 7: Roadmap and gates

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Tick R2**

In `docs/superpowers/plans/README.md`, replace:

```markdown
- [ ] **R2** — the centred dialog, and the edit form opened from a transaction row (W1–W4).
```

with:

```markdown
- [x] **R2** — the centred dialog, and the edit form opened from a transaction row (W1–W4)
  (`plans/2026-10-21-web-redesign-r2-dialog.md`).
```

After the paragraph `**Acceptance for R1:** …`, add:

```markdown
**Acceptance for R2:** a detail opens in a 440px dialog and a form in a 480px dialog, in the centre
of the screen; below 760px both are sheets at the bottom; a transaction row opens «Edit transaction»;
«Delete» in its foot deletes at once and the toast offers «Undo»; ↑ ↓ move along the rows.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck --continue`
Expected: every package passes. On a machine with Node older than 22.22, `site` fails on the engine check only; that is not a failure of this plan.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Look at the other dialogs**

Run: `rtk proxy pnpm --filter web dev`. Open one dialog on each page that has one: `/accounts` (an account, a goal, «New account»), `/stats` (a category), `/profile/categories`, `/profile/tags`, `/profile/budgets`, `/admin/accounts`, `/admin/invites`, `/admin/settings`. Do it at 1440px and at 390px.
Expected: each is a centred dialog at 1440px and a sheet at 390px. No text clips, and a long body scrolls inside the dialog.

- [ ] **Step 4: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R2 done"
```
