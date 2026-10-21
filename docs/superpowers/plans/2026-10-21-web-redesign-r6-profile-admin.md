# Web redesign R6 — Profile and Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Profile gets a menu of 220px on the left, in four groups.
- Admin becomes the last group of that menu, and only an admin sees it (W10).
- The avatar in the top bar opens a menu with «Profile» and «Sign out».
- The Admin icon leaves the top bar.

**Architecture:**
- One server component, `SettingsPage`, renders the frame for both `/profile/*` and `/admin/*`: the head, the grouped menu with its counts, «Sign out», and the section.
- The URLs do not change. `app/(app)/admin/layout.tsx` keeps the admin guard, then renders the same `SettingsPage` as Profile.
- `SubnavLayout` becomes a small client component. It reads the path, so that below 760px `/profile` shows the menu as a list and a section shows alone, with a way back.

**Tech Stack:** Next.js (App Router, server components), Base UI `Menu`, CSS Modules with the `@saldo/ui` token variables, `@saldo/core`, `@saldo/i18n`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-web-pages-redesign.html`, W10, section 06 «Profile and Admin», figures 7 and 8, and open item 1 (the Admin routes).

**Mockup (not in the repository):** `docs/design/redesign/profile.html`.

**Branch:** `redesign/web`. R1–R5 are done on it.

---

## Decisions this plan takes where the spec leaves a choice

- **Open item 1, the Admin routes:** `/admin/*` stays. It gets the same frame as Profile, so every link, every bookmark and every e2e path still works. `requireWebAdmin` stays in the admin layout, in every admin page and in every admin Server Action. A member who opens `/admin` still gets «not found».
- **`/profile` is the first section, «Profile», no longer a redirect.** On a wide screen it shows the menu and the account section. Below 760px it shows only the menu, as a list of groups. A section then has «‹ Profile» to go back to that list.
- **The sections keep their content.** The spec asks for segmented controls that save at once, for example language and theme. That is a change to each section, not to the frame. A later plan can do it section by section.
- **The head label of an admin is `admin.roleAdmin` («Admin»).** The spec says «Administrator», but the catalogs already name the role with this key.
- **The counts of «Organise»** come from `SettingsPage`, with the same rule that each section uses for its list. Task 3, Step 2 says how to check that.

## File structure

| File | Change |
|---|---|
| `packages/i18n/src/locales/{en,it,de,es,fr,pt,sv}.ts` | `web.profile` (5 keys) and `web.shell.accountMenu`. |
| `packages/ui/src/tokens.ts` | `subnavWidth: 220`. |
| `apps/web/src/features/shell/nav.ts`, `app/(app)/layout.tsx`, `src/ui/TopBar.tsx` | The Admin item goes from the top bar. |
| `apps/web/src/ui/Avatar.tsx`, `Avatar.module.css` | The avatar opens a menu. |
| `apps/web/src/ui/NavLink.tsx` | `alsoCurrentAt`. |
| `apps/web/src/ui/SubnavLayout.tsx`, `.module.css` | The frame: head, menu, section, way back. |
| `apps/web/app/(app)/profile/SettingsPage.tsx` | New: the shared frame with its data. |
| `apps/web/app/(app)/profile/layout.tsx`, `page.tsx`, `profile.module.css` | Use the frame; `/profile` is the account section. |
| `apps/web/app/(app)/admin/layout.tsx`, `admin.module.css` | The guard, then the same frame. |
| `apps/web/e2e/shell.spec.ts`, `profile.spec.ts`, others that need it | Follow the new way in. |
| `docs/superpowers/plans/README.md` | R6 ticked. |

---

### Task 1: Strings and token

**Files:**
- Modify: `packages/i18n/src/locales/en.ts`, `it.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts`
- Modify: `packages/ui/src/tokens.ts`

- [x] **Step 1: Add `web.shell.accountMenu`**

In each locale, inside `web: { … shell: { … } }`, add after the line `backLabel: …`:

| File | Line |
|---|---|
| `en.ts` | `      accountMenu: 'Account menu',` |
| `it.ts` | `      accountMenu: 'Menu dell’account',` |
| `de.ts` | `      accountMenu: 'Kontomenü',` |
| `es.ts` | `      accountMenu: 'Menú de la cuenta',` |
| `fr.ts` | `      accountMenu: 'Menu du compte',` |
| `pt.ts` | `      accountMenu: 'Menu da conta',` |
| `sv.ts` | `      accountMenu: 'Kontomeny',` |

- [x] **Step 2: Add the `web.profile` block**

In each locale, right after the closing `},` of `web.shell`, add the block for that locale. First check that `web` has no `profile` key yet: `rtk grep -n "^    profile: {" packages/i18n/src/locales/en.ts` must show nothing inside `web`.

`en.ts`:

```ts
    profile: {
      groupAccount: 'Account',
      groupOrganise: 'Organise',
      groupConnections: 'Connections and data',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Back to Profile',
    },
```

`it.ts`:

```ts
    profile: {
      groupAccount: 'Account',
      groupOrganise: 'Organizza',
      groupConnections: 'Collegamenti e dati',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Torna a Profilo',
    },
```

`de.ts`:

```ts
    profile: {
      groupAccount: 'Konto',
      groupOrganise: 'Ordnen',
      groupConnections: 'Verbindungen und Daten',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Zurück zum Profil',
    },
```

`es.ts`:

```ts
    profile: {
      groupAccount: 'Cuenta',
      groupOrganise: 'Organizar',
      groupConnections: 'Conexiones y datos',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Volver al perfil',
    },
```

`fr.ts`:

```ts
    profile: {
      groupAccount: 'Compte',
      groupOrganise: 'Organiser',
      groupConnections: 'Connexions et données',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Retour au profil',
    },
```

`pt.ts`:

```ts
    profile: {
      groupAccount: 'Conta',
      groupOrganise: 'Organizar',
      groupConnections: 'Ligações e dados',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Voltar ao perfil',
    },
```

`sv.ts`:

```ts
    profile: {
      groupAccount: 'Konto',
      groupOrganise: 'Ordna',
      groupConnections: 'Anslutningar och data',
      groupAdmin: 'Admin · {{name}}',
      backLabel: 'Tillbaka till profilen',
    },
```

- [x] **Step 3: The menu width**

In `packages/ui/src/tokens.ts`, replace:

```ts
  /** Web: the sub-navigation of Profilo and Admin. */
  subnavWidth: 200,
