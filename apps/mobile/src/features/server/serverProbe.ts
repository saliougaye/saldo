import { normaliseServerUrl } from '../../auth/link';
import type { ServerHealth } from '../../auth/session';
import { ApiClientError } from '../../net/apiClient';

/**
 * The server step of §6.29 (and §6.30), as data. Kept pure so the order of events — an answer
 * landing after «Cambia», a second failure on «Riprova» — is decided here and tested, not in a
 * component.
 */

/** What the line under the address field says while the user types. */
export type AddressHint =
  | { kind: 'idle' }
  | { kind: 'will-connect'; origin: string }
  | { kind: 'invalid' };

export function addressHint(input: string): AddressHint {
  if (input.trim().length === 0) return { kind: 'idle' };
  const origin = normaliseServerUrl(input);
  return origin === null ? { kind: 'invalid' } : { kind: 'will-connect', origin };
}

export type FailureReason = 'unreachable' | 'not_saldo';

/** `checkServer` throws `not_saldo` for an answer that is not Saldo's; anything else is "no answer". */
export function failureReason(caught: unknown): FailureReason {
  return caught instanceof ApiClientError && caught.code === 'not_saldo'
    ? 'not_saldo'
    : 'unreachable';
}

export type ProbeState =
  | { kind: 'editing' }
  | { kind: 'checking'; origin: string; attempts: number }
  | { kind: 'found'; origin: string; health: ServerHealth }
  | { kind: 'failed'; origin: string; reason: FailureReason; attempts: number };

export type ProbeEvent =
  | { type: 'submit'; origin: string }
  | { type: 'answered'; health: ServerHealth }
  | { type: 'failed'; reason: FailureReason }
  | { type: 'retry' }
  | { type: 'change' };

export const initialProbe: ProbeState = { kind: 'editing' };

export function probeReducer(state: ProbeState, event: ProbeEvent): ProbeState {
  switch (event.type) {
    case 'submit':
      return { kind: 'checking', origin: event.origin, attempts: 0 };
    case 'answered':
      return state.kind === 'checking'
        ? { kind: 'found', origin: state.origin, health: event.health }
        : state;
    case 'failed':
      return state.kind === 'checking'
        ? {
            kind: 'failed',
            origin: state.origin,
            reason: event.reason,
            attempts: state.attempts + 1,
          }
        : state;
    case 'retry':
      return state.kind === 'failed'
        ? { kind: 'checking', origin: state.origin, attempts: state.attempts }
        : state;
    case 'change':
      return initialProbe;
  }
}
