import { type CurrencyCode, getCurrency } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { CurrencyList } from '../../src/components/CurrencyList';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { useAppLocale } from '../../src/i18n/useAppLocale';

/** §6.8 + §5.1 + §6.25: every currency, searchable; changing it reformats, never converts. */
export default function CurrencySetting() {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const current = settings?.currency ?? 'EUR';
  const [pending, setPending] = useState<CurrencyCode | null>(null);

  return (
    <SettingScreen
      title={t('profile.currency')}
      subtitle={t('profile.currencyConfirmBody')}
      card={false}
    >
      <CurrencyList
        card
        value={current}
        onSelect={(code) => {
          if (code !== current) setPending(code);
        }}
      />

      <ConfirmDialog
        visible={pending !== null}
        title={t('profile.currencyConfirmTitle')}
        body={
          pending === null
            ? undefined
            : getCurrency(pending).minorDigits === getCurrency(current).minorDigits
              ? t('profile.currencyConfirmBody')
              : // §5.1: a different scale moves the decimal point, so the copy says so with the
                // user's own number rather than a generic sentence.
                t('profile.currencyConfirmScale', {
                  before: formatMoney(184260, current, locale),
                  after: formatMoney(184260, pending, locale),
                })
        }
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (pending !== null) repos.settings.update({ currency: pending });
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </SettingScreen>
  );
}