```

with:

```ts
  /** Web (W10, 2026-10-21): the menu of Profile, which Admin shares. */
  subnavWidth: 220,
```

- [x] **Step 4: Test and commit**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS.

```bash
rtk git add packages/i18n/src/locales packages/ui/src/tokens.ts
rtk git commit -m "feat(i18n): the groups of the Profile menu and the account menu"
```

---

### Task 2: The top bar — the avatar menu, and no Admin icon

**Files:**
- Modify: `apps/web/src/features/shell/nav.ts`
- Modify: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/src/ui/TopBar.tsx`
- Replace: `apps/web/src/ui/Avatar.tsx`
- Modify: `apps/web/src/ui/Avatar.module.css`

- [ ] **Step 1: The Admin item goes from the destinations**

In `apps/web/src/features/shell/nav.ts`:

1. Change `key: 'home' | 'transactions' | 'stats' | 'accounts' | 'admin';` to `key: 'home' | 'transactions' | 'stats' | 'accounts';`.
2. Delete the `trailing?: true;` field and its comment.
3. Replace the whole `navItems` function and its comment with:

```ts
/** §17.1.7: the four tabs of the phone. Admin is a group of the Profile menu (W10), not a tab. */
export function navItems(): NavItem[] {
  return [...TABS];
}
```

4. In the comment of `NavItem`, change «the top bar, the tab bar and the avatar menu» to «the top bar and the tab bar».

Run: `rtk grep -rn "trailing\b\|navItems(" apps/web/src apps/web/app`
Then fix every caller this finds, as Steps 2 and 3 do.

- [ ] **Step 2: The app layout**

In `apps/web/app/(app)/layout.tsx`:

1. Delete the line `const admin = isAdminUser(user);` and the `isAdminUser` import.
2. Replace `const items = navItems(admin).map(…)` with `const items = navItems().map((item) => ({ ...item, label: t(item.labelKey) }));`.
3. Replace the `<TopBar … />` element with:

```tsx
        <TopBar
          items={items}
          user={{ name: user.displayName, email: user.email }}
          strings={{
            label: t('web.shell.mainNav'),
            newTransaction: t('web.shell.newTransaction'),
            accountMenu: t('web.shell.accountMenu'),
            profile: t('profile.title'),
            signOut: t('sync.signOut'),
            working: t('common.loading'),
          }}
        />
```

