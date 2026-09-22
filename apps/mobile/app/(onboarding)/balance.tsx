import type { CurrencyCode } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { CurrencyChips } from '../../src/components/CurrencyChips';
import { Screen } from '../../src/components/Screen';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { useOnboarding } from '../../src/features/onboarding/state';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';

/** §6.29 step 3: current balance and currency, on their own so the amount gets the whole screen. */
export default function BalanceStep() {
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
      <StepHeader
        step={{ current: 3, total: 4 }}
        title={t('onboarding.balanceTitle')}
        body={t('onboarding.balanceBody')}
      />

      <StepChunk>
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
              allowNegative
              negativeLabel={t('common.negative')}
            />
          </View>
        </Card>
      </StepChunk>

      <StepChunk index={CHUNK.content + 1}>
        <Card>
          <Text size="footnote" color="textMuted">
            {t('onboarding.accountCurrency')}
          </Text>
          <CurrencyChips value={currency} onChange={setCurrency} />
        </Card>
      </StepChunk>
    </Screen>
  );
}
