import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/theme/Text';

/**
 * §6.29 step 0. Two ways in: stay on this phone, or sign in to a server and let the pull decide
 * whether onboarding is needed at all — a device joining an existing account already has settings.
 */
export default function Welcome() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton
            label={t('onboarding.localOnly')}
            onPress={() => router.push('/cycle-day')}
          />
          <SecondaryButton
            label={t('onboarding.connectServer')}
            onPress={() => router.push('/profile/server')}
          />
        </View>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Text size="display" weight="semibold" tracking="tighter">
          {t('onboarding.welcomeTitle')}
        </Text>
        <Text color="textMuted">{t('onboarding.welcomeBody')}</Text>
      </View>
    </Screen>
  );
}