4. Replace `items={items.filter((item) => item.trailing !== true)}` in `<TabBar>` with `items={items}`.

- [ ] **Step 3: The top bar**

In `apps/web/src/ui/TopBar.tsx`:

1. Replace the `Props` interface with:

```tsx
interface Props {
  items: (NavItem & { label: string })[];
  user: { name: string; email: string };
  strings: {
    /** Names the landmark: the tab bar is a second `<nav>` on the same page (§17.1.7). */
    label: string;
    newTransaction: string;
    accountMenu: string;
    profile: string;
    signOut: string;
    working: string;
  };
}
```

2. Replace the comment above `export function TopBar` with:

```tsx
/**
 * H1: from left to right the brand, the four destinations, «New transaction» and the avatar, which
 * opens the account menu (W10). Admin is a group of the Profile menu, not an item here.
 * Below 760px only the brand and the avatar show: the tab bar carries the rest.
 */
```

3. Delete the `main` and `trailing` constants. Map `items` in place of `main` in the `<nav>`. Delete the `{trailing.map(…)}` block.
4. Replace `<Avatar name={user.name} label={strings.profile} />` with:

```tsx
          <Avatar
            name={user.name}
            email={user.email}
            strings={{
              menu: strings.accountMenu,
              profile: strings.profile,
              signOut: strings.signOut,
              working: strings.working,
            }}
          />
```

5. Remove the imports that are no longer used (`IconName` if unused).

- [ ] **Step 4: The avatar menu**

Replace the whole of `apps/web/src/ui/Avatar.tsx` with:

```tsx
'use client';

import { Menu } from '@base-ui/react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../client/authClient';
import { isCurrent } from '../features/shell/nav';
import { AppLink as Link } from './AppLink';
import styles from './Avatar.module.css';
import { initials } from './initials';

interface Props {
  name: string;
  email: string;
  strings: { menu: string; profile: string; signOut: string; working: string };
}

/**
 * W10: the avatar opens the account menu — the name and the email, «Profile» and «Sign out». It
 * rings itself while Profile or Admin is the page, as a tab does. Sign out is the same call as
 * `SignOutButton`: Better Auth deletes the session, then `replace`, so Back does not land on a page
 * that has no session behind it (§17.1.4).
 */
export function Avatar({ name, email, strings }: Props) {
  const path = usePathname();
  const current = isCurrent('/profile', path) || isCurrent('/admin', path);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = () => {
    setBusy(true);
    void authClient.signOut().finally(() => router.replace('/login'));
  };
  return (
    <Menu.Root>
      <Menu.Trigger
        className={styles.avatar}
        aria-label={strings.menu}
        data-current={current ? '' : undefined}
      >
        <span aria-hidden="true">{initials(name)}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={styles.positioner} sideOffset={8} align="end">
          <Menu.Popup className={styles.popup}>
            <div className={styles.who}>
              <b>{name}</b>
              <span>{email}</span>
            </div>
            <Menu.LinkItem className={styles.item} closeOnClick render={<Link href="/profile" />}>
              {strings.profile}
            </Menu.LinkItem>
            <Menu.Separator className={styles.separator} />
            <Menu.Item
              className={`${styles.item} ${styles.danger}`}
              disabled={busy}
              closeOnClick={false}
              onClick={signOut}
            >
              {busy ? strings.working : strings.signOut}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

`FilterMenu` uses `Menu.LinkItem` with `closeOnClick` and `render`, so those props exist. If `Menu.Item` in the installed Base UI version has no `closeOnClick`, remove that prop: the menu then closes on the click, and the busy label is not needed. Check the Base UI docs, as AGENTS.md asks.

- [ ] **Step 5: The avatar menu CSS**

In `apps/web/src/ui/Avatar.module.css`, replace the rule `.avatar[aria-current="page"] { … }` with:

```css
.avatar[data-current] {
  color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-text);
}

.avatar:focus-visible {
  outline: 2px solid var(--color-text);
  outline-offset: 2px;
}

.avatar {
  cursor: pointer;
}

/* The account menu: above the top bar and any dialog, as `FilterMenu`'s popup. */
.positioner {
  z-index: 50;
}

