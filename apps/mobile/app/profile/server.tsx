import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { serverLabel } from '../../src/auth/link';
import { useServer } from '../../src/auth/ServerProvider';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ConnectForm } from '../../src/features/server/ConnectForm';
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
  foreign_device_data: 'sync.foreignDeviceData',
};

/** §6.30. */
export default function ServerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { serverUrl, user, sessionExpired, connect, disconnect } = useServer();
  const { status, scheduler } = useSync();
  const counts = useSyncCounts();

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
    // The card's title already says "not connected"; this line says what that means.
    return t('sync.localOnly');
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
        {serverUrl === null ? null : (
          <Text size="footnote" color="textFaint" style={{ marginTop: 4 }}>
            {t('sync.serverIs', { server: serverLabel(serverUrl) })}
          </Text>
        )}
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
          <ConnectForm />
        </Card>
      )}

      {connected || sessionExpired ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            <ListRow
              title={status.kind === 'syncing' ? t('sync.syncing') : t('sync.syncNow')}
              onPress={
                busy
                  ? undefined
                  : () => {
                      void scheduler?.syncNow();
                    }
              }
              trailing={
                status.kind === 'syncing' ? (
                  <ActivityIndicator color={theme.palette.textMuted} />
                ) : undefined
              }
            />
            {sessionExpired ? (
              <ListRow
                title={t('sync.signIn')}
                onPress={() => void run(async () => void (await connect('login')))}
              />
            ) : null}
            <ListRow
              title={t('sync.signOut')}
              onPress={busy ? undefined : () => setSignOutOpen(true)}
            />
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
            // Signing out is not "go local-only" any more: the data stays, the app returns to the
            // sign-in that §6.29 requires.
            router.replace('/');
          });
        }}
        onCancel={() => setSignOutOpen(false)}
      />
    </Screen>
  );
}
