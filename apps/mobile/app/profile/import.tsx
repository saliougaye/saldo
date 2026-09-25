import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorNote } from '../../src/components/ErrorNote';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { ImportWizard } from '../../src/features/import/ImportWizard';
import { applyImport, existingFingerprints } from '../../src/io/importService';
import { Text } from '../../src/theme/Text';

/** §11.3 from Profile: the wizard, written as soon as the preview is accepted. */
export default function ImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { repos } = useDatabase();
  const settings = useSettings();
  const [outcome, setOutcome] = useState<{
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <ScreenHeader title={t('csvImport.title')} />

      {outcome === null ? (
        <ImportWizard
          currency={settings?.currency ?? 'EUR'}
          context={() => ({
            accounts: repos.accounts.list(),
            categories: repos.categories.list(),
            tags: repos.tags.list(),
            existingFingerprints: existingFingerprints(repos),
          })}
          confirmLabel={(plan) => t('csvImport.confirm', { count: plan.transactions.length })}
          confirming={busy}
          onConfirm={(plan) => {
            setBusy(true);
            setError(null);
            try {
              setOutcome({ ...applyImport(db, repos, plan), errors: plan.errors.length });
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : t('csvImport.failed'));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <>
          <Card>
            <Text weight="medium">{t('csvImport.done', outcome)}</Text>
          </Card>
          <PrimaryButton
            label={t('csvImport.seeTransactions')}
            onPress={() => router.replace('/(tabs)/transactions')}
          />
        </>
      )}

      {error === null ? null : <ErrorNote message={error} />}
    </Screen>
  );
}
