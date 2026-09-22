import type { CurrencyCode } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../src/components/AmountInput';
import { Card } from '../../src/components/Card';
import { CurrencySheet } from '../../src/components/CurrencySheet';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.29 step 3: current balance and currency, on their own so the amount gets the whole screen. */
export default function BalanceStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { draft, setDraft } = useOnboarding();
  const [buffer, setBuffer] = useState(draft.balanceBuffer);
  const [currency, setCurrency] = useState<CurrencyCode>(draft.currency);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const theme = useTheme();

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-balance-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ balanceBuffer: buffer, currency });
            router.push('/categories');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 3, total: ONBOARDING_STEPS }}
        title={t('onboarding.balanceTitle')}
        body={t('onboarding.balanceBody')}
      />

      <StepChunk>
        <Card>
          <Text size="footnote" color="textMuted">
            {t('onboarding.accountBalance')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 6,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <AmountInput
                testID="onboarding-balance-amount"
                buffer={buffer}
                onChange={setBuffer}
                currency={currency}
                locale={locale}
                autoFocus
                label={t('onboarding.accountBalance')}
                doneLabel={t('common.done')}
                allowNegative
                negativeLabel={t('common.negative')}
              />
            </View>
            {/* The currency beside the amount, as in the design (1662–1665): one row asks one thing. */}
            <Pressable
              testID="onboarding-balance-currency"
              accessibilityRole="button"
              accessibilityLabel={`${t('onboarding.accountCurrency')}: ${currency}`}
              onPress={() => setPickingCurrency(true)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 34,
                paddingHorizontal: 10,
                marginBottom: 4,
                borderRadius: theme.radii.input,
                borderWidth: 1,
                borderColor: theme.palette.border,
                backgroundColor: theme.palette.raised,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text size="footnote" color="textMuted">
                {currency}
              </Text>
              <Icon name="chevD" size={14} color={theme.palette.textMuted} />
            </Pressable>
          </View>
        </Card>
      </StepChunk>
      <CurrencySheet
        visible={pickingCurrency}
        onClose={() => setPickingCurrency(false)}
        value={currency}
        onSelect={setCurrency}
      />
    </Screen>
  );
}
