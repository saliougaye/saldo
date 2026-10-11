import { handle } from '../../../src/server/http/errors';
import { requireUser } from '../../../src/server/http/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { id, displayName, email, emailVerified } = await requireUser(request);
    // The fields by name: `AuthenticatedUser` also carries `role`, which the phone does not read.
    return Response.json({ id, displayName, email, emailVerified });
  });
}
