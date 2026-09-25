import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { StepFooter } from '../../src/features/onboarding/StepFooter';
import { CHUNK, StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import {
  ServerActions,
  ServerAddressCard,
  ServerSignInDialogs,
} from '../../src/features/server/ServerSignIn';
import { useServerSignIn } from '../../src/features/server/useServerSignIn';

/**
 * §6.29 step 0, the server door. The field swaps in place for the server it found, and the
 * passkey appears under it; a failure is the same row with its own words. «Continua» lives in the
 * footer while there is an address to try, and steps aside once there is not (the buttons are in
 * the body then) — «Indietro» stays either way.
 */
export default function ServerStep() {
  const router = useRouter();
  const { t } = useTranslation();
  // Where to go next is the boot router's call: an account with settings skips onboarding (§6.29).
  const s = useServerSignIn({ onConnected: () => router.replace('/') });
  const asking =
    s.probe.kind === 'editing' || (s.probe.kind === 'checking' && s.probe.attempts === 0);

  return (
    <Screen
      footer={
        asking ? (
          <StepFooter
            testID="server-continue"
            label={t('common.continue')}
            disabled={!s.canSubmit}
            loading={s.probe.kind === 'checking'}
            onPress={s.submit}
          />
        ) : (
          <StepFooter />
        )
      }
    >
      <StepHeader title={t('server.title')} body={t('server.body')} />
      <StepChunk>
        <ServerAddressCard s={s} />
      </StepChunk>
      <StepChunk index={CHUNK.content + 1}>
        <View style={{ marginTop: 16 }}>
          <ServerActions s={s} />
        </View>
      </StepChunk>
      <ServerSignInDialogs s={s} />
    </Screen>
  );
}