.popup {
  min-width: 220px;
  padding: 6px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-raised);
  box-shadow: 0 12px 32px var(--color-shadow);
  transform-origin: var(--transform-origin);
  transition-property: opacity, scale;
  transition-duration: 150ms;
  transition-timing-function: var(--motion-easing);
}

.popup[data-starting-style],
.popup[data-ending-style] {
  opacity: 0;
  scale: 0.96;
}

.who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 10px;
  min-width: 0;
}

.who b {
  font-weight: var(--font-weight-medium);
}

.who span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-input);
  background: none;
  color: var(--color-text);
  font-size: var(--font-size-footnote);
  text-align: start;
  text-decoration: none;
  cursor: pointer;
}

.item[data-highlighted] {
  background: var(--color-surface);
}

.item[data-disabled] {
  opacity: 0.5;
  cursor: default;
}

.danger {
  color: var(--color-accent);
}

.separator {
  height: 1px;
  margin: 4px 6px;
  background: var(--color-border);
}
```

In the `prefers-reduced-motion` block at the end of the file, add `.popup { transition-property: opacity; }`.

- [ ] **Step 6: Typecheck, test and commit**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS. If a unit test reads `navItems(true)` or the `admin` item, change it to the new rule: four tabs for everyone.

```bash
rtk git add apps/web/src/features/shell/nav.ts "apps/web/app/(app)/layout.tsx" apps/web/src/ui/TopBar.tsx apps/web/src/ui/Avatar.tsx apps/web/src/ui/Avatar.module.css
rtk git commit -m "feat(web): the avatar opens the account menu; Admin leaves the top bar (W10)"
```

Between this commit and Task 3, an admin reaches Admin only by its URL. Task 3 adds the menu group.

---

### Task 3: The Profile frame, shared with Admin (W10)

**Files:**
- Modify: `apps/web/src/ui/NavLink.tsx`
- Replace: `apps/web/src/ui/SubnavLayout.tsx`, `apps/web/src/ui/SubnavLayout.module.css`
- Create: `apps/web/app/(app)/profile/SettingsPage.tsx`
- Replace: `apps/web/app/(app)/profile/layout.tsx`, `apps/web/app/(app)/profile/page.tsx`
- Modify: `apps/web/app/(app)/profile/profile.module.css`
- Replace: `apps/web/app/(app)/admin/layout.tsx`
- Modify: `apps/web/app/(app)/admin/admin.module.css`

- [ ] **Step 1: `NavLink` can be current on a second path**

In `apps/web/src/ui/NavLink.tsx`, add to the props type, after `count?: number;`:

```tsx
  /** A second path where this link is the current one: «Profile» on the bare `/profile`. */
  alsoCurrentAt?: string;
```

Add `alsoCurrentAt,` to the destructured props. Replace `const current = isCurrent(href, usePathname());` with:

```tsx
  const path = usePathname();
  const current = isCurrent(href, path) || (alsoCurrentAt !== undefined && path === alsoCurrentAt);
```

- [ ] **Step 2: Check the counts**

Open `app/(app)/profile/categories/page.tsx`, `tags/page.tsx`, `budgets/page.tsx` and `goals/page.tsx`. For each one, write down which rows it lists: for example, categories that are not archived, or every tag. Step 4 counts the same rows. If a section uses a view function (for example `categoriesView`), call that function in Step 4 and take its length, so that the menu and the section can never disagree.

- [ ] **Step 3: The frame**

Replace the whole of `apps/web/src/ui/SubnavLayout.tsx` with:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppLink as Link } from './AppLink';
import { Icon } from './Icon';
import { PANEL_SLOT } from './panelSlot';
import styles from './SubnavLayout.module.css';

/**
 * W10: the frame of Profile, which Admin shares — the head, a menu of 220px on the left, the
 * section on the right. Below 760px the page at `indexPath` is the menu alone, as a list of groups
 * (the phone's Profile), and a section shows alone with «‹ Profile» back to that list. A client
 * component only to read the path. `PasskeyList` portals its panel into the slot.
 */
export function SubnavLayout({
  navLabel,
  head,
  nav,
  indexPath,
  back,
  children,
}: {
  navLabel: string;
  head: ReactNode;
  nav: ReactNode;
  /** The page that is the menu below 760px: `/profile`. */
  indexPath: string;
  back: { text: string; label: string };
  children: ReactNode;
}) {
  const index = usePathname() === indexPath;
  return (
    <div className={styles.page} data-index={index ? '' : undefined}>
      <div className={styles.head}>{head}</div>
      <Link className={styles.back} href={indexPath} aria-label={back.label}>
        <Icon name="chevL" size={16} />
        {back.text}
      </Link>
      <div className={styles.layout}>
        <nav className={styles.subnav} aria-label={navLabel}>
          {nav}
        </nav>
        <div className={styles.section}>{children}</div>
        {/* `PasskeyList` opens its panel here with `createPortal`. */}
        <div id={PANEL_SLOT} className={styles.slot} />
      </div>
    </div>
  );
}

/** A group of the menu: its title, then its links (W10). */
export function SubnavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group} role="group" aria-label={title}>
      <p className={styles.groupTitle} aria-hidden="true">
        {title}
      </p>
      {children}
    </div>
  );
}

/** The line above «Sign out», the last item of the menu. */
export function SubnavSeparator() {
  return <hr className={styles.separator} />;
}
```

