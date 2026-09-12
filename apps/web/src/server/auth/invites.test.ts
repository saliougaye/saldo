import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { invites, user } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import {
  attributeInvite,
  burnInvite,
  createInvite,
  inviteIsUsable,
  listInvites,
  releaseInvite,
  revokeInvite,
} from './invites';

let harness: TestDatabase;

const NOW = new Date('2026-09-11T09:00:00.000Z');
const LATER = new Date('2026-09-12T09:00:00.000Z');

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('createInvite', () => {
  it('returns the code once and stores only its hash', async () => {
    const { code, invite } = await createInvite(harness.db, {
      label: 'Marco',
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    expect(invite.label).toBe('Marco');
    expect(invite.status).toBe('active');
    expect(invite.expiresAt).toBe('2026-09-18T09:00:00.000Z');

    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    // Nothing in the row resembles the code that was handed out.
    expect(JSON.stringify(row)).not.toContain(code.slice(0, 4));
  });

  it('records who minted it when there was somebody to record', async () => {
    const { userId } = await createTestSession(harness.db);
    const { invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 1,
      createdBy: userId,
      now: NOW,
    });
    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.createdBy).toBe(userId);
  });
});

describe('inviteIsUsable', () => {
  it('accepts the code whatever way it is typed', async () => {
    const { code } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await expect(inviteIsUsable(harness.db, code, NOW)).resolves.toBe(true);
    await expect(inviteIsUsable(harness.db, code.toLowerCase(), NOW)).resolves.toBe(true);
    await expect(inviteIsUsable(harness.db, code.replace(/-/g, ' '), NOW)).resolves.toBe(true);
  });

  it('refuses an unknown code', async () => {
    await expect(inviteIsUsable(harness.db, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', NOW)).resolves.toBe(false);
    await expect(inviteIsUsable(harness.db, '', NOW)).resolves.toBe(false);
  });

  it('refuses a code at the instant it expires, not a second after', async () => {
    const { code } = await createInvite(harness.db, {
      label: null,
      ttlDays: 1,
      createdBy: null,
      now: NOW,
    });
    const deadline = new Date('2026-09-12T09:00:00.000Z');
    await expect(inviteIsUsable(harness.db, code, new Date(deadline.getTime() - 1))).resolves.toBe(
      true,
    );
    // RFC 7519's rule, and the one phase 06's review had to fix everywhere: reject **on** the
    // deadline, not after it.
    await expect(inviteIsUsable(harness.db, code, deadline)).resolves.toBe(false);
  });

  it('refuses a revoked code and a spent one', async () => {
    const revoked = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await revokeInvite(harness.db, revoked.invite.id, NOW);
    await expect(inviteIsUsable(harness.db, revoked.code, NOW)).resolves.toBe(false);

    const spent = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await burnInvite(harness.db, spent.code, NOW);
    await expect(inviteIsUsable(harness.db, spent.code, NOW)).resolves.toBe(false);
  });
});

describe('burnInvite', () => {
  it('spends a code before the account it will create exists', async () => {
    // The order the ceremony actually uses: burn, **then** write the user. `used_by` has a foreign
    // key to `user`, so filling it here would refuse every first registration on an empty
    // instance — which is the one registration that has to work. Attribution comes afterwards,
    // through `attributeInvite`.
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    const users = await harness.db.select().from(user);
    expect(users).toHaveLength(0);

    await expect(burnInvite(harness.db, code, NOW)).resolves.toBe(invite.id);

    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedAt?.toISOString()).toBe(NOW.toISOString());
    // Spent, with nobody named yet — and already unusable, which is what makes the burn the burn.
    expect(row?.usedBy).toBeNull();
    await expect(inviteIsUsable(harness.db, code, NOW)).resolves.toBe(false);
  });

  it('works exactly once', async () => {
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });

    await expect(burnInvite(harness.db, code, NOW)).resolves.toBe(invite.id);
    await expect(burnInvite(harness.db, code, NOW)).resolves.toBeNull();

    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it('records who spent it, once that account exists', async () => {
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await burnInvite(harness.db, code, NOW);
    const ada = await createTestSession(harness.db, 'Ada');

    await attributeInvite(harness.db, invite.id, ada.userId);

    const [row] = await harness.db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.usedBy).toBe(ada.userId);
    // Still spent: attribution is a record, not a second chance.
    await expect(inviteIsUsable(harness.db, code, NOW)).resolves.toBe(false);
  });

  it('lets only one of two ceremonies racing on the same code through', async () => {
    const { code } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    // The burn is one conditional UPDATE, so Postgres serialises them on the row lock. A
    // read-then-write would let both of these return an id.
    const results = await Promise.all([
      burnInvite(harness.db, code, NOW),
      burnInvite(harness.db, code, NOW),
    ]);
    expect(results.filter((result) => result !== null)).toHaveLength(1);
  });

  it('refuses an expired, revoked or unknown code', async () => {
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 1,
      createdBy: null,
      now: NOW,
    });
    await expect(burnInvite(harness.db, code, LATER)).resolves.toBeNull();
    await revokeInvite(harness.db, invite.id, NOW);
    await expect(burnInvite(harness.db, code, NOW)).resolves.toBeNull();
    await expect(burnInvite(harness.db, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ', NOW)).resolves.toBeNull();
  });
});

