import { describe, expect, it } from 'vitest';
import type { AccountDetail, AccountSummary } from '../../server/auth/admin';
import {
  accountActions,
  accountCounts,
  accountFacts,
  accountRows,
  deleteConfirmation,
  deleteConfirmationMatches,
} from './accountsView';

const summary = (over: Partial<AccountSummary> = {}): AccountSummary => ({
  id: 'u1',
  displayName: 'Saliou Gaye',
  email: 'saliou@example.com',
  role: 'user',
  revoked: false,
  revokedReason: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  ...over,
});

const detail = (over: Partial<AccountDetail> = {}): AccountDetail => ({
  ...summary(),
  emailVerified: true,
  lastSignInAt: '2026-09-20T18:00:00.000Z',
  passkeyCount: 2,
  syncedRows: 340,
  invite: null,
  ...over,
});

describe('accountRows', () => {
  it('gives initials, name, address and role key, in the order it was given', () => {
    const rows = accountRows([
      summary({ id: 'a', displayName: 'Ada Lovelace', role: 'admin' }),
      summary({ id: 'b', displayName: 'Bob' }),
    ]);
    expect(rows).toEqual([
      {
        id: 'a',
        initials: 'AL',
        name: 'Ada Lovelace',
        email: 'saliou@example.com',
        roleKey: 'admin.roleAdmin',
        revoked: false,
      },
      {
        id: 'b',
        initials: 'BO',
        name: 'Bob',
        email: 'saliou@example.com',
        roleKey: 'admin.roleMember',
        revoked: false,
      },
    ]);
  });

  it('hides a synthetic address, which is not an address anybody can use', () => {
    const [row] = accountRows([summary({ email: 'u1@passkey.saldo.invalid' })]);
    expect(row?.email).toBeNull();
  });

  it('carries the revoked flag', () => {
    const [row] = accountRows([summary({ revoked: true })]);
    expect(row?.revoked).toBe(true);
  });
});

describe('accountCounts', () => {
  it('counts every account and the revoked ones', () => {
    expect(
      accountCounts([summary(), summary({ revoked: true }), summary({ revoked: true })]),
    ).toEqual({
      total: 3,
      revoked: 2,
    });
    expect(accountCounts([])).toEqual({ total: 0, revoked: 0 });
  });
});

const byId = (facts: ReturnType<typeof accountFacts>, id: string) =>
  facts.find((fact) => fact.id === id)?.value;

