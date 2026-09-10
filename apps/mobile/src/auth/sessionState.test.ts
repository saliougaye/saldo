import { decideSession } from './sessionState';

describe('decideSession', () => {
  it('signs in when the server returns a session', () => {
    expect(decideSession({ kind: 'answered', hasSession: true, hasError: false })).toBe(
      'signed-in',
    );
  });

  it('signs out only when the server answers with no session and no error', () => {
    expect(decideSession({ kind: 'answered', hasSession: false, hasError: false })).toBe(
      'signed-out',
    );
  });

  it('keeps the cached session when the call never got an answer', () => {
    // The offline case: being unable to ask must not cost the user access to their own data.
    expect(decideSession({ kind: 'unreachable' })).toBe('keep-cached');
  });

  it('keeps the cached session when the answer carries an error', () => {
    expect(decideSession({ kind: 'answered', hasSession: false, hasError: true })).toBe(
      'keep-cached',
    );
  });
});
