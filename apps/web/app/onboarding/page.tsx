import {
  accountTypeSchema,
  COMMON_CURRENCY_CODES,
  CURRENCY_CODES,
  type CurrencyCode,
  PERIOD_KINDS,
  PICKABLE_SEED_CATEGORIES,
} from '@saldo/core';
import { currencyName } from '@saldo/i18n';
import { accountTypeIcons, type IconName } from '@saldo/ui';
import { redirect } from 'next/navigation';
import { userI18n } from '../../src/i18n/server';
import { requireWebUser } from '../../src/server/auth/currentUser';
import { env } from '../../src/server/env';
import { pageInstanceInfo } from '../../src/server/page/instanceSettings';
import { loadUserData } from '../../src/server/userData/load';
import { todayFor } from '../../src/server/userData/today';
import styles from '../(auth)/auth.module.css';
import { OnboardingFlow } from './OnboardingFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.3, decision 11 of 0.3e-1: a web-first account's first screen. Every page under `(app)`
 * sends an account with no settings here (`readPage`), and this one sends an onboarded account
 * home — a phone may have finished it meanwhile. Everything the flow shows is resolved here: the
 * client gets plain strings and plain data, never a catalog.
 */
export default async function OnboardingPage() {
  const user = await requireWebUser();
  const data = await loadUserData(user.id);
  if (data.settings !== null) redirect('/home');
  const { t, locale } = await userI18n(user.id);
  const instance = await pageInstanceInfo();
  // No settings, so no zone of theirs yet: the instance's, for the period's preview line only.
  const { today } = todayFor(null, env().defaultTimeZone, new Date());

  const common: readonly CurrencyCode[] = COMMON_CURRENCY_CODES;
  const currencies = [
    ...common.map((code) => ({ code, group: t('currencyPicker.common') })),
    ...CURRENCY_CODES.filter((code) => !common.includes(code)).map((code) => ({
      code,
      group: t('currencyPicker.all'),
    })),
  ].map(({ code, group }) => ({ value: code, label: currencyName(code, locale), group }));

  return (
    <div className={styles.column}>
      <OnboardingFlow
        instance={instance}
        locale={locale}
        today={today}
        stepLabels={[1, 2, 3].map((current) => t('onboarding.step', { current, total: 3 }))}
        strings={{
          periodTitle: t('onboarding.periodTitle'),
          periodBody: t('onboarding.periodBody'),
          periodTimeline: t('onboarding.periodTimeline'),
          cycleTitle: t('onboarding.cycleTitle'),
          cycleDay: t('period.cycleStartDay'),
          cycleTimeline: t('onboarding.cycleTimeline'),
          accountTitle: t('onboarding.accountTitle'),
          accountBody: t('onboarding.accountBody'),
          accountName: t('onboarding.accountName'),
          accountNamePlaceholder: t('onboarding.accountNamePlaceholder'),
          accountType: t('onboarding.accountType'),
          accountCurrency: t('onboarding.accountCurrency'),
          accountBalance: t('onboarding.accountBalance'),
          categoriesTitle: t('onboarding.categoriesTitle'),
          categoriesBody: t('onboarding.categoriesBody'),
          categoriesSelected: t('onboarding.categoriesSelected'),
          continue: t('common.continue'),
          back: t('common.back'),
          start: t('common.start'),
          working: t('common.loading'),
          error: t('web.auth.genericError'),
        }}
        periodKinds={PERIOD_KINDS.map((kind) => ({
          value: kind,
          label: t(`period.kind_${kind}`),
          body: t(`period.kindBody_${kind}`),
        }))}
        accountTypes={accountTypeSchema.exclude(['pocket']).options.map((type) => ({
          value: type,
          label: t(`accountTypes.${type}`),
          icon: accountTypeIcons[type],
        }))}
        currencies={currencies}
        categories={PICKABLE_SEED_CATEGORIES.map((category) => ({
          key: category.nameKey,
          name: t(`seed.${category.nameKey}`),
          icon: category.icon as IconName,
          colorIndex: category.colorIndex,
        }))}
      />
    </div>
  );
}
