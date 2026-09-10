import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { serverLabel } from '../../auth/link';
import { useServer } from '../../auth/ServerProvider';
import type { ServerHealth } from '../../auth/session';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { ApiClientError } from '../../net/apiClient';
import { Text } from '../../theme/Text';

/** Error codes with their own wording; anything else falls back to the message. */
const CODE_KEYS: Record<string, string> = {
  unreachable: 'sync.unreachable',
  not_saldo: 'sync.notSaldo',
  cancelled: 'sync.cancelled',
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
  registration_closed: 'sync.registrationClosed',
  display_name_required: 'sync.nameRequired',
};

/**
 * Sign-in to the server this build points at (§9.3 step 1). Shared by onboarding step 0 and
 * §6.30, so the sign-in the app requires and the one Settings offers are the same code, not two
 * copies that drift.
 *
 * The health check is no longer the user's "Verifica": the address is not in question any more,
 * so it runs on mount and its only job is to learn whether this server still takes new accounts.
 */
export function ConnectForm({ onConnected }: { onConnected?: () => void }) {
  const { t } = useTranslation();
  const { serverUrl, connect, check } = useServer();
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [checking, setChecking] = useState(serverUrl !== null);
  const [busy, setBusy] = useState(false);
  // The failure is kept raw and worded at render time, so the probe does not depend on `t` and a
  // change of language does not restart it.
  const [failure, setFailure] = useState<unknown>(null);

  const describe = (caught: unknown): string => {
    const code = caught instanceof ApiClientError ? caught.code : null;
    const key = code === null ? undefined : CODE_KEYS[code];
    if (key !== undefined) return t(key);
    return caught instanceof Error ? caught.message : t('sync.unreachable');
  };

  const probe = useCallback(async () => {
    if (serverUrl === null) return;
    setChecking(true);
    setFailure(null);
    try {
      setHealth(await check(serverUrl));
    } catch (caught) {
      setFailure(caught);
    } finally {
      setChecking(false);
    }
  }, [serverUrl, check]);

  useEffect(() => {
    void probe();
  }, [probe]);

  const signIn = (mode: 'login' | 'register') => () => {
    setBusy(true);
    setFailure(null);
    void (async () => {
      try {
        await connect(mode);
        onConnected?.();
      } catch (caught) {
        setFailure(caught);
      } finally {
        setBusy(false);
      }
    })();
  };

  // A build with no usable SALDO_SERVER_URL cannot sign anyone in, and no button would help.
  if (serverUrl === null) {
    return (
      <Text size="footnote" color="accent">
        {t('sync.noServerConfigured')}
      </Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Text size="footnote" color="textMuted">
        {t('sync.serverIs', { server: serverLabel(serverUrl) })}
      </Text>
      {checking || health !== null ? (
        <Text size="footnote" color="textFaint">
          {checking ? t('sync.verifying') : t('sync.serverFound', { version: health?.version })}
        </Text>
      ) : null}

      {/* Enabled even after a failed probe: the failure may be transient, and the ceremony
          reports its own error. Disabling the only way forward would be worse. */}
      <PrimaryButton
        label={t('sync.signIn')}
        disabled={busy || checking}
        onPress={signIn('login')}
      />
      {health?.registrationAllowed === true ? (
        <SecondaryButton
          label={t('sync.createAccount')}
          disabled={busy || checking}
          onPress={signIn('register')}
        />
      ) : null}

      {failure === null ? null : (
        <View style={{ gap: 8 }}>
          <Text size="footnote" color="accent">
            {describe(failure)}
          </Text>
          <SecondaryButton
            label={t('common.retry')}
            disabled={checking}
            onPress={() => void probe()}
          />
        </View>
      )}
      <Text size="caption" color="textFaint">
        {t('sync.passkeyNote')}
      </Text>
    </View>
  );
}
