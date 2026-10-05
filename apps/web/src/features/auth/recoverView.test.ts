import { describe, expect, it } from 'vitest';
import { recoverAnswer, recoveryVerifyPath } from './recoverView';

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

describe('recoveryVerifyPath', () => {
  it("is the library's verify endpoint with our own two callbacks, and nothing else", () => {
    expect(recoveryVerifyPath('a+b/c')).toBe(
      '/api/auth/magic-link/verify?token=a%2Bb%2Fc' +
        '&callbackURL=%2Fprofile%2Fpasskeys%3Frecovered&errorCallbackURL=%2Frecover',
    );
  });
});
