import { describe, expect, it } from 'vitest';
import { emailRowState } from './emailRow';

const real = 'ada@example.com';
const synthetic = 'abc@passkey.saldo.invalid';

describe('emailRowState', () => {
  it('is verified whatever mail does', () => {
    expect(emailRowState({ email: real, emailVerified: true, mailEnabled: false })).toBe(
      'verified',
    );
    expect(emailRowState({ email: real, emailVerified: true, mailEnabled: true })).toBe('verified');
  });

  it('offers the button for an unverified real address when mail is on', () => {
    expect(emailRowState({ email: real, emailVerified: false, mailEnabled: true })).toBe(
      'canVerify',
    );
  });

  it('says the server sends no email when it does not', () => {
    expect(emailRowState({ email: real, emailVerified: false, mailEnabled: false })).toBe(
      'mailOff',
    );
  });

  it('says nothing about a synthetic address, verified flag or not', () => {
    expect(emailRowState({ email: synthetic, emailVerified: false, mailEnabled: true })).toBe(
      'synthetic',
    );
    expect(emailRowState({ email: synthetic, emailVerified: false, mailEnabled: false })).toBe(
      'synthetic',
    );
  });
});
