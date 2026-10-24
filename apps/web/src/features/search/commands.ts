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
