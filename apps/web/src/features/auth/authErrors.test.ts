import { describe, expect, it } from 'vitest';
import { describeAuthError } from './authErrors';

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
