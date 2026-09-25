import { readHealth } from './health';

const HEALTH = {
  app: 'saldo',
  apiVersion: 1,
  schemaVersion: 12,
  version: '0.3.1',
  registrationAllowed: false,
};

describe('readHealth', () => {
  it('is unreachable when nothing answered at all', () => {
    expect(readHealth(null, null)).toEqual({ kind: 'unreachable' });
  });

  it('is unreachable when a server errors: a Saldo behind a proxy may just be down', () => {
    expect(readHealth(502, '<html>Bad Gateway</html>')).toEqual({ kind: 'unreachable' });
    expect(readHealth(503, null)).toEqual({ kind: 'unreachable' });
  });

  it('is not Saldo when something answered without a health route', () => {
    // Most websites: `/api/health` is a 404 page.
    expect(readHealth(404, '<html>Not found</html>')).toEqual({ kind: 'not_saldo' });
    expect(readHealth(401, null)).toEqual({ kind: 'not_saldo' });
  });

  it('is not Saldo when the route answers something else', () => {
    expect(readHealth(200, { status: 'ok' })).toEqual({ kind: 'not_saldo' });
    expect(readHealth(200, { ...HEALTH, app: 'immich' })).toEqual({ kind: 'not_saldo' });
    expect(readHealth(200, null)).toEqual({ kind: 'not_saldo' });
  });

  it('reads a Saldo health answer, defaulting a field older servers lack', () => {
    expect(readHealth(200, HEALTH)).toEqual({
      kind: 'saldo',
      health: { ...HEALTH, attachmentsEnabled: false },
    });
  });
});
