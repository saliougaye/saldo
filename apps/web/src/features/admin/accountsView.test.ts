import { describe, expect, it } from 'vitest';
import type { AccountDetail } from '../../server/auth/admin';
import { deleteConfirmation, deleteConfirmationMatches } from './accountsView';

const detail = (over: Partial<AccountDetail> = {}): AccountDetail => ({
  id: 'u1',
  displayName: 'Saliou Gaye',
  email: 'saliou@example.com',
  role: 'user',
  revoked: false,
  revokedReason: null,
  createdAt: '2026-09-01T09:00:00.000Z',
  emailVerified: true,
  lastSignInAt: '2026-09-20T18:00:00.000Z',
  passkeyCount: 2,
  syncedRows: 340,
  invite: null,
  ...over,
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
  it('compares the display name for a synthetic address, never the address itself', () => {
    const d = detail({ email: 'u1@passkey.saldo.invalid' });
    expect(deleteConfirmationMatches('saliou gaye', d)).toBe(true);
    expect(deleteConfirmationMatches('u1@passkey.saldo.invalid', d)).toBe(false);
  });
});
