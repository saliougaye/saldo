import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { inviteIsUsable, listInvites, MAX_INVITE_LABEL_LENGTH } from '../auth/invites';
import { invites } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { mintInvite, revokeInviteById } from './invites';
import { qrSvgPath } from './qr';

let harness: TestDatabase;
const NOW = new Date('2026-09-11T09:00:00.000Z');
const URL = 'https://saldo.example.com';

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('mintInvite', () => {
  it("returns the code, its link, the deadline and the link's QR", async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    const result = await mintInvite(
      harness.db,
      admin.userId,
      { label: '  Marco  ', ttlDays: 30 },
      NOW,
      URL,
    );
    if (!result.ok) throw new Error('expected a minted invite');
    expect(result.code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    expect(result.link).toBe(`${URL}/register?invite=${encodeURIComponent(result.code)}`);
    expect(result.expiresAt).toBe('2026-10-11T09:00:00.000Z');
    expect(result.qr).toEqual(qrSvgPath(result.link));

    // The code works, is attributed to the admin, and the label was trimmed.
    await expect(inviteIsUsable(harness.db, result.code, NOW)).resolves.toBe(true);
    const [listed] = await listInvites(harness.db, NOW);
    expect(listed).toMatchObject({ label: 'Marco', createdByName: 'Ada', status: 'active' });
  });

  it('stores no label for an empty or missing one', async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    await mintInvite(harness.db, admin.userId, { label: '   ', ttlDays: 7 }, NOW, URL);
    await mintInvite(harness.db, admin.userId, { ttlDays: 7 }, NOW, URL);
    const rows = await harness.db.select().from(invites);
    expect(rows.map((row) => row.label)).toEqual([null, null]);
  });

  it('accepts exactly 1, 7, 30 and 90 days', async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    for (const ttlDays of [1, 7, 30, 90]) {
      const result = await mintInvite(harness.db, admin.userId, { ttlDays }, NOW, URL);
      expect(result.ok).toBe(true);
    }
    for (const ttlDays of [0, 2, 14, 91, 7.5, '7', null, undefined]) {
      await expect(mintInvite(harness.db, admin.userId, { ttlDays }, NOW, URL)).resolves.toEqual({
        ok: false,
        error: 'invalid',
      });
    }
  });

  it('refuses a label that is too long, and anything that is not an object', async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    const label = 'x'.repeat(MAX_INVITE_LABEL_LENGTH + 1);
    await expect(
      mintInvite(harness.db, admin.userId, { label, ttlDays: 7 }, NOW, URL),
    ).resolves.toEqual({ ok: false, error: 'invalid' });
    await expect(
      mintInvite(
        harness.db,
        admin.userId,
        { label: 'x'.repeat(MAX_INVITE_LABEL_LENGTH), ttlDays: 7 },
        NOW,
        URL,
      ),
    ).resolves.toMatchObject({ ok: true });
    for (const raw of [null, 'x', 7, undefined, { label: 5, ttlDays: 7 }]) {
      await expect(mintInvite(harness.db, admin.userId, raw, NOW, URL)).resolves.toEqual({
        ok: false,
        error: 'invalid',
      });
    }
    // Nothing was written for the refusals.
    expect(await harness.db.select().from(invites).where(eq(invites.label, label))).toHaveLength(0);
  });
});

describe('revokeInviteById', () => {
  it('revokes an active invite and kills its code', async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    const minted = await mintInvite(harness.db, admin.userId, { ttlDays: 7 }, NOW, URL);
    if (!minted.ok) throw new Error('expected a minted invite');
    const [row] = await listInvites(harness.db, NOW);
    await expect(revokeInviteById(harness.db, row?.id ?? '', NOW)).resolves.toEqual({ ok: true });
    await expect(inviteIsUsable(harness.db, minted.code, NOW)).resolves.toBe(false);
  });

  it('says notFound when nothing was active to revoke', async () => {
    const admin = await createTestSession(harness.db, 'Ada', 'admin');
    await mintInvite(harness.db, admin.userId, { ttlDays: 7 }, NOW, URL);
    const [row] = await listInvites(harness.db, NOW);
    await revokeInviteById(harness.db, row?.id ?? '', NOW);
    await expect(revokeInviteById(harness.db, row?.id ?? '', NOW)).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
    await expect(revokeInviteById(harness.db, 'no-such-invite', NOW)).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});
