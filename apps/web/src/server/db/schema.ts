import {
  type AnyPgColumn,
  bigint,
  boolean,
  customType,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * `bytea` for the credential public key. Drizzle has no built-in column for it, and the two
 * drivers disagree on the value they hand back (`Buffer` from `pg`, `Uint8Array` from PGlite), so
 * the codec normalises both to `Uint8Array` — which is also what `@simplewebauthn/server` wants.
 */
// `Uint8Array<ArrayBuffer>` and not a plain `Uint8Array`: that is the exact type
// `@simplewebauthn/server` takes for a credential public key, and `new Uint8Array(...)` below is
// what narrows a driver's view of the bytes to it.
const bytea = customType<{ data: Uint8Array<ArrayBuffer>; driverData: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return new Uint8Array(value);
  },
});

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  createdAt,
});

export const passkeys = pgTable(
  'passkeys',
  {
    /** Credential id, base64url — the identifier the authenticator itself returns. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: bytea('public_key').notNull(),
    counter: bigint('counter', { mode: 'number' }).notNull(),
    transports: text('transports').array(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    createdAt,
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [index('passkeys_user_id_idx').on(table.userId)],
);

export const webauthnChallenges = pgTable('webauthn_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  challenge: text('challenge').notNull(),
  /** Null for a login ceremony: a discoverable credential names the user, not the server. */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  /**
   * The name a registration ceremony was started with. §9.1 does not list it, but binding the name
   * to the challenge is what keeps the verify step from having to trust a second client-supplied
   * copy of it. Null for a login ceremony.
   */
  displayName: text('display_name'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt,
});

export const authCodes = pgTable('auth_codes', {
  /** sha256(code), base64url. The code itself is never stored. */
  codeHash: text('code_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeChallenge: text('code_challenge').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt,
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256(token), base64url. */
    tokenHash: text('token_hash').notNull().unique(),
    deviceName: text('device_name').notNull(),
    createdAt,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** The token this one was rotated into; the chain a reuse revokes (§9.3 step 6). */
    replacedBy: uuid('replaced_by').references((): AnyPgColumn => refreshTokens.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [index('refresh_tokens_user_id_idx').on(table.userId)],
);

export const syncRows = pgTable(
  'sync_rows',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entity: text('entity').notNull(),
    id: text('id').notNull(),
    /** HLC, compared lexicographically — which is why it is text and not a timestamp. */
    updatedAt: text('updated_at').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    data: jsonb('data').notNull(),
    /** From `sync_seq`; the cursor a client pulls from (§8.4). */
    seq: bigint('seq', { mode: 'number' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entity, table.id] }),
    index('sync_rows_user_seq').on(table.userId, table.seq),
  ],
);

export const schema = {
  users,
  passkeys,
  webauthnChallenges,
  authCodes,
  refreshTokens,
  syncRows,
};
