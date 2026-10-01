import { type AppLocale, catalogs, makeTranslator, SUPPORTED_LOCALES } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import { recoveryMessage, verificationMessage } from './messages';

const URL_ =
  'https://saldo.example.com/api/auth/verify-email?token=abc.def&callbackURL=%2Femail-verified';
const details = { instance: 'Casa Rossi', host: 'saldo.example.com', url: URL_ };
const tFor = (locale: AppLocale) => makeTranslator(catalogs[locale]);

describe('mail messages', () => {
  it('names the instance, says how long the link lasts and carries the link alone on a line', () => {
    const { subject, text } = verificationMessage(tFor('en'), details);
    expect(subject).toBe('Confirm your email address on Casa Rossi');
    expect(text).toContain('saldo.example.com');
    expect(text).toContain('24 hours');
    expect(text.split('\n')).toContain(URL_);
    expect(text).toContain('nobody gets in without the link');
  });

  it('says 15 minutes and once for the recovery link', () => {
    const { subject, text } = recoveryMessage(tFor('en'), details);
    expect(subject).toBe('Your link to get back into Casa Rossi');
    expect(text).toContain('15 minutes');
    expect(text.split('\n')).toContain(URL_);
  });

  it('is written in Italian for Italian', () => {
    const { subject, text } = recoveryMessage(tFor('it'), details);
    expect(subject).toBe('Il tuo link per rientrare in Casa Rossi');
    expect(text).toContain('15 minuti');
  });

  it.each(SUPPORTED_LOCALES)('%s leaves no placeholder or missing key behind', (locale) => {
    for (const make of [verificationMessage, recoveryMessage]) {
      const { subject, text } = make(tFor(locale), details);
      for (const part of [subject, text]) {
        expect(part).not.toContain('{{');
        expect(part).not.toMatch(/\bmail\./);
        expect(part).toContain('Casa Rossi');
      }
      expect(text.split('\n')).toContain(URL_);
      // A subject is one line.
      expect(subject).not.toContain('\n');
    }
  });

  it('keeps an instance name with line breaks out of the subject', () => {
    const { subject } = verificationMessage(tFor('en'), { ...details, instance: 'Casa\r\nBcc: x' });
    expect(subject).not.toMatch(/[\r\n]/);
  });
});
