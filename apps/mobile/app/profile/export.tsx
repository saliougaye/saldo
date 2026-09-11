import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { extensionFor, readBytes } from '../../src/attachments/localFiles';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { useToast } from '../../src/components/Toast';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import {
  buildBackupFile,
  buildCsvFile,
  buildZipBackup,
  type ExportFile,
  NothingToExportError,
} from '../../src/io/exportService';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §11.1. Writing the file and handing it to the share sheet is all this screen does:
 * what goes *inside* the file is decided by `@saldo/core` and `src/io`, which are tested without a
 * simulator.
 */
export default function ExportScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { repos } = useDatabase();
  const { today, period } = usePeriod();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describe = (caught: unknown): string => {
    if (caught instanceof NothingToExportError) return t('io.nothingToExport');
    return caught instanceof Error ? caught.message : t('io.exportFailed');
  };

  /** The cache, not the documents directory: a file already shared is not the app's own data. */
  const share = async (
    file: ExportFile | { name: string; contents: Uint8Array; mimeType: string },
  ) => {
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

  const run =
    (build: () => ExportFile | { name: string; contents: Uint8Array; mimeType: string }) => () => {
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
            title={t('io.backupZip')}
            subtitle={t('io.backupZipHint')}
            onPress={
              busy
                ? undefined
                : run(() => {
                    const zip = buildZipBackup(repos, stamp(), (id) => {
                      const row = repos.attachments.byId(id);
                      const bytes =
                        row?.localUri === undefined || row.localUri === null
                          ? null
                          : readBytes(row.localUri);
                      return bytes === null || row === null
                        ? null
                        : { id, extension: extensionFor(row.mimeType), bytes };
                    });
                    if (zip.missing.length > 0) {
                      toast.show(t('io.zipMissing', { count: zip.missing.length }));
                    }
                    return zip;
                  })
            }
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

      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}
    </Screen>
  );
}
