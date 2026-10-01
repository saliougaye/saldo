import type { MetadataRoute } from 'next';
import { buildManifest } from '../src/pwa/manifest';
import { getDb } from '../src/server/db/client';
import { instanceName } from '../src/server/settings/serverSettings';

export const runtime = 'nodejs';
/** The instance name can change in `/admin/settings`, so the manifest is read per request, not at build. */
export const dynamic = 'force-dynamic';

const FALLBACK_NAME = 'Saldo';

/**
 * Public by design — a browser fetches it without credentials — and it holds nothing the sign-in page
 * does not already show. A database that is down must not make the app uninstallable, hence the fallback.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  try {
    return buildManifest(await instanceName(getDb()));
  } catch {
    return buildManifest(FALLBACK_NAME);
  }
}
