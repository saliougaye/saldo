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
