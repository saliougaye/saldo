import { readBackup } from '@saldo/core';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { createClock } from '../../src/db/clock';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import {
  buildBackupFile,
  buildCsvFile,
  type ExportFile,
  NothingToExportError,
} from '../../src/io/exportService';
import { applyRestore } from '../../src/io/restoreService';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §11.1 and §11.2. Writing the file and handing it to the share sheet is all this screen does:
 * what goes *inside* the file is decided by `@saldo/core` and `src/io`, which are tested without a
 * simulator.
 */
export default function ExportScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { repos, kv } = useDatabase();
  const { today, period } = usePeriod();
  const clock = useMemo(() => createClock(kv), [kv]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ text: string; rows: number } | null>(null);

  const describe = (caught: unknown): string => {
    if (caught instanceof NothingToExportError) return t('io.nothingToExport');
    return caught instanceof Error ? caught.message : t('io.exportFailed');
  };

  /** The cache, not the documents directory: a file already shared is not the app's own data. */
  const share = async (file: ExportFile) => {
    const target = new File(Paths.cache, file.name);
    if (target.exists) target.delete();
    target.create();
    target.write(file.contents);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(target.uri, { mimeType: file.mimeType, UTI: file.mimeType });
    } else {
      toast.show(t('io.savedTo', { name: file.name }));
    }
  };

  const stamp = () => ({
    today,
    exportedAt: new Date().toISOString(),
    appVersion: Application.nativeApplicationVersion ?? '0.1.0',
  });

  const run = (build: () => ExportFile) => () => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await share(build());
      } catch (caught) {
        setError(describe(caught));
      } finally {
        setBusy(false);
      }
    })();
  };

  const pick = () => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['application/json', '*/*'],
          copyToCacheDirectory: true,
        });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        if (asset === undefined) return;
        const text = await new File(asset.uri).text();
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
        setPending({ text, rows });
      } catch (caught) {
        setError(describe(caught));
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
    toast.show(t('io.restored', { count: outcome.restored }));
    // Settings, accounts and categories all changed underneath every screen, so go back through
    // the boot router rather than leaving stale lists behind.
    router.replace('/');
  };

  const rows = { paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 };

  return (
    <Screen>
      <ScreenHeader title={t('io.title')} />

      <SectionLabel>{t('io.exportSection')}</SectionLabel>
      <Card padded={false}>
        <View style={rows}>
          <ListRow
            title={t('io.backupJson')}
            subtitle={t('io.backupJsonHint')}
            onPress={busy ? undefined : run(() => buildBackupFile(repos, stamp()))}
          />
          <ListRow
            title={t('io.csvPeriod')}
            subtitle={t('io.csvPeriodHint')}
            onPress={
              busy ? undefined : run(() => buildCsvFile(repos, { today, range: period.range }))
            }
          />
          <ListRow
            title={t('io.csvAll')}
            onPress={busy ? undefined : run(() => buildCsvFile(repos, { today, range: null }))}
          />
        </View>
      </Card>

      <SectionLabel>{t('io.restoreSection')}</SectionLabel>
      <Card padded={false}>
        <View style={rows}>
          <ListRow
            title={t('io.restoreBackup')}
            subtitle={t('io.restoreHint')}
            onPress={busy ? undefined : pick}
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
