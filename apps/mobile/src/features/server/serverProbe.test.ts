import { ApiClientError } from '../../net/apiClient';
import { addressHint, failureReason, initialProbe, probeReducer } from './serverProbe';

const HEALTH = {
  app: 'saldo' as const,
  apiVersion: 1,
  schemaVersion: 12,
  version: '0.3.1',
  registrationAllowed: true,
  attachmentsEnabled: false,
};

describe('addressHint', () => {
  it('shows the example while the field is empty', () => {
    expect(addressHint('')).toEqual({ kind: 'idle' });
    expect(addressHint('   ')).toEqual({ kind: 'idle' });
  });

  it('previews the origin it will connect to', () => {
    expect(addressHint('saldo.example.org')).toEqual({
      kind: 'will-connect',
      origin: 'https://saldo.example.org',
    });
  });

  it('asks for only the address when there is a path', () => {
    expect(addressHint('saldo.example.org/login')).toEqual({ kind: 'invalid' });
  });
});

describe('failureReason', () => {
  it('tells "not Saldo" apart from everything else', () => {
    expect(failureReason(new ApiClientError(502, 'not_saldo', 'x'))).toBe('not_saldo');
    expect(failureReason(new ApiClientError(503, 'unreachable', 'x'))).toBe('unreachable');
    expect(failureReason(new Error('boom'))).toBe('unreachable');
  });
});

describe('probeReducer', () => {
  const origin = 'https://saldo.example.org';

  it('goes from editing to checking to found', () => {
    const checking = probeReducer(initialProbe, { type: 'submit', origin });
    expect(checking).toEqual({ kind: 'checking', origin, attempts: 0 });
    expect(probeReducer(checking, { type: 'answered', health: HEALTH })).toEqual({
      kind: 'found',
      origin,
      health: HEALTH,
    });
  });

  it('keeps the address and counts attempts across retries', () => {
    const failed = probeReducer(
      { kind: 'checking', origin, attempts: 0 },
      { type: 'failed', reason: 'unreachable' },
    );
    expect(failed).toEqual({ kind: 'failed', origin, reason: 'unreachable', attempts: 1 });
    const retrying = probeReducer(failed, { type: 'retry' });
    expect(retrying).toEqual({ kind: 'checking', origin, attempts: 1 });
    expect(probeReducer(retrying, { type: 'failed', reason: 'unreachable' })).toEqual({
      kind: 'failed',
      origin,
      reason: 'unreachable',
      attempts: 2,
    });
  });

  it('goes back to the field on «Cambia», from any state', () => {
    expect(probeReducer({ kind: 'found', origin, health: HEALTH }, { type: 'change' })).toEqual(
      initialProbe,
    );
    expect(
      probeReducer(
        { kind: 'failed', origin, reason: 'not_saldo', attempts: 1 },
        { type: 'change' },
      ),
    ).toEqual(initialProbe);
  });

  it('ignores an answer that arrives after «Cambia»', () => {
    expect(probeReducer(initialProbe, { type: 'answered', health: HEALTH })).toEqual(initialProbe);
    expect(probeReducer(initialProbe, { type: 'failed', reason: 'unreachable' })).toEqual(
      initialProbe,
    );
  });

  it('only retries a failure', () => {
    expect(probeReducer(initialProbe, { type: 'retry' })).toEqual(initialProbe);
  });
});
