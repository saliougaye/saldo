import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TextField } from '../../components/TextField';
import { Text } from '../../theme/Text';
import { emailLooksValid } from './emailAsk';

interface Props {
  visible: boolean;
  /** Rejects with an `ApiClientError`; `email_taken` is the one the field itself can answer. */
  onSave: (email: string) => Promise<void>;
  onDismiss: () => void;
}

/**
 * D32: every account carries an email. An account created before 0.3b has the synthetic address of
 * §9.1, and this is where it gets a real one — after a sign-in, and from the server screen for anybody
 * who said «Più tardi». It is an identifier, not a credential: the passkey is still the only way in.
 */
export function EmailAskDialog({ visible, onSave, onDismiss }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!emailLooksValid(email)) {
      setError(t('sync.emailAskInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    void onSave(email.trim().toLowerCase())
      .then(() => {
        setEmail('');
        onDismiss();
      })
      .catch((caught: unknown) => {
        const code =
          typeof caught === 'object' && caught !== null && 'code' in caught
            ? String((caught as { code: unknown }).code)
            : '';
        setError(code === 'email_taken' ? t('sync.emailAskTaken') : t('sync.emailAskInvalid'));
      })
      .finally(() => setBusy(false));
  };

  return (
    <ConfirmDialog
      visible={visible}
      title={t('sync.emailAskTitle')}
      body={t('sync.emailAskBody')}
      confirmLabel={t('common.save')}
      cancelLabel={t('sync.emailAskLater')}
      onConfirm={save}
      onCancel={onDismiss}
      busy={busy}
      confirmTestID="email-ask-save"
      cancelTestID="email-ask-later"
    >
      <View style={{ gap: 8, marginTop: 12 }}>
        <TextField
          testID="email-ask-field"
          label={t('web.auth.emailLabel')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={save}
        />
        {error === null ? null : (
          <Text size="footnote" color="accent">
            {error}
          </Text>
        )}
      </View>
    </ConfirmDialog>
  );
}
