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
import {
  describeServerError,
  SERVER_ERROR_KEYS,
} from '../../src/features/server/describeServerError';
import { EmailAskDialog } from '../../src/features/server/EmailAskDialog';
import { needsEmail } from '../../src/features/server/emailAsk';
import { ServerSignInPanel } from '../../src/features/server/ServerSignIn';
import { useSync } from '../../src/sync/SyncProvider';
import { useSyncCounts } from '../../src/sync/useSyncCounts';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.30. */
export default function ServerScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { serverUrl, user, sessionExpired, connect, disconnect, saveEmail } = useServer();
  const { status, scheduler } = useSync();
  const counts = useSyncCounts();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [emailAskOpen, setEmailAskOpen] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(describeServerError(t, caught));
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
      const key = SERVER_ERROR_KEYS[status.code];
      return key === undefined ? status.message : t(key);
    }
    if (user !== null) return t('sync.lastSync', { when: relative });
    // The card's title already says "not connected"; this line says what that means.
    return t('sync.localOnly');
  };

  const connected = serverUrl !== null && user !== null;

  return (
    <Screen refreshable>
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

      {/* An expired session signs back in to the same server, from the row below. */}
      {connected || sessionExpired ? null : <ServerSignInPanel />}

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
            {sessionExpired && serverUrl !== null ? (
              <ListRow
                title={t('sync.signIn')}
                onPress={() => void run(async () => void (await connect(serverUrl, 'login')))}
              />
            ) : null}
            {needsEmail(user) ? (
              <ListRow title={t('sync.emailAddRow')} onPress={() => setEmailAskOpen(true)} />
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
            // §6.30: the data stays and the app carries on local-only, so there is nowhere to go —
            // this screen now shows the sign-in again, prefilled with the address that worked.
            await disconnect();
          });
        }}
        onCancel={() => setSignOutOpen(false)}
      />

      <EmailAskDialog
        visible={emailAskOpen}
        onSave={saveEmail}
        onDismiss={() => setEmailAskOpen(false)}
      />
    </Screen>
  );
}
