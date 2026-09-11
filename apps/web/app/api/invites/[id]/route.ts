import { revokeInvite } from '../../../../src/server/auth/invites';
import { getDb } from '../../../../src/server/db/client';
import { ApiError, handle } from '../../../../src/server/http/errors';
import { requireAdmin } from '../../../../src/server/http/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Revoking is not deleting: the row stays, so the owner can still see that a code was minted for
 * somebody and withdrawn. An invite that was already used stays `used` — revoking it would be a
 * lie about what happened, and it is `deleteUser` that removes the account it created.
 */
export function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    await requireAdmin(request);
    const { id } = await params;
    const revoked = await revokeInvite(getDb(), id, new Date());
    if (!revoked) throw new ApiError(404, 'not_found', 'No such invite');
    return Response.json({ ok: true });
  });
}
