import { serviceWorkerSource } from '../../src/pwa/serviceWorker';
import { APP_VERSION } from '../../src/server/version';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

/**
 * Served from the root so its scope is `/`. `no-cache` makes the browser revalidate it on every
 * update check, which is how a new version of the worker (a new cache name) ever reaches a phone.
 */
export function GET(): Response {
  return new Response(serviceWorkerSource(APP_VERSION), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