Replace the whole of `apps/web/src/ui/SubnavLayout.module.css` with:

```css
/* W10: the head, then the menu beside the section. */
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.head {
  min-width: 0;
}

/* «‹ Profile»: only below 760px, on a section. */
.back {
  display: none;
}

.layout {
  display: grid;
  gap: 24px;
}

.subnav {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.groupTitle {
  padding: 0 12px 4px;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-faint);
}

.subnav a,
.subnav button {
  width: 100%;
}

.separator {
  height: 1px;
  margin: 0 12px;
  border: 0;
  background: var(--color-border);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--layout-section-gap-web);
  min-width: 0;
}

/*
 * A `PanelSwitch` page (`slot`): its list and its panel take the section's place, so the server
 * renders the panel in place of a portal.
 */
.section:has(> [data-panel-switch]) {
  display: contents;
}

/* W1: a panel in the slot is fixed over the page, so the slot takes no place at any width. */
.slot {
  display: contents;
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (min-width: 760px) {
  .layout {
    grid-template-columns: var(--layout-subnav-width) minmax(0, 1fr);
    align-items: start;
    gap: 40px;
  }

  /* The menu stays in view under the top bar while the section scrolls. */
  .subnav {
    position: sticky;
    top: calc(var(--layout-topbar-height) + 16px);
  }
}

@media (max-width: 759px) {
  /* `/profile`: the menu alone, as the phone's list of groups. */
  .page[data-index] .layout > :not(nav) {
    display: none;
  }

  /* A section: alone, with the way back to the list. */
  .page:not([data-index]) .head,
  .page:not([data-index]) .subnav {
    display: none;
  }

  .page:not([data-index]) .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    height: var(--layout-nav-item-height);
    color: var(--color-text-muted);
    font-size: var(--font-size-footnote);
  }
}
```

- [ ] **Step 4: `SettingsPage`**

Create `apps/web/app/(app)/profile/SettingsPage.tsx`. Use the counts you checked in Step 2. The code below shows the shape. Keep the four `count` lines if they match what the sections list, and change them if they do not:

