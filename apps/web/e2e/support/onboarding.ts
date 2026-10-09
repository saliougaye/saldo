import type { Page } from '@playwright/test';
import type { Translate } from '@saldo/i18n';

/** The default path through `/onboarding`: calendar month, one checking account, every category. */
export async function finishOnboarding(
  page: Page,
  t: Translate,
  account: { name: string; balance: string } = { name: 'Conto principale', balance: '1000' },
): Promise<void> {
  await page.getByRole('button', { name: t('common.continue') }).click();
  await page.getByLabel(t('onboarding.accountName')).fill(account.name);
  await page.getByLabel(t('onboarding.accountBalance')).fill(account.balance);
  await page.getByRole('button', { name: t('common.continue') }).click();
  await page.getByRole('button', { name: t('common.start') }).click();
}
