import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { inviteIsUsable, listInvites } from '../auth/invites';
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
});