describe('accountFacts', () => {
  it('lists the seven facts in the panel order', () => {
    expect(accountFacts(detail()).map((fact) => fact.id)).toEqual([
      'role',
      'status',
      'email',
      'created',
      'lastSignIn',
      'passkeys',
      'syncedRows',
    ]);
  });

  it('says role and status, with the reason of a revocation when there is one', () => {
    expect(byId(accountFacts(detail({ role: 'admin' })), 'role')).toEqual({
      key: 'admin.roleAdmin',
    });
    expect(byId(accountFacts(detail()), 'status')).toEqual({ key: 'admin.accounts.statusActive' });
    expect(byId(accountFacts(detail({ revoked: true })), 'status')).toEqual({
      key: 'admin.accounts.statusRevoked',
    });
    expect(byId(accountFacts(detail({ revoked: true, revokedReason: 'left' })), 'status')).toEqual({
      key: 'admin.accounts.statusRevokedReason',
      vars: { reason: 'left' },
    });
  });

  it('says whether the address is verified, and that a synthetic one is no address', () => {
    expect(byId(accountFacts(detail()), 'email')).toEqual({
      key: 'admin.accounts.emailVerified',
      vars: { email: 'saliou@example.com' },
    });
    expect(byId(accountFacts(detail({ emailVerified: false })), 'email')).toEqual({
      key: 'admin.accounts.emailUnverified',
      vars: { email: 'saliou@example.com' },
    });
    expect(byId(accountFacts(detail({ email: 'x@passkey.saldo.invalid' })), 'email')).toEqual({
      key: 'admin.noEmail',
    });
  });

  it('dates the creation, naming the invite when there was one', () => {
    expect(byId(accountFacts(detail()), 'created')).toEqual({
      key: 'admin.accounts.createdOn',
      vars: { date: '2026-09-01T09:00:00.000Z' },
      dateVars: ['date'],
    });
    expect(
      byId(accountFacts(detail({ invite: { id: 'i1', label: 'Per Marco' } })), 'created'),
    ).toEqual({
      key: 'admin.accounts.createdWithInvite',
      vars: { date: '2026-09-01T09:00:00.000Z', invite: 'Per Marco' },
      dateVars: ['date'],
    });
    // An invite with no label has no name to quote.
    expect(byId(accountFacts(detail({ invite: { id: 'i1', label: null } })), 'created')).toEqual({
      key: 'admin.accounts.createdOn',
      vars: { date: '2026-09-01T09:00:00.000Z' },
      dateVars: ['date'],
    });
  });

  it('gives the last sign-in as a date, or says there is none', () => {
    expect(byId(accountFacts(detail()), 'lastSignIn')).toEqual({
      key: 'admin.accounts.signedIn',
      vars: { date: '2026-09-20T18:00:00.000Z' },
      dateVars: ['date'],
    });
    expect(byId(accountFacts(detail({ lastSignInAt: null })), 'lastSignIn')).toEqual({
      key: 'admin.accounts.neverSignedIn',
    });
  });

  it('counts passkeys and synced rows through plural keys', () => {
    expect(byId(accountFacts(detail()), 'passkeys')).toEqual({
      key: 'admin.accounts.passkeys',
      count: 2,
    });
    expect(byId(accountFacts(detail()), 'syncedRows')).toEqual({
      key: 'admin.accounts.syncedRows',
      count: 340,
    });
  });
});

describe('accountActions', () => {
  const none = { promote: false, revoke: false, restore: false, delete: false };

  it("offers nothing on one's own account, and says so", () => {
    expect(accountActions('u1', detail({ role: 'admin' }))).toEqual({ ...none, self: true });
  });

  it('offers promote, revoke and delete for an active member', () => {
    expect(accountActions('admin', detail())).toEqual({
      self: false,
      promote: true,
      revoke: true,
      restore: false,
      delete: true,
    });
  });

  it('offers no promotion to an admin', () => {
    expect(accountActions('admin', detail({ role: 'admin' }))).toMatchObject({
      promote: false,
      revoke: true,
      delete: true,
    });
  });

  it('offers restore and delete, and neither promote nor revoke, for a revoked account', () => {
    expect(accountActions('admin', detail({ revoked: true }))).toEqual({
      self: false,
      promote: false,
      revoke: false,
      restore: true,
      delete: true,
    });
  });
});

describe('deleteConfirmation', () => {
  it('asks for the address, or for the display name when the address is synthetic', () => {
    expect(deleteConfirmation(detail())).toEqual({
      kind: 'email',
      expected: 'saliou@example.com',
      labelKey: 'admin.accounts.deleteTypeEmail',
    });
    expect(deleteConfirmation(detail({ email: 'u1@passkey.saldo.invalid' }))).toEqual({
      kind: 'name',
      expected: 'Saliou Gaye',
      labelKey: 'admin.accounts.deleteTypeName',
    });
  });
});

describe('deleteConfirmationMatches', () => {
  it('ignores case and surrounding blanks', () => {
    expect(deleteConfirmationMatches('  Saliou@Example.com ', detail())).toBe(true);
  });

  it('refuses anything else, and the empty string', () => {
    expect(deleteConfirmationMatches('saliou@example.co', detail())).toBe(false);
    expect(deleteConfirmationMatches('', detail())).toBe(false);
  });

  it('compares the display name for a synthetic address, never the address itself', () => {
    const d = detail({ email: 'u1@passkey.saldo.invalid' });
    expect(deleteConfirmationMatches('saliou gaye', d)).toBe(true);
    expect(deleteConfirmationMatches('u1@passkey.saldo.invalid', d)).toBe(false);
  });
});
