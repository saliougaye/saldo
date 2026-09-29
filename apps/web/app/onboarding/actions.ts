'use server';

import { headers } from 'next/headers';
import { webLocale } from '../../src/i18n/locale';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { getDb } from '../../src/server/db/client';
import { finishWebOnboarding, type OnboardingResult } from '../../src/server/write/onboarding';

/**
 * «Inizia» (§17.1.3). The account has no settings yet, so its language is `system`: the browser's
 * order names the seed categories, as `userI18n` resolves the page they were picked on.
 */
export async function finishOnboardingAction(draft: unknown): Promise<OnboardingResult> {
  const user = await requireWebUser();
  const locale = webLocale('system', (await headers()).get('accept-language'));
  return finishWebOnboarding(getDb(), user.id, draft, locale, new Date());
}
