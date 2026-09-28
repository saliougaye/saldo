import { describe, expect, it } from 'vitest';
import {
  encodeRegistrationContext,
  readRegistrationContext,
} from '../../server/auth/registrationContext';
import { registrationContextJson } from './registrationBody';

describe('registrationContextJson', () => {
  it('writes exactly what the server writes', () => {
    expect(registrationContextJson({ name: 'Ada', email: 'ada@example.com', invite: 'CODE' })).toBe(
      encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com', invite: 'CODE' }),
    );
  });

  it('leaves the invite out when there is none', () => {
    expect(registrationContextJson({ name: 'Ada', email: 'ada@example.com', invite: null })).toBe(
      encodeRegistrationContext({ name: 'Ada', email: 'ada@example.com' }),
    );
  });

  it('round-trips through the reader', () => {
    expect(
      readRegistrationContext(
        registrationContextJson({ name: ' Ada ', email: ' ada@example.com ', invite: ' CODE ' }),
      ),
    ).toEqual({ name: 'Ada', email: 'ada@example.com', invite: 'CODE' });
  });
});
