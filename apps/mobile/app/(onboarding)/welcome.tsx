import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { ConnectForm } from '../../src/features/server/ConnectForm';
import { Text } from '../../src/theme/Text';

/**
 * §6.29 step 0. One way in: sign in to the server that holds the account. The app then works
 * offline — what it needs is an account, not a connection — but a first run with no network
 * cannot get past this screen, so the copy says so instead of leaving the user guessing.
 */
export default function Welcome() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} style={{ flex: 1 }}>
        <StepHeader title={t('onboarding.welcomeTitle')} body={t('onboarding.welcomeBody')} />
        <StepChunk>
          <Card>
            <ConnectForm
              onConnected={() => {
                // Where to go next is the boot router's decision: a device joining an account that
                // already has settings must skip onboarding entirely (§6.29).
                router.replace('/');
              }}
            />
          </Card>
        </StepChunk>
        <StepChunk index={CHUNK.content + 1}>
          <Text size="caption" color="textFaint">
            {t('onboarding.welcomeOffline')}
          </Text>
        </StepChunk>
      </ScrollView>
    </Screen>
  );
}
