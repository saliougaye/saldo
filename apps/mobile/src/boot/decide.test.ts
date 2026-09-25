import type { SyncStatus } from '../sync/scheduler';
import { type BootInput, decideBoot } from './decide';

const SYNCED: SyncStatus = { kind: 'idle', lastSyncAt: 1_700_000_000_000 };
const NEVER_SYNCED: SyncStatus = { kind: 'idle', lastSyncAt: null };
const SYNCING: SyncStatus = { kind: 'syncing' };
const FAILED: SyncStatus = {
  kind: 'error',
  code: 'network_error',
  message: 'offline',
  retryAt: 0,
};

/** A signed-in device that has finished onboarding: the ordinary case, varied by each test. */
function input(overrides: Partial<BootInput> = {}): BootInput {
  return {
    locked: false,
    session: 'signed-in',
    settingsLoaded: true,
    onboardingCompletedAt: '2026-09-01T10:00:00.000Z',
    hasSettings: true,
    hasScheduler: true,
    syncStatus: SYNCED,
    ...overrides,
  };
}

describe('decideBoot', () => {
  it('puts the lock ahead of everything, signed in or not', () => {
    expect(decideBoot(input({ locked: true }))).toEqual({ kind: 'lock' });
    expect(decideBoot(input({ locked: true, session: 'signed-out' }))).toEqual({ kind: 'lock' });
  });

  it('waits for the two reads before deciding anything', () => {
    expect(decideBoot(input({ session: 'loading' }))).toEqual({ kind: 'loading' });
    expect(decideBoot(input({ settingsLoaded: false }))).toEqual({ kind: 'loading' });
  });

  describe('a signed-out device', () => {
    const signedOut = (overrides: Partial<BootInput> = {}) =>
      decideBoot(input({ session: 'signed-out', hasScheduler: false, ...overrides }));

    it('shows the welcome when the phone holds nothing yet', () => {
      expect(signedOut({ hasSettings: false, onboardingCompletedAt: null })).toEqual({
        kind: 'welcome',
      });
    });

    it('opens the app on its own data when onboarding was finished here', () => {
      // Started on the phone (§6.29 step 0), or signed out with «Esci» (§6.30): local-only.
      expect(signedOut()).toEqual({ kind: 'tabs' });
    });

    it('resumes an onboarding that was never finished, without a server to ask', () => {
      expect(signedOut({ onboardingCompletedAt: null })).toEqual({ kind: 'onboarding' });
    });

    it('never waits for a sync nobody is signed in to run', () => {
      expect(signedOut({ syncStatus: SYNCING })).toEqual({ kind: 'tabs' });
    });
  });

  it('opens the app when the settings are here and onboarding was finished', () => {
    expect(decideBoot(input())).toEqual({ kind: 'tabs' });
  });

  it('resumes an onboarding that was never finished', () => {
    expect(decideBoot(input({ onboardingCompletedAt: null }))).toEqual({ kind: 'onboarding' });
  });

  describe('a device holding no settings', () => {
    const empty = (overrides: Partial<BootInput> = {}) =>
      decideBoot(input({ hasSettings: false, onboardingCompletedAt: null, ...overrides }));

    it('waits while the first cycle is still running or has never run', () => {
      expect(empty({ syncStatus: SYNCING })).toEqual({ kind: 'waiting-for-sync' });
      expect(empty({ syncStatus: NEVER_SYNCED })).toEqual({ kind: 'waiting-for-sync' });
    });

    it('starts onboarding once a cycle has come back with nothing', () => {
      // The only evidence that an account is new: somebody asked its server and it said so.
      expect(empty({ syncStatus: SYNCED })).toEqual({ kind: 'onboarding' });
    });

    it('does not start onboarding when the server could not be reached', () => {
      // The account may have years of data on it. An empty database here is equally what a phone
      // that has never synced looks like, and onboarding would seed over the lot.
      expect(empty({ syncStatus: FAILED })).toEqual({
        kind: 'sync-unreachable',
        code: 'network_error',
      });
    });

    it('does not start onboarding when the session is over', () => {
      expect(empty({ syncStatus: { kind: 'session-expired' } })).toEqual({
        kind: 'sync-unreachable',
        code: 'session-expired',
      });
    });

    it('starts onboarding on a build with no sync at all', () => {
      // Local-only: there is no server to ask, so an empty database is all the evidence there is.
      expect(empty({ hasScheduler: false, syncStatus: NEVER_SYNCED })).toEqual({
        kind: 'onboarding',
      });
    });
  });

  it('opens the app for a device whose settings arrived by sync, without onboarding it', () => {
    // The case that prompted all of this: signing in to an account that already exists. Its
    // settings come down the first pull, completion stamp and all, and there is nothing to ask.
    expect(
      decideBoot(input({ hasSettings: true, onboardingCompletedAt: '2026-05-04T08:00:00.000Z' })),
    ).toEqual({ kind: 'tabs' });
  });
});
