import { COMMON_CURRENCY_CODES, type CurrencyCode } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useOnboarding } from '../../src/features/onboarding/state';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.29 step 3: current balance and currency, on their own so the amount gets the whole screen. */
export default function BalanceStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { draft, setDraft } = useOnboarding();
  const [buffer, setBuffer] = useState(draft.balanceBuffer);
  const [currency, setCurrency] = useState<CurrencyCode>(draft.currency);

  return (
    <Screen
      footer={
        <PrimaryButton
          testID="onboarding-balance-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ balanceBuffer: buffer, currency });
            router.push('/categories');
          }}
        />
      }
    >
      <BackButton />
      <ProgressBar ratio={3 / 4} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 3, total: 4 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.balanceTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.balanceBody')}</Text>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('onboarding.accountBalance')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            testID="onboarding-balance-amount"
            buffer={buffer}
            onChange={setBuffer}
            currency={currency}
            locale={locale}
            autoFocus
            label={t('onboarding.accountBalance')}
            doneLabel={t('common.done')}
          />
        </View>
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('onboarding.accountCurrency')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          {COMMON_CURRENCY_CODES.map((code) => {
            const selected = code === currency;
            return (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                // The row of codes is 38pt tall; it is already wide, so only the height grows.
                hitSlop={{ top: 3, bottom: 3 }}
                onPress={() => setCurrency(code)}
                style={{
                  flex: 1,
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.chipSmall,
                  backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                }}
              >
                <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                  {code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}
