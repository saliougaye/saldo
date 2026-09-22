import { getCurrency, importedBalances, minorToAmountBuffer, todayLocal } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountInput } from '../../src/components/AmountInput';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.29 import step 4: today's balance of every imported account. Each field starts at what the
 * history adds up to, so «Continua» untouched keeps the file as the whole story; a different number
 * becomes the opening balance that reaches it (§6.22), written by «Inizia» on step 5.
 */
export default function ImportBalancesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { draft, setDraft } = useOnboarding();
  const plan = draft.importPlan;
  const { minorDigits } = getCurrency(draft.currency);
  const today = useMemo(() => todayLocal(), []);
  const imported = useMemo(
    () => (plan === null ? new Map<string, number>() : importedBalances(plan, today)),
    [plan, today],
  );
  const [buffers, setBuffers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...imported].map(([name, balance]) => [name, minorToAmountBuffer(balance, minorDigits)]),
    ),
  );
  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-import-balances-continue"
          label={t('common.continue')}
          disabled={plan === null}
          onPress={() => {
            setDraft({ importBalanceBuffers: buffers });
            router.push('/permissions');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 4, total: ONBOARDING_STEPS }}
        title={t('onboarding.importBalancesTitle')}
        body={t('onboarding.importBalancesBody')}
      />

      <StepChunk>
        <View style={{ gap: theme.layout.cardGap }}>
          {[...imported.keys()].map((name) => (
            <Card key={name}>
              <Text size="footnote" color="textMuted">
                {name}
              </Text>
              <View style={{ marginTop: 6 }}>
                <AmountInput
                  buffer={buffers[name] ?? ''}
                  onChange={(buffer) => setBuffers((current) => ({ ...current, [name]: buffer }))}
                  currency={draft.currency}
                  locale={locale}
                  label={name}
                  doneLabel={t('common.done')}
                  allowNegative
                  negativeLabel={t('common.negative')}
                />
              </View>
            </Card>
          ))}
        </View>
      </StepChunk>
    </Screen>
  );
}
