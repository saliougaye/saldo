import { z } from 'zod';
import { createInvite, MAX_INVITE_LABEL_LENGTH, revokeInvite } from '../auth/invites';
import type { ServerDatabase } from '../db/types';
import { log, shortId } from '../log';
import { qrSvgPath } from './qr';

/** What «Scade dopo» offers; the server accepts nothing else, whatever a caller posts. */
export const INVITE_TTL_CHOICES = [1, 7, 30, 90] as const;

const mintSchema = z.object({
  label: z
    .string()
    .trim()
    .max(MAX_INVITE_LABEL_LENGTH)
    .transform((value) => (value === '' ? null : value))
    .optional(),
  ttlDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]),
});

export type MintResult =
  | {
      ok: true;
      /** The one moment it exists in the clear: it goes to the panel's state and nowhere else. */
      code: string;
      link: string;
      expiresAt: string;
      qr: { size: number; path: string };
    }
  | { ok: false; error: 'invalid' };

/**
 * §17.1.7. `raw` is whatever the Server Action was posted, so it is validated here. `publicUrl`
 * is passed in rather than read from `env()`, so the link is testable and the action decides.
 */
export async function mintInvite(
  db: ServerDatabase,
  actorId: string,
  raw: unknown,
  now: Date,
  publicUrl: string,
): Promise<MintResult> {
  const parsed = mintSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { code, invite } = await createInvite(db, {
    label: parsed.data.label ?? null,
    ttlDays: parsed.data.ttlDays,
    createdBy: actorId,
    now,
  });
  log('admin', 'invite minted', { by: shortId(actorId), invite: shortId(invite.id) });
  const link = `${publicUrl}/register?invite=${encodeURIComponent(code)}`;
  return { ok: true, code, link, expiresAt: invite.expiresAt, qr: qrSvgPath(link) };
}

export type RevokeInviteResult = { ok: true } | { ok: false; error: 'notFound' };

export async function revokeInviteById(
  db: ServerDatabase,
  id: string,
  now: Date,
): Promise<RevokeInviteResult> {
  return (await revokeInvite(db, id, now)) ? { ok: true } : { ok: false, error: 'notFound' };
}

/**
 * What `mintInviteAction` returns: the mint result plus the expiry as a date in the admin's zone and
 * language, so the panel (a client component, with no formatter or zone of its own) can say it.
 */
export type MintActionResult =
  | (Extract<MintResult, { ok: true }> & { expiresOn: string })
  | Extract<MintResult, { ok: false }>;