```tsx
import { goalViews } from '@saldo/core';
import type { ReactNode } from 'react';
import { activeInviteCount } from '../../../src/features/admin/invitesView';
import { isAdminUser, listAccounts } from '../../../src/server/auth/admin';
import { listInvites } from '../../../src/server/auth/invites';
import { getDb } from '../../../src/server/db/client';
import { readPage } from '../../../src/server/page/context';
import { pageInstanceInfo } from '../../../src/server/page/instanceSettings';
import { initials } from '../../../src/ui/initials';
import { NavLink } from '../../../src/ui/NavLink';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import { SubnavGroup, SubnavLayout, SubnavSeparator } from '../../../src/ui/SubnavLayout';
import styles from './profile.module.css';

/**
 * W10: Profile's frame, which Admin shares. The head (avatar, name, email, and «Admin» for the
 * admin role), then the menu in four groups — Account, Organise with its counts, Connections and
 * data, and Admin for the admin role only — and «Sign out» under a line. The Admin group is only a
 * set of links: `requireWebAdmin` still guards the admin layout, every admin page and every admin
 * Server Action.
 */
export async function SettingsPage({ children }: { children: ReactNode }) {
  const page = await readPage(Promise.resolve({}));
  const { t, user, data, today, def } = page;
  const admin = isAdminUser(user);
  const db = getDb();
  const adminData = admin
    ? await Promise.all([listAccounts(db), listInvites(db, new Date()), pageInstanceInfo()])
    : null;

  // The rows each section of «Organise» lists (Task 3, Step 2).
  const counts = {
    categories: data.categories.filter((category) => category.archivedAt == null).length,
    tags: data.tags.length,
    budgets: data.budgets.length,
    goals: goalViews(data.accounts, data.transactions, today, def).length,
  };

  return (
    <SubnavLayout
      navLabel={t('profile.title')}
      indexPath="/profile"
      back={{ text: t('profile.title'), label: t('web.profile.backLabel') }}
      head={
        <header className={styles.head}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.displayName)}
          </span>
          <div className={styles.who}>
            <h1 className={styles.name}>{user.displayName}</h1>
            <p className={styles.email}>
              {user.email}
              {admin ? <span className={styles.badge}>{t('admin.roleAdmin')}</span> : null}
            </p>
          </div>
        </header>
      }
      nav={
        <>
          <SubnavGroup title={t('web.profile.groupAccount')}>
            <NavLink
              href="/profile/account"
              alsoCurrentAt="/profile"
              icon="settings"
              label={t('profile.title')}
            />
            <NavLink href="/profile/passkeys" icon="key" label={t('web.passkeys.title')} />
            <NavLink
              href="/profile/preferences"
              icon="wrench"
              label={t('settings.preferences')}
            />
          </SubnavGroup>
          <SubnavGroup title={t('web.profile.groupOrganise')}>
            <NavLink
              href="/profile/categories"
              icon="grip"
              label={t('categories.title')}
              count={counts.categories}
            />
            <NavLink href="/profile/tags" icon="tag" label={t('tags.title')} count={counts.tags} />
            <NavLink
              href="/profile/budgets"
              icon="target"
              label={t('budgets.title')}
              count={counts.budgets}
            />
            <NavLink
              href="/profile/goals"
              icon="piggy"
              label={t('goals.title')}
              count={counts.goals}
            />
          </SubnavGroup>
          <SubnavGroup title={t('web.profile.groupConnections')}>
            <NavLink href="/profile/connectors" icon="plug" label={t('web.connectors.title')} />
            <NavLink href="/profile/data" icon="archive" label={t('web.data.title')} />
          </SubnavGroup>
          {adminData === null ? null : (
            <SubnavGroup title={t('web.profile.groupAdmin', { name: adminData[2].name })}>
              <NavLink
                href="/admin/accounts"
                icon="shield"
                label={t('admin.nav.accounts')}
                count={adminData[0].length}
              />
              <NavLink
                href="/admin/invites"
                icon="key"
                label={t('admin.nav.invites')}
                count={activeInviteCount(adminData[1])}
              />
              <NavLink href="/admin/instance" icon="info" label={t('admin.nav.instance')} />
              <NavLink href="/admin/settings" icon="settings" label={t('admin.nav.settings')} />
              <NavLink href="/admin/mcp" icon="plug" label={t('admin.mcp.title')} />
            </SubnavGroup>
          )}
          <SubnavSeparator />
          <SignOutButton
            variant="row"
            icon="arrowUR"
            className={styles.signOut}
            label={t('sync.signOut')}
            working={t('common.loading')}
          />
        </>
      }
    >
      {children}
    </SubnavLayout>
  );
}
```

Read the old `admin/layout.tsx` before you delete it. It may call `adminContext(user)` for its `t`, and that `t` may resolve the admin keys in another way than `readPage`'s `t`. If the admin labels come out wrong in Step 8, use `adminContext` for the Admin group.

- [ ] **Step 5: The Profile layout and index**

Replace the whole of `apps/web/app/(app)/profile/layout.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { SettingsPage } from './SettingsPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** W10: Profile is its frame — the head, the grouped menu, the section (`SettingsPage`). */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <SettingsPage>{children}</SettingsPage>;
}
```

Replace the whole of `apps/web/app/(app)/profile/page.tsx` with:

