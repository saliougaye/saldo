import { describe, expect, it } from 'vitest';
import { encodeRegistrationContext, readRegistrationContext } from './registrationContext';

describe('registration context', () => {
  it('round-trips a name and a code', () => {
    const encoded = encodeRegistrationContext({
      name: 'Marco',
      email: '',
      invite: '7GQ4-XM2B-PDVT-9NKS',
    });
    expect(readRegistrationContext(encoded)).toEqual({
      name: 'Marco',
      email: '',
      invite: '7GQ4-XM2B-PDVT-9NKS',
    });
  });

  it('trims the name and reports an empty one as empty', () => {
    expect(
      readRegistrationContext(encodeRegistrationContext({ name: '  Ada  ', email: '' })).name,
    ).toBe('Ada');
    expect(
      readRegistrationContext(encodeRegistrationContext({ name: '   ', email: '' })).name,
    ).toBe('');
  });

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

  it('reads a bare string as a name with no code', () => {
    // What the form sent before invites existed. Under `invite` it fails the code check, which is
    // the right answer; under the other modes it keeps working.
    expect(readRegistrationContext('Marco')).toEqual({ name: 'Marco', email: '', invite: null });
  });

  it('reads nothing, and rubbish, as an empty name with no code', () => {
    expect(readRegistrationContext(null)).toEqual({ name: '', email: '', invite: null });
    expect(readRegistrationContext(undefined)).toEqual({ name: '', email: '', invite: null });
    expect(readRegistrationContext('{"name":')).toEqual({
      name: '{"name":',
      email: '',
      invite: null,
    });
    expect(readRegistrationContext('{"name":42}')).toEqual({ name: '', email: '', invite: null });
  });
});

describe('the email of a registration', () => {
  it('travels in the context, trimmed', () => {
    expect(
      readRegistrationContext(JSON.stringify({ name: 'Ada', email: ' Ada@Example.com ' })),
    ).toEqual({ name: 'Ada', email: 'Ada@Example.com', invite: null });
  });

  it('is empty when the client sent none, which the caller refuses', () => {
    expect(readRegistrationContext(JSON.stringify({ name: 'Ada' }))).toEqual({
      name: 'Ada',
      email: '',
      invite: null,
    });
  });

  it('is in the literal shape the client writes by hand', () => {
    expect(
      encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com', invite: 'CODE' }),
    ).toBe('{"name":"Ada","email":"ada@example.com","invite":"CODE"}');
  });
});
