import { EMPTY_FILTERS } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { filtersFromSearch, searchFromFilters, toggleHref } from './listParams';

describe('filtersFromSearch', () => {
  it('is the empty filter set for a bare URL', () => {
    expect(filtersFromSearch({})).toEqual(EMPTY_FILTERS);
  });

  it('reads the query, the account and the direction', () => {
    expect(filtersFromSearch({ q: 'bar', account: 'a1', direction: 'expense' })).toMatchObject({
      query: 'bar',
      accountId: 'a1',
      direction: 'expense',
    });
  });

  it('reads several tags from one repeated parameter', () => {
    expect(filtersFromSearch({ tag: 'g1,g2' }).tagIds).toEqual(['g1', 'g2']);
  });

  it('ignores a direction it does not know', () => {
    expect(filtersFromSearch({ direction: 'sideways' }).direction).toBe('all');
  });

  it('reads the excluded-only switch', () => {
    expect(filtersFromSearch({ excluded: '1' }).onlyExcluded).toBe(true);
    expect(filtersFromSearch({}).onlyExcluded).toBe(false);
  });
});

describe('searchFromFilters', () => {
  it('writes nothing for the empty set, so the plain URL is the unfiltered list', () => {
    expect(searchFromFilters(EMPTY_FILTERS)).toEqual({});
  });

  it('writes only what is set', () => {
    expect(
      searchFromFilters({ ...EMPTY_FILTERS, query: 'bar', direction: 'income', tagIds: ['g1'] }),
    ).toEqual({ q: 'bar', direction: 'income', tag: 'g1' });
  });
});

describe('toggleHref', () => {
  it('turns a direction on, keeping the period', () => {
    expect(
      toggleHref('/transactions', EMPTY_FILTERS, { direction: 'expense' }, { p: '2026-08-01' }),
    ).toBe('/transactions?direction=expense&p=2026-08-01');
  });

  it('turns the same direction off again', () => {
    const active = { ...EMPTY_FILTERS, direction: 'expense' as const };
    expect(toggleHref('/transactions', active, { direction: 'expense' })).toBe('/transactions');
  });

  it('adds and removes one tag at a time', () => {
    const one = { ...EMPTY_FILTERS, tagIds: ['g1'] };
    expect(toggleHref('/transactions', one, { tagId: 'g2' })).toBe('/transactions?tag=g1%2Cg2');
    expect(toggleHref('/transactions', one, { tagId: 'g1' })).toBe('/transactions');
  });

  it('drops the selected row when the filters change, because it may no longer be in the list', () => {
    expect(toggleHref('/transactions', EMPTY_FILTERS, { direction: 'expense' }, { t: 'tx1' })).toBe(
      '/transactions?direction=expense',
    );
  });
});
