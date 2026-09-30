import { describe, expect, it } from 'vitest';
import { recoverAnswer, recoverState } from './recoverView';

describe('recoverState', () => {
  it('says recovery is unavailable when the server sends no mail, whatever the query', () => {
    expect(recoverState({ mailEnabled: false, error: undefined })).toBe('unavailable');
    expect(recoverState({ mailEnabled: false, error: 'link' })).toBe('unavailable');
  });

  it('shows the form when mail is on', () => {
    expect(recoverState({ mailEnabled: true, error: undefined })).toBe('form');
  });

  it('adds the expired-link line for whatever ?error= the library sent the browser back with', () => {
    // Better Auth replaces the query of `errorCallbackURL` with its own code.
    for (const error of ['INVALID_TOKEN', 'new_user_signup_disabled', 'BANNED_USER', 'link']) {
      expect(recoverState({ mailEnabled: true, error })).toBe('expiredLink');
    }
  });

  it('shows the plain form for an empty ?error=', () => {
    expect(recoverState({ mailEnabled: true, error: '' })).toBe('form');
  });
});

describe('recoverAnswer', () => {
  it('is the same sentence when the call worked', () => {
    expect(recoverAnswer(null)).toBe('sent');
  });

  it('is the same sentence for an unknown address, a server error or a network failure', () => {
    expect(recoverAnswer({ status: 404 })).toBe('sent');
    expect(recoverAnswer({ status: 500 })).toBe('sent');
    expect(recoverAnswer({ status: 0 })).toBe('sent');
    expect(recoverAnswer({})).toBe('sent');
  });

  it('only a rate limit says something else', () => {
    expect(recoverAnswer({ status: 429 })).toBe('rateLimited');
  });
});
