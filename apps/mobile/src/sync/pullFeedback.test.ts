import { pullFeedbackKey } from './pullFeedback';

describe('pullFeedbackKey', () => {
  it('says nothing when the cycle worked: what it brought is already on screen', () => {
    expect(pullFeedbackKey({ kind: 'idle', lastSyncAt: 1 })).toBeNull();
  });

  it('says the sync failed when the server could not be reached', () => {
    expect(
      pullFeedbackKey({ kind: 'error', code: 'network_error', message: 'offline', retryAt: 5 }),
    ).toBe('sync.pullFailed');
  });

  it('names a schema mismatch, which no amount of pulling will fix', () => {
    expect(
      pullFeedbackKey({ kind: 'error', code: 'schema_too_old', message: '', retryAt: 5 }),
    ).toBe('sync.schemaTooOld');
    expect(
      pullFeedbackKey({ kind: 'error', code: 'schema_too_new', message: '', retryAt: 5 }),
    ).toBe('sync.schemaTooNew');
  });

  it('tells an expired session apart from a failure', () => {
    expect(pullFeedbackKey({ kind: 'session-expired' })).toBe('sync.sessionExpired');
  });
});
