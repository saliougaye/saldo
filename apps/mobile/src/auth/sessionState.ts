/**
 * What to do with a stored session after asking the server about it.
 *
 * Kept as a pure function because it decides whether a user gets signed out, and the difference
 * between "the server rejected this session" and "the server could not be reached" is exactly the
 * difference between a correct sign-out and locking someone out of their own offline data.
 */
export type SessionDecision = 'signed-in' | 'signed-out' | 'keep-cached';

/** A `getSession()` answer, or the fact that the call never got one. */
export type SessionProbe =
  | { kind: 'answered'; hasSession: boolean; hasError: boolean }
  | { kind: 'unreachable' };

export function decideSession(probe: SessionProbe): SessionDecision {
  // No answer at all: the cached session stands. This is the offline case.
  if (probe.kind === 'unreachable') return 'keep-cached';
  if (probe.hasSession) return 'signed-in';
  // An empty answer *with* an error is a transport problem dressed as a result; only an empty
  // answer with no error is the server actually saying "this session is not valid".
  return probe.hasError ? 'keep-cached' : 'signed-out';
}
