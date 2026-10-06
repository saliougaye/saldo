import { describe, expect, it } from 'vitest';
import { encodeRegistrationContext, readRegistrationContext } from './registrationContext';

describe('registration context', () => {
  it('reads the exact wire format the browser form writes', () => {
    // Pinned on purpose: `MobileAuth.tsx` is a client component and builds this string with its
    // own `JSON.stringify` rather than importing from `src/server`. This test is what stops the
    // two from drifting apart.
    expect(readRegistrationContext('{"name":"Marco","invite":"7GQ4-XM2B-PDVT-9NKS"}')).toEqual({
      name: 'Marco',
      email: '',
      invite: '7GQ4-XM2B-PDVT-9NKS',
    });
  });
});

describe('the email of a registration', () => {
  it('is in the literal shape the client writes by hand', () => {
    expect(
      encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com', invite: 'CODE' }),
    ).toBe('{"name":"Ada","email":"ada@example.com","invite":"CODE"}');
  });
});
