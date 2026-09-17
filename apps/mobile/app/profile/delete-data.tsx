import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteAllAttachmentFiles } from '../../src/attachments/localFiles';
import { useServer } from '../../src/auth/ServerProvider';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { TextField } from '../../src/components/TextField';
import { db } from '../../src/db/client';
import { matchesConfirmWord } from '../../src/features/deleteData/confirmWord';
import { deleteAllData } from '../../src/features/deleteData/deleteAllData';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { startOver } from '../../src/navigation/history';
import { ApiClientError } from '../../src/net/apiClient';
import { useSync } from '../../src/sync/SyncProvider';
import { Text } from '../../src/theme/Text';

/** Codes that mean the server copy cannot be deleted until the user signs in again. */
const SESSION_CODES = new Set(['session_expired', 'no_session']);

/**
 * §6.8 "Elimina tutti i dati". A screen rather than a dialog because what goes has to be read,
 * and a typed word rather than a second tap because nothing here can be undone (§8.6).
 */
export default function DeleteDataScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { api } = useServer();
  const { scheduler } = useSync();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = t('deleteData.confirmWord');

  const onDelete = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await deleteAllData({ db, api, scheduler, deleteAttachmentFiles: deleteAllAttachmentFiles });
      // No settings now: the boot router sends the user to onboarding, with nothing underneath.
      startOver(router, '/');
    } catch (caught) {
      const code = caught instanceof ApiClientError ? caught.code : null;
      setError(
        code !== null && SESSION_CODES.has(code)
          ? t('deleteData.signInFirst')
          : t('deleteData.failed'),
      );
      setBusy(false);
    }
  };

  return (
    <SettingScreen
      title={t('deleteData.title')}
      subtitle={api === null ? t('deleteData.bodyLocal') : t('deleteData.bodyServer')}
      card={false}
    >
      <Card>
        <TextField
          label={t('deleteData.typeToConfirm', { word })}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />
      </Card>
      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}
      <PrimaryButton
        label={t('deleteData.confirm')}
        disabled={!matchesConfirmWord(typed, word)}
        loading={busy}
        onPress={() => void onDelete()}
      />
    </SettingScreen>
  );
}
