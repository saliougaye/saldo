import { describe, expect, it } from 'vitest';
import { goalExpenseHref, goalTransferHref } from './goalLinks';

describe('goalTransferHref', () => {
  it('points a new transfer from one account to the other with the goal name as description', () => {
    expect(goalTransferHref('a1', 'g1', 'Car')).toBe(
      '/transactions?new&from=a1&to=g1&description=Car',
    );
  });

  it('encodes what is not URL-safe', () => {
    const href = goalTransferHref('a 1', 'g&1', 'Viaggio & «sole»');
    const url = new URL(href, 'http://x');
    expect(url.searchParams.get('from')).toBe('a 1');
    expect(url.searchParams.get('to')).toBe('g&1');
    expect(url.searchParams.get('description')).toBe('Viaggio & «sole»');
  });
});

describe('goalExpenseHref', () => {
  it('carries the goal, its whole balance in minor units and the name', () => {
    const url = new URL(goalExpenseHref('g1', 12050, 'Car'), 'http://x');
    expect(url.pathname).toBe('/transactions');
    expect(url.searchParams.has('new')).toBe(true);
    expect(url.searchParams.get('closeGoal')).toBe('g1');
    expect(url.searchParams.get('amount')).toBe('12050');
    expect(url.searchParams.get('description')).toBe('Car');
  });
});
