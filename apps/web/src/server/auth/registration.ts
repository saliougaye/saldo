import { APIError } from 'better-auth/api';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode } from '../env';
import { log, shortId } from '../log';
import { claimRoleForNewUser } from './admin';
import { emailIsTaken, normaliseEmail } from './email';
import { attributeInvite, burnInvite, inviteIsUsable, releaseInvite } from './invites';
import { registrationAllowed, registrationRequiresInvite } from './policy';
import type { RegistrationContext } from './registrationContext';

/** The half of Better Auth's internal adapter these functions use, injected so they can be tested. */
export interface UserStore {
  findUserById(id: string): Promise<{ id: string; email: string } | null>;
  createUser(input: { id: string; name: string; email: string }): Promise<{ id: string }>;
}

export interface ResolvedRegistration {
  id: string;
  name: string;
  email: string;
}

function refuse(status: 'BAD_REQUEST' | 'FORBIDDEN' | 'CONFLICT', code: string, message: string) {
  return new APIError(status, { code, message });
}

/**
 * The passkey plugin's `resolveUser`: it runs **before** the ceremony, decides the WebAuthn user
 * handle, and is where the registration policy is enforced. No row is written here — the account is
 * created in `completeRegistration` — so a ceremony the user abandons leaves nothing behind, and the
 * invite is only *checked*, never spent, for the same reason.
 */
export async function resolveRegistration(
  db: ServerDatabase,
  options: { mode: RegistrationMode; context: RegistrationContext; now: Date },
): Promise<ResolvedRegistration> {
  const { mode, context, now } = options;
  if (!(await registrationAllowed(db, mode))) {
    throw refuse('FORBIDDEN', 'registration_closed', 'This server is not accepting new accounts');
  }
  if (context.name.length === 0) {
    throw refuse('BAD_REQUEST', 'display_name_required', 'Choose a name first');
  }
  const email = normaliseEmail(context.email);
  if (email === null) {
    throw refuse('BAD_REQUEST', 'email_required', 'Enter a valid email address');
  }
  // The invite is checked **first**, and on purpose. «This email already has an account» tells a
  // caller which addresses are registered (decision 7 in the plan, a deliberate trade), and what
  // bounds that answer is that an instance which is not open refuses before giving it. `closed` is
  // refused by `registrationAllowed` above; `invite` is refused here — so on neither can a caller
  // without a usable code probe the address list.
  if (registrationRequiresInvite(mode) && !(await inviteIsUsable(db, context.invite ?? '', now))) {
    // One answer for unknown, spent, revoked and expired: the form must not be usable to find out
    // which codes exist.
    throw refuse('FORBIDDEN', 'invalid_invite', 'That invite code is not valid');
  }
  // D32: an identifier, not a credential — and one account per address, so this is checked before
  // the ceremony rather than after it.
  if (await emailIsTaken(db, email)) {
    throw refuse('CONFLICT', 'email_taken', 'That email already has an account');
  }
  return { id: crypto.randomUUID(), name: context.name, email };
}

/**
 * The passkey plugin's `afterVerification`: the plugin never creates users — it needs a `userId` to
 * name one that already exists — so the account is written here, with the id the ceremony used as
 * its handle.
 *
 * **When there is a session, the plugin skips `resolveUser` and still calls this** (its
 * `resolveRegistrationUser`), which is what «add a passkey» from Profile does. So an id that already
 * names an account means "another passkey for this account": nothing to create, no policy to apply,
 * no invite to spend.
 */
export async function completeRegistration(
  db: ServerDatabase,
  options: {
    mode: RegistrationMode;
    context: RegistrationContext;
    resolved: { id: string; name: string };
    store: UserStore;
    now: Date;
  },
): Promise<{ userId: string }> {
  const { mode, context, resolved, store, now } = options;
  const existing = await store.findUserById(resolved.id);
  if (existing !== null) return { userId: existing.id };

  if (!(await registrationAllowed(db, mode))) {
    throw refuse('FORBIDDEN', 'registration_closed', 'This server is not accepting new accounts');
  }
  const email = normaliseEmail(context.email);
  if (email === null) {
    throw refuse('BAD_REQUEST', 'email_required', 'Enter a valid email address');
  }

  /**
   * Spend the code **before** writing the account. Two ceremonies holding the same code reach this
   * line together; the burn is a conditional UPDATE, so exactly one of them gets an id and the other
   * is refused. The other way round would create both accounts and then refuse one, leaving an orphan.
   */
  let burnedInviteId: string | null = null;
  if (registrationRequiresInvite(mode)) {
    burnedInviteId = await burnInvite(db, context.invite ?? '', now);
    if (burnedInviteId === null) {
      throw refuse('FORBIDDEN', 'invalid_invite', 'That invite code is not valid');
    }
  }

  // Only the write of the account itself is guarded this way. What follows it cannot be undone by
  // giving the code back — the row exists, so the code really is spent.
  let created: { id: string };
  try {
    created = await store.createUser({ id: resolved.id, name: resolved.name, email });
  } catch (error) {
    // The account was not created, so the code was not really used: give it back rather than leave
    // the person holding one that never worked.
    if (burnedInviteId !== null) await releaseInvite(db, burnedInviteId);
    // The unique index on `email` is the real guard against two accounts on one address — the check
    // in `resolveRegistration` can be overtaken by a ceremony that started a moment earlier. When
    // that is what happened, say so in the words the form knows. `resolved.id` is excluded because
    // a half-written row of this very registration must not be read as somebody else's account.
    if (await emailIsTaken(db, email, resolved.id)) {
      throw refuse('CONFLICT', 'email_taken', 'That email already has an account');
    }
    throw error;
  }

  /**
   * §9.5: the first account on the instance is the admin, and under `invite` it can only exist
   * because somebody with shell access minted its code. Every later one is a member. This runs
   * **after** the row exists, because the claim is decided by "is the earliest account mine"
   * rather than by the table being empty — see `claimRoleForNewUser`, which takes a lock so two
   * ceremonies finishing together cannot both win, and cannot both lose either.
   *
   * Neither this nor the invite's attribution may fail the registration: the account exists and
   * holds its owner's address, so throwing here would leave a person who can never register again
   * with that address and no passkey to sign in with. A missing role is recoverable (`user promote`,
   * which the self-hosting notes already document); a lost account is not.
   */
  try {
    await claimRoleForNewUser(db, created.id);
  } catch (error) {
    log('auth', 'the new account was written but its role was not claimed', {
      user: shortId(created.id),
      error: String(error),
    });
  }
  try {
    // Now that the row exists, the invite can say whose it was. Last, and on purpose: `used_by`
    // points at `user`, and it is a record rather than a decision.
    if (burnedInviteId !== null) await attributeInvite(db, burnedInviteId, created.id);
  } catch (error) {
    log('auth', 'the invite was spent but not attributed', {
      user: shortId(created.id),
      error: String(error),
    });
  }
  return { userId: created.id };
}
