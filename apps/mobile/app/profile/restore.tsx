import { readBackup } from '@saldo/core';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { unzipSync } from 'fflate';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { extensionFor, fileFor } from '../../src/attachments/localFiles';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { createClock } from '../../src/db/clock';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { applyRestore } from '../../src/io/restoreService';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §11.2, on its own screen.
 *
 * It used to share a screen with the export, which meant one row in the Profile called "Esporta i
 * dati" and another called "Ripristina backup" opened the same thing. They are also opposites: one
 * hands a file out, the other replaces everything this device holds — and that one wants the room
 * to say so before it happens.
 */
export default function RestoreScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { repos, kv } = useDatabase();
  const clock = useMemo(() => createClock(kv), [kv]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    text: string;
    rows: number;
    files: Record<string, Uint8Array>;
  } | null>(null);

  const pick = () => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['application/json', 'application/zip', '*/*'],
          copyToCacheDirectory: true,
        });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        if (asset === undefined) return;
        const raw = new File(asset.uri).bytesSync();
        // A ZIP starts with "PK"; sniffing beats trusting a filename or a MIME type the picker
        // guessed, and the two backup shapes are otherwise indistinguishable to the user.
        const isZip = raw[0] === 0x50 && raw[1] === 0x4b;
        const files = isZip ? unzipSync(raw) : {};
        const json = files['backup.json'];
        if (isZip && json === undefined) {
          setError(t('io.restore_not-a-backup'));
          return;
        }
        const text = new TextDecoder().decode(json ?? raw);
        const result = readBackup(text);
        if (!result.ok) {
          setError(
            result.reason === 'invalid'
              ? t('io.restoreInvalidRows', { count: result.errors.length })
              : t(`io.restore_${result.reason}`),
          );
          return;
        }
        const { accounts, categories, tags, recurrences, transactions, budgets } =
          result.backup.data;
        const rows =
          1 +
          accounts.length +
          categories.length +
          tags.length +
          recurrences.length +
          transactions.length +
          budgets.length;
        setPending({ text, rows, files });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('io.exportFailed'));
      } finally {
        setBusy(false);
      }
    })();
  };

  const confirmRestore = () => {
    const chosen = pending;
    setPending(null);
    if (chosen === null) return;
    // Re-read rather than keep the parsed backup in state: the file was validated a moment ago,
    // and this keeps the confirmation holding text instead of a whole database in memory.
    const result = readBackup(chosen.text);
    if (!result.ok) {
      setError(t('io.exportFailed'));
      return;
    }
    const outcome = applyRestore({
      db,
      clock,
      backup: result.backup,
      now: new Date().toISOString(),
    });
    // The files come after the rows, and only for attachments the backup actually carried: a row
    // whose bytes are missing is one this device fetches later, not a broken restore.
    for (const attachment of result.backup.data.attachments) {
      const bytes =
        chosen.files[`attachments/${attachment.id}.${extensionFor(attachment.mimeType)}`];
      if (bytes === undefined) continue;
      const target = fileFor(attachment.id, attachment.mimeType);
      if (target.exists) target.delete();
      target.create();
      target.write(bytes);
      repos.attachments.setLocalUri(attachment.id, target.uri);
    }
    toast.show(t('io.restored', { count: outcome.restored }));
    // Settings, accounts and categories all changed underneath every screen, so go back through
    // the boot router rather than leaving stale lists behind.
    router.replace('/');
  };

  return (
    <Screen>
      <BackButton />
      <Text size="display" weight="semibold" tracking="tighter">
        {t('io.restoreSection')}
      </Text>
      <Text color="textMuted">{t('io.restoreScreenNote')}</Text>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
          <ListRow
            title={t('io.restoreBackup')}
            subtitle={t('io.restoreHint')}
            onPress={busy ? undefined : pick}
            chevron
          />
        </View>
      </Card>

      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}

      <ConfirmDialog
        visible={pending !== null}
        title={t('io.restoreConfirmTitle')}
        body={t('io.restoreConfirmBody', { count: pending?.rows ?? 0 })}
        confirmLabel={t('io.restoreConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmRestore}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}