```tsx
/**
 * W10: `/profile` is the first section, «Profile». On a wide screen it shows beside the menu; below
 * 760px the frame shows the menu alone here, as the phone's list of groups (`SubnavLayout`).
 */
export { default } from './account/page';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

- [ ] **Step 6: The Admin layout**

Replace the whole of `apps/web/app/(app)/admin/layout.tsx` with:

```tsx
import type { ReactNode } from 'react';
import { requireWebAdmin } from '../../../src/server/auth/currentUser';
import { SettingsPage } from '../profile/SettingsPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * W10, open item 1: Admin keeps its routes and takes Profile's frame, where it is the last group of
 * the menu. The guard is here, before anything streams, and in every page and Server Action: a
 * layout does not run for an action, and a page can render without it.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireWebAdmin();
  return <SettingsPage>{children}</SettingsPage>;
}
```

- [ ] **Step 7: The CSS of the head**

In `apps/web/app/(app)/profile/profile.module.css`:
- Delete the `.page` rule and the `@media (min-width: 1024px)` block that hides `.head`. The head now shows at every width, except on a section below 760px, where `SubnavLayout` hides it.
- Delete the `.side…` rules (`.sideWho`, `.sideAvatar`, and any other `.side*`), which nothing uses now.
- Keep `.head`, `.avatar`, `.name`, `.email`, `.badge` and `.signOut`, and add:

```css
.who {
  min-width: 0;
}
```

In `apps/web/app/(app)/admin/admin.module.css`, delete the rules that only the old layout used (`.page`, `.head`, `.title`, `.headCount`, `.sideTitle`, `.sideName`). Delete a rule only if `rtk grep -rn "styles\.<name>" "apps/web/app/(app)/admin"` finds no other user.

- [ ] **Step 8: Lint, typecheck, test, and look at it**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS.

Run: `rtk proxy pnpm --filter web dev`. Use a temporary Playwright screenshot script if you have no browser, and delete it before you commit. Sign in as a member, then as an admin (the e2e support has `openAdmin`). Open `/profile`, `/profile/categories`, `/admin/accounts` and the avatar menu, at 1440px and at 390px, in the light and the dark theme.

Expected:
- **Wide screen:**
  - The head shows the avatar, the name, the email and, for an admin, «Admin».
  - The 220px menu shows Account · Organise (with counts) · Connections and data, then «Admin · ‹instance›» for an admin only, then «Sign out» under a line.
  - `/profile` highlights «Profile».
  - `/admin/accounts` shows the same frame with «Accounts» highlighted.
- **390px:**
  - `/profile` shows the head and the menu only.
  - `/profile/categories` shows the section alone, with «‹ Profile» above it, and that link goes back to the list.
- **Avatar menu:** it shows the name, the email, «Profile» and «Sign out». The top bar has no Admin icon.
- **Dialogs:** a dialog of Categories or Tags still opens over the page.
- **Member:** `/admin` still answers «not found».

- [ ] **Step 9: Commit**

```bash
rtk git add apps/web/src/ui/NavLink.tsx apps/web/src/ui/SubnavLayout.tsx apps/web/src/ui/SubnavLayout.module.css "apps/web/app/(app)/profile" "apps/web/app/(app)/admin"
rtk git commit -m "feat(web): Profile's grouped menu, with Admin as its last group for admins (W10)"
```

---

### Task 4: e2e

**Files:**
- Modify: `apps/web/e2e/shell.spec.ts`, `apps/web/e2e/profile.spec.ts`
- Modify: other specs and `apps/web/e2e/support/*.ts` that reached Admin through the top bar

- [ ] **Step 1: Find what used the old way in**

Run: `rtk grep -rn "admin.title\|/profile'\|profile/account\|banner" apps/web/e2e`
For each hit, decide:
- **Admin link in the top bar:** a test that clicked it must now open the avatar menu, then «Profile», then the Admin group link, or go straight to the URL.
- **`/profile` redirect:** a test that expected `/profile` to redirect to `/profile/account` must now expect `/profile` to stay.
- **Profile heading:** a test that read the old Profile heading must read the new head.

- [ ] **Step 2: The shell test of the admin**

In `apps/web/e2e/shell.spec.ts`, in the test `'the admin also sees Admin, and each tab opens its section'`, replace the part that checks the Admin icon link in the banner with:

```ts
    // W10: Admin is not in the top bar; it is the last group of the Profile menu.
    await expect(
      page.getByRole('banner').getByRole('link', { name: t('admin.title'), exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: t('web.shell.accountMenu') }).click();
    await page.getByRole('menuitem', { name: t('profile.title') }).click();
    await expect(page).toHaveURL(/\/profile$/);
    const menu = page.getByRole('navigation', { name: t('profile.title') });
    await menu.getByRole('link', { name: t('admin.nav.accounts') }).click();
    await expect(page).toHaveURL(/\/admin\/accounts$/);
```

Rename the test to `'the admin finds Admin in the Profile menu, and each tab opens its section'`. Keep the rest of the test. If it later loops over the tabs, check that the loop still finds four tabs.

In the member test, add after the check that the banner has no Admin link:

```ts
    // W10: the Admin group of the Profile menu is for the admin role only.
    await page.goto('/profile');
    await expect(
      page
        .getByRole('navigation', { name: t('profile.title') })
        .getByRole('link', { name: t('admin.nav.accounts') }),
    ).toHaveCount(0);
```

- [ ] **Step 3: The Profile test**

In `apps/web/e2e/profile.spec.ts`, replace:

```ts
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/profile\/account$/);
```

with:

```ts
  // W10: `/profile` is the first section, «Profile», and its menu item is the current one.
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page
      .getByRole('navigation', { name: t('profile.title') })
      .getByRole('link', { name: t('profile.title'), exact: true }),
  ).toHaveAttribute('aria-current', 'page');
```

- [ ] **Step 4: The menu below 760px, and the avatar menu**

Add to `apps/web/e2e/profile.spec.ts` (with the imports and fixtures the file already uses for a member):

```ts
test('below 760px Profile is a list of groups, and a section has a way back (W10)', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Elenco',
    email: 'profile-list@e2e.test',
  });
  const { page } = member;
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/profile');
  const menu = page.getByRole('navigation', { name: t('profile.title') });
  await expect(menu.getByRole('group', { name: t('web.profile.groupOrganise') })).toBeVisible();

  await menu.getByRole('link', { name: t('categories.title') }).click();
  await expect(page).toHaveURL(/\/profile\/categories$/);
  await expect(menu).toBeHidden();
  await page.getByRole('link', { name: t('web.profile.backLabel') }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(menu).toBeVisible();
  await member.context.close();
});

test('the avatar opens the account menu, with Profile and Sign out (W10)', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Menu',
    email: 'profile-menu@e2e.test',
  });
  const { page } = member;
  await page.goto('/home');
  await page.getByRole('button', { name: t('web.shell.accountMenu') }).click();
  const popup = page.getByRole('menu');
  await expect(popup).toContainText('profile-menu@e2e.test');
  await expect(popup.getByRole('menuitem', { name: t('profile.title') })).toBeVisible();
  await popup.getByRole('menuitem', { name: t('sync.signOut') }).click();
  await expect(page).toHaveURL(/\/login/);
  await member.context.close();
});
```

If `createMember` is not imported in `profile.spec.ts`, import it from `./support/members`, as `transactions.spec.ts` does. If `profile.spec.ts` builds its member in another way, use that way.

- [ ] **Step 5: Run the suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes. A failure in `admin.spec.ts` is most likely a test that read the old Admin head (`admin.title` as the `h1`). Make it read the new head or the menu group, and say why in the commit. Do not weaken a guard test: `/admin` and `/admin/accounts` must still answer «not found» to a member.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/web/e2e
rtk git commit -m "test(web): the Profile menu, its Admin group and the account menu (W10)"
```

---

### Task 5: Roadmap and gates

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Tick R6**

In `docs/superpowers/plans/README.md`, replace:

```markdown
- [ ] **R6** — Profile and Admin (W10).
```

with:

```markdown
- [x] **R6** — Profile and Admin (W10) (`plans/2026-10-21-web-redesign-r6-profile-admin.md`).
```

After the paragraph `**Acceptance for R5:** …`, add:

```markdown
**Acceptance for R6:** the avatar opens a menu with the name, the email, «Profile» and «Sign out»;
the top bar has no Admin icon; Profile has a 220px menu in the groups Account, Organise (with
counts), Connections and data, and «Admin · ‹instance›» for the admin role only, then «Sign out»;
`/admin/*` keeps its routes and its guard and shows the same frame; below 760px `/profile` is the
list of groups and a section has a way back.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck --continue`
Expected: every package passes. On a machine with Node older than 22.22, `site` fails on the engine check only; that is not a failure of this plan.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R6 done"
```
