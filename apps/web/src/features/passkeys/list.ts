export interface StoredPasskey {
  id: string;
  name: string | null;
  credentialId: string;
  aaguid: string | null;
  /** Better Auth's `backed_up`: the authenticator syncs this credential to its own cloud. */
  backedUp: boolean;
  /** ISO 8601, or null for a row Better Auth wrote without one. */
  createdAt: string | null;
}

/** Decision 9: `inUse` is the credential this browser's last ceremony used. */
export type PasskeyRow<T extends StoredPasskey = StoredPasskey> = T & { inUse: boolean };

/**
 * Newest first, undated last, with «in uso ora» on the credential this browser signed in with.
 * Generic so that whatever the page has already added to a row — the formatted «Aggiunta il …» —
 * survives the sort in the type as well as at run time.
 */
export function passkeyRows<T extends StoredPasskey>(
  passkeys: readonly T[],
  lastCredentialId: string | null,
): PasskeyRow<T>[] {
  return [...passkeys]
    .sort((a, b) => {
      if (a.createdAt === null) return b.createdAt === null ? 0 : 1;
      if (b.createdAt === null) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map((passkey) => ({
      ...passkey,
      inUse: lastCredentialId !== null && passkey.credentialId === lastCredentialId,
    }));
}

/**
 * §17.1.7: never the last one. Deleting it would lock the account out of every device at once, and
 * there is no recovery until SMTP exists (0.3f). The button says why; the Server Action refuses too.
 */
export function canDeletePasskey(total: number): boolean {
  return total > 1;
}
