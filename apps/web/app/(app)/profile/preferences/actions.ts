'use server';

import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { getDb } from '../../../../src/server/db/client';
import { type SettingResult, saveSetting } from '../../../../src/server/write/settings';

export async function saveSettingAction(input: unknown): Promise<SettingResult> {
  const user = await requireWebUser();
  return saveSetting(getDb(), user.id, input, new Date());
}
