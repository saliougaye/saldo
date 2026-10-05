import { catalogs, makeTranslator } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import { verificationMessage } from './messages';

const details = {
  instance: 'Casa Rossi',
  host: 'saldo.example.com',
  url: 'https://saldo.example.com/api/auth/verify-email?token=abc.def&callbackURL=%2Femail-verified',
};

describe('mail messages', () => {
  it('keeps an instance name with line breaks out of the subject', () => {
    const { subject } = verificationMessage(makeTranslator(catalogs.en), {
      ...details,
      instance: 'Casa\r\nBcc: x',
    });
    expect(subject).not.toMatch(/[\r\n]/);
  });
});
