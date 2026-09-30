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

  it('keeps Home lit on /budgets, which is reached from Home and has no tab', () => {
    expect(isCurrent('/home', '/budgets')).toBe(true);
    expect(isCurrent('/home', '/budgets?b=abc')).toBe(true);
    expect(isCurrent('/accounts', '/budgets')).toBe(false);
  });

  it('matches a sub-page of a section', () => {
    expect(isCurrent('/profile', '/profile/passkeys')).toBe(true);
    expect(isCurrent('/admin', '/admin/invites')).toBe(true);
  });
});
