import { headers } from 'next/headers';
import { publicI18n } from '../../src/i18n/server';
import { offlineHtml } from '../../src/pwa/offlinePage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The page the service worker keeps for a navigation with no network. Public: it names nobody and
 * reads no session, only `Accept-Language` (which `publicI18n` reads through `headers()`).
 */
export async function GET(): Promise<Response> {
  await headers();
  const { locale, t } = await publicI18n();
  return new Response(offlineHtml(locale, t), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // The worker fetches it again on every install (a new version); the browser need not keep its own copy.
      'Cache-Control': 'no-cache',
      Vary: 'Accept-Language',
    },
  });
}
