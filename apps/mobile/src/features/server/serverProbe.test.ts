import { initialProbe, probeReducer } from './serverProbe';

const HEALTH = {
  app: 'saldo' as const,
  apiVersion: 1,
  schemaVersion: 12,
  version: '0.3.1',
  registrationAllowed: true,
  attachmentsEnabled: false,
};

describe('probeReducer', () => {
  it('ignores an answer that arrives after «Cambia»', () => {
    expect(probeReducer(initialProbe, { type: 'answered', health: HEALTH })).toEqual(initialProbe);
    expect(probeReducer(initialProbe, { type: 'failed', reason: 'unreachable' })).toEqual(
      initialProbe,
    );
  });
});
