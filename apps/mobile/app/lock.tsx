import { mascot } from '@saldo/ui';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../src/components/Button';
import { Mascot } from '../src/components/Mascot';
import { Screen } from '../src/components/Screen';
import { enterTabs } from '../src/navigation/history';
import { Text } from '../src/theme/Text';

/** §6.32: prompts biometrics on mount and falls back to the device passcode. */
export default function LockScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  const authenticate = useCallback(async () => {
    setFailed(false);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('lock.unlock'),
      // Falling back to the passcode keeps the app reachable when biometrics are unavailable.
      disableDeviceFallback: false,
    });
    if (result.success) enterTabs(router);
    else setFailed(true);
  }, [router, t]);

  useEffect(() => {
    authenticate().catch(() => setFailed(true));
  }, [authenticate]);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {/* §6.32: asleep until the user unlocks; the title says the same. */}
        <Mascot state="sleep" size={mascot.lockSize} />
        <Text size="title" weight="semibold" tracking="tighter">
          {t('lock.title')}
        </Text>
        {failed ? (
          <Text size="footnote" color="textMuted">
            {t('lock.failed')}
          </Text>
        ) : null}
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 24 }}>
          <PrimaryButton
            label={t('lock.unlock')}
            onPress={() => {
              authenticate().catch(() => setFailed(true));
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
