import { describe, expect, it } from 'vitest';
import { describeAuthError, fieldForErrorCode } from './authErrors';

describe('describeAuthError', () => {
  it('names the server’s own refusals', () => {
    expect(describeAuthError('email_taken')).toEqual({
      titleKey: 'web.auth.emailTakenTitle',
      bodyKey: 'web.auth.emailTakenBody',
    });
    expect(describeAuthError('invalid_invite')).toEqual({
      titleKey: 'web.auth.invalidInviteTitle',
      bodyKey: 'web.auth.invalidInviteBody',
    });
    expect(describeAuthError('registration_closed')).toEqual({
      titleKey: 'web.auth.closedTitle',
      bodyKey: 'web.auth.closedBody',
    });
    expect(describeAuthError('email_required')).toEqual({
      titleKey: 'web.auth.emailInvalid',
      bodyKey: 'web.auth.emailHint',
    });
  });

  it('says the name is missing when it is the name that is missing', () => {
    expect(describeAuthError('display_name_required')).toEqual({
      titleKey: 'web.auth.nameRequiredTitle',
      bodyKey: 'web.auth.nameRequiredBody',
    });
  });

  it('tells an account that exists that only the handoff failed', () => {
    expect(describeAuthError('handoff_failed')).toEqual({
      titleKey: 'web.auth.handoffFailedTitle',
      bodyKey: 'web.auth.handoffFailedBody',
    });
  });

  it('treats every way of abandoning a ceremony as one cancellation', () => {
    for (const code of [
      'AUTH_CANCELLED',
      'ERROR_CEREMONY_ABORTED',
      'REGISTRATION_CANCELLED',
      'NotAllowedError',
    ]) {
      expect(describeAuthError(code)).toEqual({
        titleKey: 'sync.cancelled',
        bodyKey: 'web.auth.cancelledBody',
      });
    }
  });

  it('falls back to one sentence for anything it has not met', () => {
    expect(describeAuthError('TOO_MANY_REQUESTS')).toEqual({
      titleKey: 'web.auth.genericError',
      bodyKey: 'web.auth.crossDeviceHint',
    });
    expect(describeAuthError(undefined)).toEqual({
      titleKey: 'web.auth.genericError',
      bodyKey: 'web.auth.crossDeviceHint',
    });
  });
});

describe('fieldForErrorCode', () => {
  it('marks the field the refusal is about', () => {
    expect(fieldForErrorCode('display_name_required')).toBe('name');
    expect(fieldForErrorCode('email_required')).toBe('email');
    expect(fieldForErrorCode('email_taken')).toBe('email');
    expect(fieldForErrorCode('invalid_invite')).toBe('invite');
  });

  it('marks none when the refusal is not about a field', () => {
    expect(fieldForErrorCode('registration_closed')).toBeNull();
    expect(fieldForErrorCode('NotAllowedError')).toBeNull();
    expect(fieldForErrorCode(undefined)).toBeNull();
  });
});
