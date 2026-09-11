import { COMMON_CURRENCY_CODES, type CurrencyCode, getCurrency } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { OptionRow, SettingScreen } from '../../src/features/profile/SettingScreen';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.8 + §5.1. The symbol is shown next to the code: it is what the user sees in every amount. */
export default function CurrencySetting() {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const current = settings?.currency ?? 'EUR';
  const [pending, setPending] = useState<CurrencyCode | null>(null);

  return (
    <SettingScreen title={t('profile.currency')}>
      {COMMON_CURRENCY_CODES.map((code) => (
        <OptionRow
          key={code}
          label={code}
          detail={formatMoney(0, code, locale)}
          selected={code === current}
          leading={
            <View
              style={{
                width: theme.layout.iconBoxSmall,
                height: theme.layout.iconBoxSmall,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.iconBox,
                backgroundColor: theme.palette.raised,
              }}
            >
              <Text size="footnote" weight="medium">
                {getCurrency(code).symbol}
              </Text>
            </View>
          }
          onPress={() => {
            if (code !== current) setPending(code);
          }}
        />
      ))}

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
