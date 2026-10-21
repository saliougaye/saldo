/** A destination of the shell: the same list drives the top bar and the tab bar. */
export interface NavItem {
  key: 'home' | 'transactions' | 'stats' | 'accounts';
  href: string;
  /** An icon of `@saldo/ui`'s set, narrowed to `IconName` where it is rendered. */
  icon: string;
  /** A dotted path for `t()`; the shell resolves it, so this stays a pure list. */
  labelKey: string;
}

const TABS: NavItem[] = [
  { key: 'home', href: '/home', icon: 'house', labelKey: 'tabs.home' },
  { key: 'transactions', href: '/transactions', icon: 'list', labelKey: 'tabs.transactions' },
  { key: 'stats', href: '/stats', icon: 'activity', labelKey: 'tabs.stats' },
  { key: 'accounts', href: '/accounts', icon: 'wallet', labelKey: 'tabs.accounts' },
];

/** §17.1.7: the four tabs of the phone. Admin is a group of the Profile menu (W10), not a tab. */
export function navItems(): NavItem[] {
  return [...TABS];
}

/** Whether a nav item owns the path being rendered: its section, and anything under it. */
export function isCurrent(href: string, path: string): boolean {
  const [pathname = ''] = path.split('?');
  return pathname === href || pathname.startsWith(`${href}/`);
}
