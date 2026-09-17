import {
  amountBufferToMinor,
  getCurrency,
  importedBalances,
  minorToAmountBuffer,
  todayLocal,
} from '@saldo/core';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { seedFromImport } from '../../src/features/onboarding/importOnboarding';
import { useOnboarding } from '../../src/features/onboarding/state';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { enterTabs } from '../../src/navigation/history';
import { Text } from '../../src/theme/Text';

/**
 * §6.29 import step 4: today's balance of every imported account. Each field starts at what the
 * history adds up to, so "Inizia" untouched keeps the file as the whole story; a different number
 * becomes the opening balance that reaches it (§6.22).
 */
export default function ImportBalancesStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const { draft } = useOnboarding();
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
  const [saving, setSaving] = useState(false);

  const finish = () => {
    if (plan === null) return;
    setSaving(true);
    // False means a sync delivered the account's own settings meanwhile; those win (§8.3), and the
    // app is ready either way.
    seedFromImport(db, repos, {
      periodKind: draft.periodKind,
      cycleStartDay: draft.cycleStartDay,
      currency: draft.currency,
      language: 'system',
      theme: 'system',
      translate: (key) => t(`seed.${key}`),
      completedAt: new Date().toISOString(),
      plan,
      today,
      currentBalances: new Map(
        [...imported.keys()].map((name) => [
          name,
          amountBufferToMinor(buffers[name] ?? '', minorDigits),
        ]),
      ),
    });
    enterTabs(router);
  };

  return (
    <Screen
      footer={
        <PrimaryButton
          testID="onboarding-import-start"
          label={t('common.start')}
          loading={saving}
          disabled={plan === null}
          onPress={finish}
        />
      }
    >
      <BackButton />
      <ProgressBar ratio={1} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 4, total: 4 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.importBalancesTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.importBalancesBody')}</Text>

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
    </Screen>
  );
}
