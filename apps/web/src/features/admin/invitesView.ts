import { isSyntheticEmail } from '../../server/auth/email';
import type { InviteStatus, InviteSummary } from '../../server/auth/invites';
import type { AdminMessage } from './message';

export interface InviteRowView {
  id: string;
  /** Null when the owner wrote none: the page shows `admin.invites.noLabel`. */
  label: string | null;
  status: InviteStatus;
  /** The word on the trailing side, e.g. `admin.invites.statusActive`. */
  statusKey: string;
  /** Every status but `active` is muted: the row is history. */
  muted: boolean;
  /** Carries raw ISO instants (see `AdminMessage.dateVars`); the page formats them. */
  subtitle: AdminMessage;
}

/** The address a used invite shows: none for a synthetic one, which is never displayed. */
export function usedByAddress(invite: Pick<InviteSummary, 'usedByEmail'>): string | null {
  const email = invite.usedByEmail;
  return email === null || isSyntheticEmail(email) ? null : email;
}

function subtitle(invite: InviteSummary): AdminMessage {
  switch (invite.status) {
    case 'active':
      return {
        key: 'admin.invites.subActive',
        vars: { created: invite.createdAt, expires: invite.expiresAt },
        dateVars: ['created', 'expires'],
      };
    case 'used': {
      // `used_at` is written before the account exists and `used_by` after (see `burnInvite`), and
      // the account may be deleted later: a used invite can honestly have nobody's name on it.
      const date = invite.usedAt ?? invite.createdAt;
      const email = usedByAddress(invite);
      return email === null
        ? { key: 'admin.invites.subUsedAnonymous', vars: { date }, dateVars: ['date'] }
        : {
            key: 'admin.invites.subUsed',
            vars: { date, email },
            dateVars: ['date'],
          };
    }
    case 'revoked':
      return {
        key: 'admin.invites.subRevoked',
        vars: { date: invite.revokedAt ?? invite.createdAt },
        dateVars: ['date'],
      };
    case 'expired':
      return {
        key: 'admin.invites.subExpired',
        vars: { date: invite.expiresAt },
        dateVars: ['date'],
      };
  }
}

const STATUS_KEYS: Record<InviteStatus, string> = {
  active: 'admin.invites.statusActive',
  used: 'admin.invites.statusUsed',
  revoked: 'admin.invites.statusRevoked',
  expired: 'admin.invites.statusExpired',
};

/** Admin → Inviti: one row per invite, in the order `listInvites` gives (newest first). */
export function inviteRows(invites: readonly InviteSummary[]): InviteRowView[] {
  return invites.map((invite) => ({
    id: invite.id,
    label: invite.label,
    status: invite.status,
    statusKey: STATUS_KEYS[invite.status],
    muted: invite.status !== 'active',
    subtitle: subtitle(invite),
  }));
}

/** The count in the sub-navigation: only what can still be used. */
export function activeInviteCount(invites: readonly InviteSummary[]): number {
  return invites.filter((invite) => invite.status === 'active').length;
}

export type InvitePanel = { kind: 'new' } | { kind: 'invite'; invite: InviteSummary } | null;

type Param = string | string[] | undefined;

const first = (param: Param): string | undefined => (Array.isArray(param) ? param[0] : param);

/**
 * Which panel the URL opens. `?new` (which arrives as an empty string, so it is tested for being
 * present, not for being truthy) wins over `?i=`; an id that names nothing opens nothing.
 */
export function invitePanel(
  params: { new?: Param; i?: Param },
  invites: readonly InviteSummary[],
): InvitePanel {
  if (params.new !== undefined) return { kind: 'new' };
  const id = first(params.i);
  const invite = id === undefined ? undefined : invites.find((candidate) => candidate.id === id);
  return invite === undefined ? null : { kind: 'invite', invite };
}
