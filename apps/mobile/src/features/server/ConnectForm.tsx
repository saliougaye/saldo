import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { normaliseServerUrl } from '../../auth/link';
import { useServer } from '../../auth/ServerProvider';
import type { ServerHealth } from '../../auth/session';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { TextField } from '../../components/TextField';
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
 * Server address → "Verifica" → passkey. Shared by onboarding step 0 and §6.30, so the sign-in
 * the app requires and the one Settings offers are the same code, not two copies that drift.
 */
export function ConnectForm({ onConnected }: { onConnected?: () => void }) {
  const { t } = useTranslation();
  const { serverUrl, check, connect } = useServer();
  const [url, setUrl] = useState(serverUrl ?? '');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describe = (caught: unknown): string => {
    const code = caught instanceof ApiClientError ? caught.code : null;
    const key = code === null ? undefined : CODE_KEYS[code];
    if (key !== undefined) return t(key);
    return caught instanceof Error ? caught.message : t('sync.unreachable');
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  };

  const signIn = (mode: 'login' | 'register') => () =>
    run(async () => {
      await connect(url, mode);
      onConnected?.();
    });

  return (
    <View style={{ gap: 12 }}>
      <TextField
        label={t('sync.serverUrl')}
        placeholder={t('sync.serverUrlPlaceholder')}
        value={url}
        onChangeText={(next) => {
          setUrl(next);
          setHealth(null);
        }}
        autoCapitalize="none"
        keyboardType="url"
      />
      {health === null ? (
        <SecondaryButton
          label={busy ? t('sync.verifying') : t('sync.verify')}
          disabled={busy || url.trim().length === 0}
          onPress={() =>
            run(async () => {
              const normalised = normaliseServerUrl(url);
              // A malformed address is not a network failure, and saying so is more useful.
              if (normalised === null) throw new ApiClientError(400, 'not_saldo', '');
              const found = await check(normalised);
              setUrl(normalised);
              setHealth(found);
            })
          }
        />
      ) : (
        <View style={{ gap: 8 }}>
          <Text size="footnote" color="textMuted">
            {t('sync.serverFound', { version: health.version })}
          </Text>
          <PrimaryButton label={t('sync.signIn')} disabled={busy} onPress={signIn('login')} />
          {health.registrationAllowed ? (
            <SecondaryButton
              label={t('sync.createAccount')}
              disabled={busy}
              onPress={signIn('register')}
            />
          ) : null}
          <Text size="caption" color="textFaint">
            {t('sync.passkeyNote')}
          </Text>
        </View>
      )}
      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}
    </View>
  );
}
