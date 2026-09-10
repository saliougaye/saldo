import { handle } from '../../../src/server/http/errors';
import { requireUser } from '../../../src/server/http/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser(request, new Date());
    return Response.json(user);
  });
}
