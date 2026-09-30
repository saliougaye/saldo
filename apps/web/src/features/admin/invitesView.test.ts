import { describe, expect, it } from 'vitest';
import type { InviteSummary } from '../../server/auth/invites';
import { activeInviteCount, invitePanel, inviteRows } from './invitesView';

const invite = (over: Partial<InviteSummary> = {}): InviteSummary => ({
  id: 'i1',
  label: 'Marco',
  createdAt: '2026-09-01T09:00:00.000Z',
  expiresAt: '2026-09-08T09:00:00.000Z',
  usedAt: null,
  usedBy: null,
  revokedAt: null,
  status: 'active',
  createdByName: 'Ada',
  usedByEmail: null,
  ...over,
});

describe('inviteRows', () => {
  it('keeps the order it was given and the label as it is (null included)', () => {
    const rows = inviteRows([invite({ id: 'a' }), invite({ id: 'b', label: null })]);
    expect(rows.map((row) => [row.id, row.label])).toEqual([
      ['a', 'Marco'],
      ['b', null],
    ]);
  });

  it('says created and expires for an active invite, which is not muted', () => {
    const [row] = inviteRows([invite()]);
    expect(row).toMatchObject({
      status: 'active',
      statusKey: 'admin.invites.statusActive',
      muted: false,
      subtitle: {
        key: 'admin.invites.subActive',
        vars: { created: '2026-09-01T09:00:00.000Z', expires: '2026-09-08T09:00:00.000Z' },
        dateVars: ['created', 'expires'],
      },
    });
  });

  it('says when and by whom a used invite was spent', () => {
    const [row] = inviteRows([
      invite({
        status: 'used',
        usedAt: '2026-09-03T10:00:00.000Z',
        usedBy: 'u2',
        usedByEmail: 'marco@example.com',
      }),
    ]);
    expect(row).toMatchObject({
      statusKey: 'admin.invites.statusUsed',
      muted: true,
      subtitle: {
        key: 'admin.invites.subUsed',
        vars: { date: '2026-09-03T10:00:00.000Z', email: 'marco@example.com' },
        dateVars: ['date'],
      },
    });
  });

  it('drops the name when the account that spent it has none to show', () => {
    const [row] = inviteRows([
      invite({ status: 'used', usedAt: '2026-09-03T10:00:00.000Z', usedByEmail: null }),
    ]);
    expect(row?.subtitle).toEqual({
      key: 'admin.invites.subUsedAnonymous',
      vars: { date: '2026-09-03T10:00:00.000Z' },
      dateVars: ['date'],
    });
  });

  it('dates a revoked invite by its revocation and an expired one by its deadline', () => {
    const rows = inviteRows([
      invite({ status: 'revoked', revokedAt: '2026-09-02T08:00:00.000Z' }),
      invite({ status: 'expired' }),
    ]);
    expect(rows[0]).toMatchObject({
      statusKey: 'admin.invites.statusRevoked',
      muted: true,
      subtitle: {
        key: 'admin.invites.subRevoked',
        vars: { date: '2026-09-02T08:00:00.000Z' },
        dateVars: ['date'],
      },
    });
    expect(rows[1]).toMatchObject({
      statusKey: 'admin.invites.statusExpired',
      muted: true,
      subtitle: {
        key: 'admin.invites.subExpired',
        vars: { date: '2026-09-08T09:00:00.000Z' },
        dateVars: ['date'],
      },
    });
  });
});

describe('activeInviteCount', () => {
  it('counts only the invites that can still be used', () => {
    expect(
      activeInviteCount([
        invite(),
        invite({ status: 'used' }),
        invite({ status: 'revoked' }),
        invite({ status: 'expired' }),
        invite(),
      ]),
    ).toBe(2);
  });
});

describe('invitePanel', () => {
  const list = [invite({ id: 'a' }), invite({ id: 'b' })];

  it('opens the form for ?new, even with a value or an id beside it', () => {
    expect(invitePanel({ new: '' }, list)).toEqual({ kind: 'new' });
    expect(invitePanel({ new: '', i: 'a' }, list)).toEqual({ kind: 'new' });
  });

  it('opens the invite ?i= names', () => {
    expect(invitePanel({ i: 'b' }, list)).toEqual({ kind: 'invite', invite: list[1] });
  });

  it('opens nothing for an id that names nothing, or for no query', () => {
    expect(invitePanel({ i: 'zzz' }, list)).toBeNull();
    expect(invitePanel({}, list)).toBeNull();
  });

  it('reads the first value when a parameter is repeated', () => {
    expect(invitePanel({ i: ['a', 'b'] }, list)).toEqual({ kind: 'invite', invite: list[0] });
  });
});
