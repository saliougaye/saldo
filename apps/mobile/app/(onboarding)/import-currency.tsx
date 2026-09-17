import type { CurrencyCode } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { CurrencyChips } from '../../src/components/CurrencyChips';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useOnboarding } from '../../src/features/onboarding/state';
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
        <PrimaryButton
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
      <BackButton />
      <ProgressBar ratio={2 / 4} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 2, total: 4 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.importCurrencyTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.importCurrencyBody')}</Text>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('onboarding.accountCurrency')}
        </Text>
        <CurrencyChips value={currency} onChange={setCurrency} />
      </Card>
    </Screen>
  );
}
