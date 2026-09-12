import { z } from 'zod';
import {
  createInvite,
  DEFAULT_INVITE_TTL_DAYS,
  listInvites,
  MAX_INVITE_LABEL_LENGTH,
  MAX_INVITE_TTL_DAYS,
} from '../../../src/server/auth/invites';
import { getDb } from '../../../src/server/db/client';
import { handle } from '../../../src/server/http/errors';
import { readJson } from '../../../src/server/http/json';
import { requireAdmin } from '../../../src/server/http/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  label: z.string().trim().max(MAX_INVITE_LABEL_LENGTH).optional(),
  ttlDays: z.number().int().min(1).max(MAX_INVITE_TTL_DAYS).optional(),
});

/** §9.5. Every invite the instance has ever had, with what became of it. Never a code. */
export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    await requireAdmin(request);
    const invites = await listInvites(getDb(), new Date());
    return Response.json({ invites });
  });
}

/**
 * Mints one. The code is in this response and nowhere else — the row holds only its hash — so a
 * caller that loses it revokes the invite and mints another.
 */
export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const admin = await requireAdmin(request);
    const body = await readJson(request, createSchema);
    const label = body.label === undefined || body.label === '' ? null : body.label;
    const { code, invite } = await createInvite(getDb(), {
      label,
      ttlDays: body.ttlDays ?? DEFAULT_INVITE_TTL_DAYS,
      createdBy: admin.id,
      now: new Date(),
    });
    return Response.json({ code, invite }, { status: 201 });
  });
}
