import type { ReactNode } from 'react';
import { SettingsPage } from './SettingsPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** W10: Profile is its frame — the head, the grouped menu, the section (`SettingsPage`). */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <SettingsPage>{children}</SettingsPage>;
}
