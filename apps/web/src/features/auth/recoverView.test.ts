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

  it('adds the expired-link line when the library sent the browser back with ?error=link', () => {
    expect(recoverState({ mailEnabled: true, error: 'link' })).toBe('expiredLink');
  });

  it('ignores any other ?error= value', () => {
    expect(recoverState({ mailEnabled: true, error: 'INVALID_TOKEN' })).toBe('form');
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
