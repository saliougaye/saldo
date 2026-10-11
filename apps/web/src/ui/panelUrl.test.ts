import { describe, expect, it } from 'vitest';
import { type PanelParams, panelHrefFor, panelKeyFromSearch, panelOnlyChange } from './panelUrl';

const TAGS: PanelParams = { flags: ['new'], values: ['tag'] };

describe('panelKeyFromSearch', () => {
  it('reads a flag, then a value, flag first', () => {
    expect(panelKeyFromSearch(new URLSearchParams('new'), TAGS)).toBe('new');
    expect(panelKeyFromSearch(new URLSearchParams('tag=abc'), TAGS)).toBe('tag:abc');
    expect(panelKeyFromSearch(new URLSearchParams('tag=abc&new'), TAGS)).toBe('new');
    expect(panelKeyFromSearch(new URLSearchParams(''), TAGS)).toBeNull();
    expect(panelKeyFromSearch(new URLSearchParams('tag='), TAGS)).toBeNull();
  });

  it('follows the order a page gives, so a bookmarked URL keeps its meaning', () => {
    // Conti: `?new` wins, then `?g=` over `?a=`, and a detail wins over `?archived`.
    const accounts: PanelParams = {
      flags: ['new', 'archived'],
      values: ['g', 'a'],
      order: ['new', 'g', 'a', 'archived'],
    };
    expect(panelKeyFromSearch(new URLSearchParams('a=1&g=2'), accounts)).toBe('g:2');
    expect(panelKeyFromSearch(new URLSearchParams('archived&a=1'), accounts)).toBe('a:1');
    expect(panelKeyFromSearch(new URLSearchParams('g=2&new'), accounts)).toBe('new');
    expect(panelKeyFromSearch(new URLSearchParams('archived&a='), accounts)).toBe('archived');
    // A name in `order` that is not a panel parameter is not read.
    const typo: PanelParams = { flags: ['new'], values: ['tag'], order: ['x', 'tag'] };
    expect(panelKeyFromSearch(new URLSearchParams('x=1'), typo)).toBeNull();
    expect(panelKeyFromSearch(new URLSearchParams('new&tag=a'), typo)).toBe('tag:a');
  });
});

describe('panelOnlyChange', () => {
  const here = { pathname: '/profile/tags', search: new URLSearchParams('') };
  it('opens in place when only the panel parameters change', () => {
    expect(panelOnlyChange(here, '/profile/tags?tag=abc', TAGS)).toEqual({ key: 'tag:abc' });
    expect(panelOnlyChange(here, '/profile/tags', TAGS)).toEqual({ key: null });
    const filtered = { pathname: '/profile/tags', search: new URLSearchParams('q=x&r=y&new') };
    expect(panelOnlyChange(filtered, '/profile/tags?r=y&tag=a&q=x', TAGS)).toEqual({
      key: 'tag:a',
    });
  });
  it('is a navigation for another path, another filter or a fragment', () => {
    expect(panelOnlyChange(here, '/profile/budgets?new', TAGS)).toBeNull();
    expect(panelOnlyChange(here, '/profile/tags?q=x&tag=abc', TAGS)).toBeNull();
    expect(panelOnlyChange(here, '/profile/tags#x', TAGS)).toBeNull();
    expect(panelOnlyChange(here, 'https://example.com/profile/tags', TAGS)).toBeNull();
  });
});

describe('panelHrefFor', () => {
  it('writes a key back as a URL on the base', () => {
    expect(panelHrefFor('/profile/tags', 'tag:a b', TAGS)).toBe('/profile/tags?tag=a+b');
    expect(panelHrefFor('/profile/tags', 'new', TAGS)).toBe('/profile/tags?new=');
    expect(panelHrefFor('/profile/tags?q=x', null, TAGS)).toBe('/profile/tags?q=x');
    expect(panelHrefFor('/profile/tags?q=x&new', 'tag:a', TAGS)).toBe('/profile/tags?q=x&tag=a');
  });
  it('keeps a colon in the value: the key splits at the first one', () => {
    const href = panelHrefFor('/profile/tags', 'tag:a:b', TAGS);
    expect(href).toBe('/profile/tags?tag=a%3Ab');
    expect(panelKeyFromSearch(new URL(href, 'http://x.invalid').searchParams, TAGS)).toBe(
      'tag:a:b',
    );
  });
});
