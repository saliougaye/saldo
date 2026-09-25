import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { serverLabel } from '../../auth/link';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { IconBox } from '../../components/ListRow';
import { TextField } from '../../components/TextField';
import { swapIn } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { describeServerError } from './describeServerError';
import { addressHint } from './serverProbe';
import { type ServerSignIn, useServerSignIn } from './useServerSignIn';

/** The status mark of the server row: a filled green dot when it answered, a grey ring when not. */
function StatusMark({ ok }: { ok: boolean }) {
  const theme = useTheme();
  // No red in the palette (tokens.ts): the ring differs from the dot by shape, and the words say it.
  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: ok ? theme.palette.positive : 'transparent',
        borderWidth: ok ? 0 : 1.5,
        borderColor: theme.palette.textMuted,
      }}
    />
  );
}

/** The server, once asked: host, what it answered, and the way to change it. */
export function ServerRow({ s }: { s: ServerSignIn }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { probe } = s;
  // «Riprova» keeps the row: the address is not in question, only the answer.
  const retrying = probe.kind === 'checking' && probe.attempts > 0;
  if (probe.kind !== 'found' && probe.kind !== 'failed' && !retrying) return null;
  const status =
    probe.kind === 'found'
      ? t('server.version', { version: probe.health.version })
      : probe.kind === 'failed' && probe.reason === 'not_saldo'
        ? t('server.notSaldo')
        : retrying
          ? t('server.checking')
          : t('server.unreachable');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconBox name="server" colour={theme.palette.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="medium" numberOfLines={1}>
          {serverLabel(probe.origin)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <StatusMark ok={probe.kind === 'found'} />
          <Text size="caption" color={probe.kind === 'found' ? 'textFaint' : 'textMuted'}>
            {status}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('server.changeServer')}
        hitSlop={8}
        onPress={s.change}
        style={({ pressed }) => ({
          minHeight: theme.layout.minHitTarget,
          justifyContent: 'center',
          paddingLeft: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text weight="medium" color="textMuted">
          {t('server.change')}
        </Text>
      </Pressable>
    </View>
  );
}

/** The card: the address field until the first answer, the server row from then on. */
export function ServerAddressCard({
  s,
  autoFocus = true,
}: {
  s: ServerSignIn;
  /** On in onboarding, where the step asks one thing; off in Profile, which is also a status. */
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const hint = addressHint(s.address);
  const editing =
    s.probe.kind === 'editing' || (s.probe.kind === 'checking' && s.probe.attempts === 0);
  return (
    <Card>
      {editing ? (
        <Animated.View key="field" entering={swapIn(0.98)} style={{ gap: 8 }}>
          <TextField
            testID="server-address"
            label={t('server.address')}
            placeholder={t('server.placeholder')}
            value={s.address}
            onChangeText={s.setAddress}
            editable={s.probe.kind === 'editing'}
            autoFocus={autoFocus}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="go"
            onSubmitEditing={s.submit}
          />
          <Text size="caption" color="textFaint" accessibilityLiveRegion="polite">
            {s.probe.kind === 'checking'
              ? t('server.checking')
              : hint.kind === 'will-connect'
                ? t('server.hintConnect', { origin: hint.origin })
                : hint.kind === 'insecure'
                  ? t('server.hintInsecure')
                  : hint.kind === 'invalid'
                    ? t('server.hintInvalid')
                    : t('server.hintIdle')}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View key="row" entering={swapIn(0.98)}>
          <ServerRow s={s} />
        </Animated.View>
      )}
    </Card>
  );
}

/** Below the card: the passkey once the server answered, the way forward when it did not. */
export function ServerActions({ s }: { s: ServerSignIn }) {
  const { t } = useTranslation();
  const { probe } = s;
  if (probe.kind === 'failed') {
    const help =
      probe.reason === 'not_saldo' ? t('server.helpNotSaldo') : t('server.helpUnreachable');
    return (
      <Animated.View entering={swapIn(0.98)} style={{ gap: 12 }}>
        {probe.reason === 'unreachable' ? (
          <PrimaryButton label={t('server.retry')} onPress={s.retry} />
        ) : (
          <PrimaryButton label={t('server.changeAddress')} onPress={s.change} />
        )}
        <Text size="caption" color="textFaint" accessibilityLiveRegion="polite">
          {probe.attempts > 1 ? `${t('server.stillNothing')} ${help}` : help}
        </Text>
      </Animated.View>
    );
  }
  if (probe.kind === 'checking' && probe.attempts > 0) {
    // «Riprova» in flight: the same button, busy, under the same row.
    return <PrimaryButton label={t('server.retry')} loading />;
  }
  if (probe.kind !== 'found') return null;
  return (
    <Animated.View entering={swapIn(0.98)} style={{ gap: 12 }}>
      <PrimaryButton
        testID="server-sign-in"
        label={t('sync.signIn')}
        loading={s.busy}
        onPress={() => s.signIn('login')}
      />
      {probe.health.registrationAllowed ? (
        <SecondaryButton
          label={t('sync.createAccount')}
          disabled={s.busy}
          onPress={() => s.signIn('register')}
        />
      ) : null}
      {s.failure === null ? null : (
        <Text size="footnote" color="accent">
          {describeServerError(t, s.failure)}
        </Text>
      )}
      <Text size="caption" color="textFaint">
        {t('sync.passkeyNote')}
      </Text>
    </Animated.View>
  );
}

/** The two questions `connect` may ask before it installs the session. */
export function ServerSignInDialogs({ s }: { s: ServerSignIn }) {
  const { t } = useTranslation();
  // The questions are asked mid sign-in, so the probe has found the server they are about.
  const server = s.probe.kind === 'found' ? serverLabel(s.probe.origin) : '';
  return (
    <>
      <ConfirmDialog
        visible={s.foreignData !== null}
        title={t('sync.foreignDataTitle')}
        body={t('sync.foreignDataBody', { count: s.foreignData?.pending ?? 0 })}
        confirmLabel={t('sync.foreignDataConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => s.answerForeignData(true)}
        onCancel={() => s.answerForeignData(false)}
      />
      <ConfirmDialog
        visible={s.unownedOpen}
        title={t('sync.unownedTitle')}
        body={t('sync.unownedBody', { server })}
        confirmLabel={t('sync.unownedAdopt')}
        alternativeLabel={t('sync.unownedDiscard')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => s.answerUnowned('adopt')}
        onAlternative={() => s.answerUnowned('discard')}
        onCancel={() => s.answerUnowned('cancel')}
      />
    </>
  );
}

/** Profile's version (§6.30): everything in one column, «Continua» under the field. */
export function ServerSignInPanel({ onConnected }: { onConnected?: () => void }) {
  const { t } = useTranslation();
  const s = useServerSignIn({ onConnected });
  return (
    <View style={{ gap: 16 }}>
      <ServerAddressCard s={s} autoFocus={false} />
      {s.probe.kind === 'editing' || (s.probe.kind === 'checking' && s.probe.attempts === 0) ? (
        <PrimaryButton
          label={t('common.continue')}
          disabled={!s.canSubmit}
          loading={s.probe.kind === 'checking'}
          onPress={s.submit}
        />
      ) : (
        <ServerActions s={s} />
      )}
      <ServerSignInDialogs s={s} />
    </View>
  );
}
