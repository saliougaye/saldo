/** A destination of the shell: the same list drives the top bar, the tab bar and the avatar menu. */
export interface NavItem {
  key: 'home' | 'transactions' | 'stats' | 'accounts' | 'admin';
  href: string;
  /** An icon of `@saldo/ui`'s set, narrowed to `IconName` where it is rendered. */
  icon: string;
  /** A dotted path for `t()`; the shell resolves it, so this stays a pure list. */
  labelKey: string;
  /** Sits on the trailing side of the top bar, and outside the tab bar (§17.1.7). */
  trailing?: true;
}

const TABS: NavItem[] = [
  { key: 'home', href: '/home', icon: 'house', labelKey: 'tabs.home' },
  { key: 'transactions', href: '/transactions', icon: 'list', labelKey: 'tabs.transactions' },
  { key: 'stats', href: '/stats', icon: 'activity', labelKey: 'tabs.stats' },
  { key: 'accounts', href: '/accounts', icon: 'wallet', labelKey: 'tabs.accounts' },
];

/**
 * §17.1.7: the four tabs of the phone, plus Admin for the `admin` role. Admin is `trailing`, which is
 * what keeps it out of the bottom tab bar on a narrow screen — it is reached from the avatar there.
 */
export function navItems(admin: boolean): NavItem[] {
  return admin
    ? [
        ...TABS,
        { key: 'admin', href: '/admin', icon: 'settings', labelKey: 'admin.title', trailing: true },
      ]
    : [...TABS];
}

/** Whether a nav item owns the path being rendered: its section, and anything under it. */
export function isCurrent(href: string, path: string): boolean {
  const [pathname = ''] = path.split('?');
  return pathname === href || pathname.startsWith(`${href}/`);
}
