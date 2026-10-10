export interface AuthMessage {
  titleKey: string;
  bodyKey: string;
}

/**
 * What the browser and `@simplewebauthn` call "the person closed the window". A closed prompt rejects
 * with `NotAllowedError`, and `@simplewebauthn/browser` wraps that as a `WebAuthnError` whose code is
 * `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY` — the code Better Auth's client hands on.
 */
const CANCELLED = new Set([
  'AUTH_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
  'REGISTRATION_CANCELLED',
  'NotAllowedError',
]);

const BY_CODE: Record<string, AuthMessage> = {
  email_taken: { titleKey: 'web.auth.emailTakenTitle', bodyKey: 'web.auth.emailTakenBody' },
  email_required: { titleKey: 'web.auth.emailInvalid', bodyKey: 'web.auth.emailHint' },
  invalid_invite: {
    titleKey: 'web.auth.invalidInviteTitle',
    bodyKey: 'web.auth.invalidInviteBody',
  },
  registration_closed: { titleKey: 'web.auth.closedTitle', bodyKey: 'web.auth.closedBody' },
  display_name_required: {
    titleKey: 'web.auth.nameRequiredTitle',
    bodyKey: 'web.auth.nameRequiredBody',
  },
  handoff_failed: {
    titleKey: 'web.auth.handoffFailedTitle',
    bodyKey: 'web.auth.handoffFailedBody',
  },
};

/** Which field a refusal belongs to, so the step marks that one and not its neighbour. */
export function fieldForErrorCode(code: string | undefined): 'name' | 'email' | 'invite' | null {
  if (code === 'display_name_required') return 'name';
  if (code === 'email_required' || code === 'email_taken') return 'email';
  if (code === 'invalid_invite') return 'invite';
  return null;
}

/**
 * The two i18n keys an error becomes. Deliberately not the server's `message`: it is English, written
 * for a log, and the page has seven languages. An unrecognised code is one sentence and the hint that
 * covers the commonest real cause — a browser with no passkey on it.
 */
export function describeAuthError(code: string | undefined): AuthMessage {
  if (code !== undefined && CANCELLED.has(code)) {
    return { titleKey: 'sync.cancelled', bodyKey: 'web.auth.cancelledBody' };
  }
  return (
    (code === undefined ? undefined : BY_CODE[code]) ?? {
      titleKey: 'web.auth.genericError',
      bodyKey: 'web.auth.crossDeviceHint',
    }
  );
}
