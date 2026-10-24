import { type AccountDetail, type AccountSummary, ADMIN_ROLE } from '../../server/auth/admin';
import { isSyntheticEmail } from '../../server/auth/email';
import { initials } from '../../ui/initials';
import { confirmationMatches } from './confirmation';
import type { AdminMessage } from './message';

const roleKey = (role: string) => (role === ADMIN_ROLE ? 'admin.roleAdmin' : 'admin.roleMember');

export interface AccountRowView {
  id: string;
  initials: string;
  name: string;
  /** Null for a synthetic address: the page shows `admin.noEmail` instead of `…@passkey.saldo.invalid`. */
  email: string | null;
  /**
   * The second line (spec §06): «email · verificata» or «email · non verificata», and
   * `admin.noEmail` for a synthetic address.
   */
  subtitle: AdminMessage;
  /** `admin.roleAdmin` or `admin.roleMember`. */
  roleKey: string;
  revoked: boolean;
  /** Under the role: «ultimo accesso 12 set», or that the account never signed in. */
  lastSignIn: AdminMessage;
}

/** The address with its state, as the row and the panel say it. */
function emailMessage(account: Pick<AccountDetail, 'email' | 'emailVerified'>): AdminMessage {
  if (isSyntheticEmail(account.email)) return { key: 'admin.noEmail' };
  return {
    key: account.emailVerified ? 'admin.accounts.emailVerified' : 'admin.accounts.emailUnverified',
    vars: { email: account.email },
  };
}

/** Admin → Account (§17.1.7): one row per account, in the order `accountDetails` gives (oldest first). */
export function accountRows(accounts: readonly AccountDetail[]): AccountRowView[] {
  return accounts.map((account) => ({
    id: account.id,
    initials: initials(account.displayName),
    name: account.displayName,
    email: isSyntheticEmail(account.email) ? null : account.email,
    subtitle: emailMessage(account),
    roleKey: roleKey(account.role),
    revoked: account.revoked,
    lastSignIn:
      account.lastSignInAt === null
        ? { key: 'admin.accounts.rowNeverSignedIn' }
        : {
            key: 'admin.accounts.rowSignedIn',
            vars: { date: account.lastSignInAt },
            dateVars: ['date'],
          },
  }));
}

/** The section's trailing text is «{total} account · {revoked} revocati», the second part omitted at 0. */
export function accountCounts(accounts: readonly AccountSummary[]): {
  total: number;
  revoked: number;
} {
  return { total: accounts.length, revoked: accounts.filter((account) => account.revoked).length };
}

export interface AccountFact {
  id: 'role' | 'status' | 'email' | 'created' | 'lastSignIn' | 'passkeys' | 'syncedRows';
  labelKey: string;
  value: AdminMessage;
}

/** The fact list of an account's panel, in the order it is shown. */
export function accountFacts(detail: AccountDetail): AccountFact[] {
  const createdDate = { date: detail.createdAt };
  const inviteLabel = detail.invite?.label ?? null;
  return [
    { id: 'role', labelKey: 'admin.role', value: { key: roleKey(detail.role) } },
    {
      id: 'status',
      labelKey: 'admin.accounts.status',
      value: !detail.revoked
        ? { key: 'admin.accounts.statusActive' }
        : detail.revokedReason === null
          ? { key: 'admin.accounts.statusRevoked' }
          : { key: 'admin.accounts.statusRevokedReason', vars: { reason: detail.revokedReason } },
    },
    { id: 'email', labelKey: 'admin.accounts.email', value: emailMessage(detail) },
    {
      id: 'created',
      labelKey: 'admin.accounts.created',
      value:
        inviteLabel === null
          ? { key: 'admin.accounts.createdOn', vars: createdDate, dateVars: ['date'] }
          : {
              key: 'admin.accounts.createdWithInvite',
              vars: { ...createdDate, invite: inviteLabel },
              dateVars: ['date'],
            },
    },
    {
      id: 'lastSignIn',
      labelKey: 'admin.accounts.lastSignIn',
      value:
        detail.lastSignInAt === null
          ? { key: 'admin.accounts.neverSignedIn' }
          : {
              key: 'admin.accounts.signedIn',
              vars: { date: detail.lastSignInAt },
              dateVars: ['date'],
            },
    },
    {
      id: 'passkeys',
      labelKey: 'admin.accounts.passkeysLabel',
      value: { key: 'admin.accounts.passkeys', count: detail.passkeyCount },
    },
    {
      id: 'syncedRows',
      labelKey: 'admin.accounts.syncedRowsLabel',
      value: { key: 'admin.accounts.syncedRows', count: detail.syncedRows },
    },
  ];
}

export interface AccountActions {
  /** One's own account: the panel shows the facts and `admin.accounts.selfNote`, no buttons. */
  self: boolean;
  promote: boolean;
  revoke: boolean;
  restore: boolean;
  delete: boolean;
}

/**
 * What the panel offers. Nothing for one's own account — which, since only an admin gets here, is
 * also what keeps the instance from losing its last admin. There is no demotion: the spec has none.
 */
export function accountActions(actorId: string, detail: AccountDetail): AccountActions {
  if (detail.id === actorId) {
    return { self: true, promote: false, revoke: false, restore: false, delete: false };
  }
  return {
    self: false,
    promote: detail.role !== ADMIN_ROLE && !detail.revoked,
    revoke: !detail.revoked,
    restore: detail.revoked,
    delete: true,
  };
}

export interface DeleteConfirmation {
  kind: 'email' | 'name';
  /** What must be typed, as stored: the comparison is what ignores case and blanks. */
  expected: string;
  /** The dialog's field label; it says which of the two is being asked for. */
  labelKey: 'admin.accounts.deleteTypeEmail' | 'admin.accounts.deleteTypeName';
}

/**
 * An account with a synthetic address is confirmed by its display name: the address is never
 * shown (`accountRows`), so it cannot be asked for.
 */
export function deleteConfirmation(
  account: Pick<AccountDetail, 'email' | 'displayName'>,
): DeleteConfirmation {
  return isSyntheticEmail(account.email)
    ? { kind: 'name', expected: account.displayName, labelKey: 'admin.accounts.deleteTypeName' }
    : { kind: 'email', expected: account.email, labelKey: 'admin.accounts.deleteTypeEmail' };
}

/** The dialog enables its button with this, and the Server Action checks again with the same one. */
export function deleteConfirmationMatches(
  typed: string,
  account: Pick<AccountDetail, 'email' | 'displayName'>,
): boolean {
  return confirmationMatches(typed, deleteConfirmation(account).expected);
}
