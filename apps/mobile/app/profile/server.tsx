import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { normaliseServerUrl } from '../../src/auth/link';
import { useServer } from '../../src/auth/ServerProvider';
import type { ServerHealth } from '../../src/auth/session';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { ApiClientError } from '../../src/net/apiClient';
import { useSync } from '../../src/sync/SyncProvider';
import { useSyncCounts } from '../../src/sync/useSyncCounts';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Error codes that have their own wording; anything else falls back to the message. */
const CODE_KEYS: Record<string, string> = {
  unreachable: 'sync.unreachable',
  not_saldo: 'sync.notSaldo',
  cancelled: 'sync.cancelled',
  schema_too_old: 'sync.schemaTooOld',
  schema_too_new: 'sync.schemaTooNew',
  registration_closed: 'sync.registrationClosed',
};

/** §6.30. */
export default function ServerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { serverUrl, user, sessionExpired, check, connect, disconnect } = useServer();
  const { status, scheduler } = useSync();
  const counts = useSyncCounts();

  const [url, setUrl] = useState(serverUrl ?? '');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

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

  const relative = useMemo(() => {
    if (status.kind !== 'idle' || status.lastSyncAt === null) return t('sync.never');
    const minutes = Math.floor((Date.now() - status.lastSyncAt) / 60_000);
    if (minutes < 1) return t('sync.justNow');
    if (minutes < 60) return t('sync.minutesAgo', { count: minutes });
    return t('sync.hoursAgo', { count: Math.floor(minutes / 60) });
  }, [status, t]);

  const statusLine = (): string => {
    if (sessionExpired || status.kind === 'session-expired') return t('sync.sessionExpired');
    if (status.kind === 'syncing') return t('sync.syncing');
    if (status.kind === 'error') {
      const key = CODE_KEYS[status.code];
      return key === undefined ? status.message : t(key);
    }
    if (user !== null) return t('sync.lastSync', { when: relative });
    return t('sync.notConnected');
  };

  const connected = serverUrl !== null && user !== null;

  return (
    <Screen>
      <ScreenHeader title={t('sync.title')} />

      <Card>
        <Text weight="medium" tracking="tight">
          {connected ? t('sync.connectedAs', { name: user.displayName }) : t('sync.notConnected')}
        </Text>
        <Text size="footnote" color="textMuted" style={{ marginTop: 4 }}>
          {statusLine()}
        </Text>
        {connected ? (
          <Text size="footnote" color="textMuted" style={{ marginTop: 4 }}>
            {counts.pending === 0
              ? t('sync.upToDate')
              : t('sync.pending', { count: counts.pending })}
          </Text>
        ) : null}
        {connected && counts.errors > 0 ? (
          <Text size="footnote" color="accent" style={{ marginTop: 4 }}>
            {t('sync.rejected', { count: counts.errors })}
          </Text>
        ) : null}
      </Card>

      {connected ? null : (
        <Card>
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
          <View style={{ marginTop: 12 }}>
            <SecondaryButton
              label={busy ? t('sync.verifying') : t('sync.verify')}
              disabled={busy || url.trim().length === 0}
              onPress={() =>
                run(async () => {
                  const normalised = normaliseServerUrl(url);
                  if (normalised === null) throw new ApiClientError(400, 'not_saldo', '');
                  const found = await check(normalised);
                  setUrl(normalised);
                  setHealth(found);
                })
              }
            />
          </View>
          {health === null ? null : (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text size="footnote" color="textMuted">
                {t('sync.serverFound', { version: health.version })}
              </Text>
              <PrimaryButton
                label={t('sync.signIn')}
                disabled={busy}
                onPress={() => run(async () => void (await connect(url, 'login')))}
              />
              {health.registrationAllowed ? (
                <SecondaryButton
                  label={t('sync.createAccount')}
                  disabled={busy}
                  onPress={() => run(async () => void (await connect(url, 'register')))}
                />
              ) : null}
              <Text size="caption" color="textFaint">
                {t('sync.passkeyNote')}
              </Text>
            </View>
          )}
        </Card>
      )}

      {connected || sessionExpired ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            <ListRow
              title={status.kind === 'syncing' ? t('sync.syncing') : t('sync.syncNow')}
              onPress={() => {
                void scheduler?.syncNow();
              }}
              trailing={
                status.kind === 'syncing' ? (
                  <ActivityIndicator color={theme.palette.textMuted} />
                ) : undefined
              }
            />
            {sessionExpired ? (
              <ListRow
                title={t('sync.signIn')}
                onPress={() => {
                  if (serverUrl !== null)
                    void run(async () => void (await connect(serverUrl, 'login')));
                }}
              />
            ) : null}
            <ListRow title={t('sync.signOut')} onPress={() => setSignOutOpen(true)} />
          </View>
        </Card>
      ) : null}

      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}

      <ConfirmDialog
        visible={signOutOpen}
        title={t('sync.signOutTitle')}
        body={t('sync.signOutBody')}
        confirmLabel={t('sync.signOut')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setSignOutOpen(false);
          void run(async () => {
            await disconnect();
            setHealth(null);
          });
        }}
        onCancel={() => setSignOutOpen(false)}
      />
    </Screen>
  );
}
