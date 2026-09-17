import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { AccountTypeGrid } from '../../src/features/accounts/AccountTypeGrid';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';

/** §6.29 step 2: what the account *is*. Its balance and currency are step 3. */
export default function AccountDetailsStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, setDraft } = useOnboarding();
  const [name, setName] = useState(draft.accountName);
  const [type, setType] = useState(draft.accountType);

  return (
    <Screen
      footer={
        <PrimaryButton
          testID="onboarding-account-continue"
          label={t('common.continue')}
          onPress={() => {
            setDraft({ accountName: name.trim(), accountType: type });
            router.push('/balance');
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
        {t('onboarding.accountTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.accountBody')}</Text>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            testID="onboarding-account-name"
            label={t('onboarding.accountName')}
            placeholder={t('onboarding.accountNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('onboarding.accountType')}
            </Text>
            <AccountTypeGrid
              accessibilityLabel={t('onboarding.accountType')}
              value={type}
              onChange={setType}
            />
          </View>
        </View>
      </Card>
    </Screen>
  );
}
