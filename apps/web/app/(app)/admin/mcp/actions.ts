'use server';

import { revalidatePath } from 'next/cache';
import { requireWebAdmin } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { type SettingsWriteResult, saveMcpEnabled } from '../../../../src/server/settings/write';

/**
 * §17.4.1: `mcp.enabled`, saved as the switch is flipped (Decision 13). The admin is resolved here,
 * first — a layout does not run for a Server Action. `locked` (under `MCP_ENABLED`) and `invalid`
 * are decided by `saveMcpEnabled`, not by what the page showed. Profilo › Connettori shows the
 * switch's state too, so it is revalidated with the admin pages.
 */
export async function saveMcpEnabledAction(enabled: unknown): Promise<SettingsWriteResult> {
  const admin = await requireWebAdmin();
  const result = await saveMcpEnabled(getDb(), admin.id, enabled, new Date());
  if (result.ok) {
    revalidatePath('/admin', 'layout');
    revalidatePath('/profile/connectors');
  }
  return result;
}
