import type { ReactNode } from 'react';
import { requireWebAdmin } from '../../../src/server/auth/currentUser';
import { SettingsPage } from '../profile/SettingsPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * W10, open item 1: Admin keeps its routes and takes Profile's frame, where it is the last group of
 * the menu. The guard is here, before anything streams, and in every page and Server Action: a
 * layout does not run for an action, and a page can render without it.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireWebAdmin();
  return <SettingsPage>{children}</SettingsPage>;
}
