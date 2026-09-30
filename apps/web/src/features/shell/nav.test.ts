import { describe, expect, it } from 'vitest';
import { isCurrent, navItems } from './nav';

describe('navItems', () => {
  it('is the four tabs of the phone, in the phone’s order', () => {
    expect(navItems(false).map((item) => item.key)).toEqual([
      'home',
      'transactions',
      'stats',
      'accounts',
    ]);
  });

  it('adds Admin for an admin, at the end and away from the four', () => {
    const items = navItems(true);
    expect(items.map((item) => item.key)).toEqual([
      'home',
      'transactions',
      'stats',
      'accounts',
      'admin',
    ]);
    expect(items.at(-1)).toMatchObject({ href: '/admin', trailing: true });
  });

  it('gives every item a label key and an icon', () => {
    for (const item of navItems(true)) {
      expect(item.labelKey.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('isCurrent', () => {
  it('matches a section by its first path segment, not by the whole path', () => {
    expect(isCurrent('/transactions', '/transactions')).toBe(true);
    expect(isCurrent('/transactions', '/transactions?t=abc')).toBe(true);
    expect(isCurrent('/transactions', '/stats')).toBe(false);
  });

  it('matches Home only on Home, so a nested page does not light two tabs', () => {
    expect(isCurrent('/home', '/home')).toBe(true);
    expect(isCurrent('/home', '/transactions')).toBe(false);
  });

  it('does not light Home on /profile/budgets, which belongs to the avatar', () => {
    expect(isCurrent('/home', '/profile/budgets')).toBe(false);
    expect(isCurrent('/profile', '/profile/budgets?b=abc')).toBe(true);
  });

  it('matches a sub-page of a section', () => {
    expect(isCurrent('/profile', '/profile/passkeys')).toBe(true);
    expect(isCurrent('/admin', '/admin/invites')).toBe(true);
  });
});