describe('releaseInvite', () => {
  it('gives a burned invite back when the account was never created', async () => {
    const { userId } = await createTestSession(harness.db);
    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await burnInvite(harness.db, code, NOW);
    await attributeInvite(harness.db, invite.id, userId);
    await releaseInvite(harness.db, invite.id);
    await expect(inviteIsUsable(harness.db, code, NOW)).resolves.toBe(true);
  });
});

describe('listInvites', () => {
  it('reports a status for each and never a code', async () => {
    const { userId } = await createTestSession(harness.db);
    const active = await createInvite(harness.db, {
      label: 'active',
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    const used = await createInvite(harness.db, {
      label: 'used',
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    const revoked = await createInvite(harness.db, {
      label: 'revoked',
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await createInvite(harness.db, {
      label: 'expired',
      ttlDays: 1,
      createdBy: null,
      now: NOW,
    });
    await burnInvite(harness.db, used.code, NOW);
    await attributeInvite(harness.db, used.invite.id, userId);
    await revokeInvite(harness.db, revoked.invite.id, NOW);

    const rows = await listInvites(harness.db, LATER);
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    expect(byLabel.get('active')?.status).toBe('active');
    expect(byLabel.get('used')?.status).toBe('used');
    expect(byLabel.get('used')?.usedBy).toBe(userId);
    expect(byLabel.get('revoked')?.status).toBe('revoked');
    expect(byLabel.get('expired')?.status).toBe('expired');
    expect(JSON.stringify(rows)).not.toContain(active.code.slice(0, 4));
  });

  it('puts the newest first', async () => {
    await createInvite(harness.db, { label: 'old', ttlDays: 7, createdBy: null, now: NOW });
    await createInvite(harness.db, { label: 'new', ttlDays: 7, createdBy: null, now: LATER });
    const rows = await listInvites(harness.db, LATER);
    expect(rows.map((row) => row.label)).toEqual(['new', 'old']);
  });
});

describe('revokeInvite', () => {
  it('reports whether there was anything to revoke, and leaves a spent invite spent', async () => {
    const { invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await expect(revokeInvite(harness.db, 'no-such-invite', NOW)).resolves.toBe(false);
    await expect(revokeInvite(harness.db, invite.id, NOW)).resolves.toBe(true);

    const spent = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: NOW,
    });
    await burnInvite(harness.db, spent.code, NOW);
    // Revoking a used invite changes nothing about the account it created; the status stays
    // `used`, because that is what happened.
    await revokeInvite(harness.db, spent.invite.id, NOW);
    const rows = await listInvites(harness.db, NOW);
    expect(rows.find((row) => row.id === spent.invite.id)?.status).toBe('used');
  });
});
