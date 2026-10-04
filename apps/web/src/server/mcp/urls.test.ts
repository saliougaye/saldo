import { describe, expect, it } from 'vitest';
import { webAppLinks } from './urls';

describe('webAppLinks', () => {
  it('names the page that opens each kind of row, with {id} to fill in', () => {
    expect(webAppLinks('https://saldo.example')).toEqual({
      url: 'https://saldo.example',
      transaction: 'https://saldo.example/transactions?t={id}',
      account: 'https://saldo.example/accounts?a={id}',
      goal: 'https://saldo.example/accounts?g={id}',
      budget: 'https://saldo.example/profile/budgets?b={id}',
      category: 'https://saldo.example/profile/categories?c={id}',
      tag: 'https://saldo.example/profile/tags?tag={id}',
    });
  });
});
