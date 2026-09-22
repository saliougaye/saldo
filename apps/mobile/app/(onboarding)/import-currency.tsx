import type { CurrencyCode } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../src/components/Card';
import { CurrencyChips } from '../../src/components/CurrencyChips';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ONBOARDING_STEPS, useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';

/**
 * §6.29 import step 2: the currency, before the file. The preview needs it — a row in another
 * currency is an error (§11.3) — and amounts are read at its scale.
 */
export default function ImportCurrencyStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [currency, setCurrency] = useState<CurrencyCode>(draft.currency);

  return (
    <Screen
      footer={
        <StepFooter
          testID="onboarding-import-currency-continue"
          label={t('common.continue')}
          onPress={() => {
            // A plan read at another currency's scale no longer holds.
            setDraft(currency === draft.currency ? { currency } : { currency, importPlan: null });
            router.push('/import-file');
          }}
        />
      }
    >
      <StepHeader
        step={{ current: 2, total: ONBOARDING_STEPS }}
        title={t('onboarding.importCurrencyTitle')}
        body={t('onboarding.importCurrencyBody')}
      />
      <StepChunk>
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
