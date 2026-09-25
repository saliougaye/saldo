import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.29 step 0. Two doors of equal weight: the phone alone (local-only, §1.1 goal 2), or a
 * server the user names. Nothing is written by either — the phone door only opens the chooser,
 * and the boot router decides the rest once onboarding saves something.
 */
export default function Welcome() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const lead = (name: 'phone' | 'server') => (
    <IconBox name={name} colour={theme.palette.textMuted} />
  );

  return (
    <Screen>
      <StepHeader title={t('onboarding.welcomeTitle')} body={t('onboarding.welcomeBody')} />
      <StepChunk>
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            <View style={{ paddingVertical: 5 }}>
              <ListRow
                testID="welcome-phone"
                title={t('onboarding.welcomePhone')}
                subtitle={t('onboarding.welcomePhoneHint')}
                leading={lead('phone')}
                onPress={() => router.push('/start')}
                chevron
              />
            </View>
            <View style={{ height: 1, backgroundColor: theme.palette.border }} />
            <View style={{ paddingVertical: 5 }}>
              <ListRow
                testID="welcome-server"
                title={t('onboarding.welcomeServer')}
                subtitle={t('onboarding.welcomeServerHint')}
                subtitleLines={2}
                leading={lead('server')}
                onPress={() => router.push('/server')}
                chevron
              />
            </View>
          </View>
        </Card>
      </StepChunk>
      <StepChunk index={CHUNK.content + 1}>
        <Text size="caption" color="textFaint">
          {t('onboarding.welcomeLater')}
        </Text>
      </StepChunk>
    </Screen>
  );
}
