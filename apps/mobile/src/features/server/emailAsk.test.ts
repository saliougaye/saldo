import { emailLooksValid, needsEmail } from './emailAsk';

describe('needsEmail', () => {
  it('is true for an account still on the synthetic address of §9.1', () => {
    expect(needsEmail({ id: 'u1', displayName: 'Ada', email: 'u1@passkey.saldo.invalid' })).toBe(
      true,
    );
  });

  it('is false once the account has a real one', () => {
    expect(needsEmail({ id: 'u1', displayName: 'Ada', email: 'ada@example.com' })).toBe(false);
  });

  it('is false when there is no account at all', () => {
    expect(needsEmail(null)).toBe(false);
  });
});

describe('emailLooksValid', () => {
  it('accepts an address', () => {
    expect(emailLooksValid(' Ada@Example.com ')).toBe(true);
  });

  it('refuses what the server would refuse', () => {
    for (const input of ['', 'ada', 'ada@', '@example.com', 'a b@example.com']) {
      expect(emailLooksValid(input)).toBe(false);
    }
  });
});
