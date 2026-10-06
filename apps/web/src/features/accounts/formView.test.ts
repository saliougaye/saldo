import { accountSchema } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT, ACCOUNT_2, dataWith, tx } from '../test/fixtures';
import { accountFormView, balanceToSend } from './formView';

const MAIN = accountSchema.parse({ ...ACCOUNT, openingBalance: 100000 });
const data = dataWith([tx({ id: 't1', amount: 1000, date: '2026-09-10' })], {
  accounts: [MAIN, ACCOUNT_2],
});

describe('accountFormView', () => {
  it('an edit shows the current balance, not the opening one', () => {
    const view = accountFormView({
      data,
      today: '2026-09-20',
      currency: 'EUR',
      mode: 'edit',
      id: 'a1',
    });
    expect(view?.initial.buffer).toBe('990');
  });
});

describe('balanceToSend', () => {
  it('sends null when the balance was left as loaded, so the server keeps the opening balance', () => {
    // A phone transaction after the page loaded must not be cancelled by a rename (§17.4.2).
    expect(balanceToSend('990', '990')).toBeNull();
  });

  it('sends the typed balance when the user changed it', () => {
    expect(balanceToSend('990', '1000')).toBe('1000');
    expect(balanceToSend('', '25.5')).toBe('25.5');
  });
});
