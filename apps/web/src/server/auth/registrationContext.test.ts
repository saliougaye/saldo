import { describe, expect, it } from 'vitest';
import { encodeRegistrationContext, readRegistrationContext } from './registrationContext';

describe('registration context', () => {
  it('round-trips a name and a code', () => {
    const encoded = encodeRegistrationContext({ name: 'Marco', invite: '7GQ4-XM2B-PDVT-9NKS' });
    expect(readRegistrationContext(encoded)).toEqual({
      name: 'Marco',
      invite: '7GQ4-XM2B-PDVT-9NKS',
    });
  });

  it('trims the name and reports an empty one as empty', () => {
    expect(readRegistrationContext(encodeRegistrationContext({ name: '  Ada  ' })).name).toBe('Ada');
    expect(readRegistrationContext(encodeRegistrationContext({ name: '   ' })).name).toBe('');
  });

  it('reads the exact wire format the browser form writes', () => {
    // Pinned on purpose: `MobileAuth.tsx` is a client component and builds this string with its
    // own `JSON.stringify` rather than importing from `src/server`. This test is what stops the
    // two from drifting apart.
    expect(readRegistrationContext('{"name":"Marco","invite":"7GQ4-XM2B-PDVT-9NKS"}')).toEqual({
      name: 'Marco',
      invite: '7GQ4-XM2B-PDVT-9NKS',
    });
  });

  it('reads a bare string as a name with no code', () => {
    // What the form sent before invites existed. Under `invite` it fails the code check, which is
    // the right answer; under the other modes it keeps working.
    expect(readRegistrationContext('Marco')).toEqual({ name: 'Marco', invite: null });
  });

  it('reads nothing, and rubbish, as an empty name with no code', () => {
    expect(readRegistrationContext(null)).toEqual({ name: '', invite: null });
    expect(readRegistrationContext(undefined)).toEqual({ name: '', invite: null });
    expect(readRegistrationContext('{"name":')).toEqual({ name: '{"name":', invite: null });
    expect(readRegistrationContext('{"name":42}')).toEqual({ name: '', invite: null });
  });
});
