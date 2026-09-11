import {
  detectPreset,
  IMPORT_FIELDS,
  type ImportField,
  type ImportMapping,
  type ImportPlan,
  mappingFor,
  type PresetName,
  parseCsv,
  planImport,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { Sheet } from '../../src/components/Sheet';
import { TextField } from '../../src/components/TextField';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { applyImport, existingFingerprints } from '../../src/io/importService';
import { Text } from '../../src/theme/Text';

/** How many planned rows the preview shows (§11.3 step 4). */
const PREVIEW_ROWS = 20;

interface LoadedFile {
  name: string;
  headers: string[];
  body: string[][];
  preset: PresetName;
}

type Step = 'pick' | 'map' | 'preview' | 'done';

/**
 * §11.3, as one screen with four states rather than four routes: the parsed file lives in state,
 * and a back button that dropped it would be worse than a step that says where you are.
 */
export default function ImportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { repos } = useDatabase();
  const settings = useSettings();
  const locale = useAppLocale();
  const currency = settings?.currency ?? 'EUR';
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [outcome, setOutcome] = useState<{ imported: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportField | null>(null);

  const pick = () => {
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['text/csv', 'text/comma-separated-values', '*/*'],
          copyToCacheDirectory: true,
        });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        if (asset === undefined) return;
        const { rows } = parseCsv(await new File(asset.uri).text());
        const headers = rows[0];
        if (headers === undefined || rows.length < 2) {
          setError(t('csvImport.empty'));
          return;
        }
        const preset = detectPreset(headers);
        setFile({ name: asset.name, headers, body: rows.slice(1), preset });
        setMapping(mappingFor(headers, preset));
        setStep('map');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('csvImport.failed'));
      } finally {
        setBusy(false);
      }
    })();
  };

  const buildPlan = () => {
    if (file === null || mapping === null || settings === null) return;
    setPlan(
      planImport(file.body, mapping, {
        currency: settings.currency,
        accounts: repos.accounts.list(),
        categories: repos.categories.list(),
        tags: repos.tags.list(),
        existingFingerprints: existingFingerprints(repos),
      }),
    );
    setStep('preview');
  };

  const confirm = () => {
    if (plan === null) return;
    setBusy(true);
    try {
      setOutcome(applyImport(db, repos, plan));
      setStep('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('csvImport.failed'));
    } finally {
      setBusy(false);
    }
  };

  const columnName = (index: number | null): string =>
    index === null ? t('csvImport.noColumn') : (file?.headers[index] ?? String(index));

  const setColumn = (index: number | null) => () => {
    const field = editing;
    if (field === null) return;
    setMapping((current) =>
      current === null ? current : { ...current, columns: { ...current.columns, [field]: index } },
    );
    setEditing(null);
  };

  return (
    <Screen>
      <ScreenHeader title={t('csvImport.title')} />

      {step === 'pick' ? (
        <Card>
          <Text color="textMuted">{t('csvImport.pickBody')}</Text>
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label={busy ? t('csvImport.reading') : t('csvImport.pick')}
              disabled={busy}
              onPress={pick}
            />
          </View>
        </Card>
      ) : null}

      {step === 'map' && file !== null && mapping !== null ? (
        <>
          <Card>
            <Text weight="medium">{file.name}</Text>
            <Text size="footnote" color="textMuted" style={{ marginTop: 4 }}>
              {t('csvImport.detected', {
                preset: t(`csvImport.preset_${file.preset}`),
                count: file.body.length,
              })}
            </Text>
          </Card>

          <SectionLabel>{t('csvImport.columns')}</SectionLabel>
          <Card padded={false}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              {IMPORT_FIELDS.map((field) => (
                <ListRow
                  key={field}
                  title={t(`csvImport.field_${field}`)}
                  trailing={<Text color="textMuted">{columnName(mapping.columns[field])}</Text>}
                  chevron
                  onPress={() => setEditing(field)}
                />
              ))}
            </View>
          </Card>

          <SectionLabel>{t('csvImport.options')}</SectionLabel>
          <Card>
            <TextField
              label={t('csvImport.defaultAccount')}
              placeholder={t('csvImport.defaultAccountPlaceholder')}
              value={mapping.defaultAccountName ?? ''}
              onChangeText={(value) =>
                setMapping({ ...mapping, defaultAccountName: value === '' ? null : value })
              }
            />
            <View style={{ height: 12 }} />
            <TextField
              label={t('csvImport.defaultCategory')}
              placeholder={t('csvImport.defaultCategoryPlaceholder')}
              value={mapping.defaultCategoryName ?? ''}
              onChangeText={(value) =>
                setMapping({ ...mapping, defaultCategoryName: value === '' ? null : value })
              }
            />
          </Card>

          <PrimaryButton label={t('csvImport.preview')} onPress={buildPlan} />
        </>
      ) : null}

      {step === 'preview' && plan !== null ? (
        <>
          <Card>
            <Text weight="medium">
              {t('csvImport.summary', {
                imported: plan.transactions.length,
                skipped: plan.duplicates,
                errors: plan.errors.length,
              })}
            </Text>
            {plan.newAccounts.length + plan.newCategories.length + plan.newTags.length > 0 ? (
              <Text size="footnote" color="textMuted" style={{ marginTop: 8 }}>
                {t('csvImport.willCreate', {
                  accounts: plan.newAccounts.length,
                  categories: plan.newCategories.length,
                  tags: plan.newTags.length,
                })}
              </Text>
            ) : null}
          </Card>

          {plan.errors.length > 0 ? (
            <Card>
              <Text size="footnote" color="accent">
                {plan.errors
                  .slice(0, PREVIEW_ROWS)
                  .map((row) =>
                    t('csvImport.errorRow', {
                      row: row.rowNumber,
                      reason: t(`csvImport.reason_${row.reason}`),
                      value: row.value,
                    }),
                  )
                  .join('\n')}
              </Text>
            </Card>
          ) : null}

          <Card padded={false}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              {plan.transactions.slice(0, PREVIEW_ROWS).map((row) => (
                <ListRow
                  key={`${row.rowNumber}-${row.fingerprint}`}
                  title={row.description === '' ? row.categoryName : row.description}
                  subtitle={`${row.date} · ${row.accountName} · ${row.categoryName}`}
                  trailing={
                    <Text color={row.kind === 'income' ? 'positive' : 'textMuted'}>
                      {formatMoney(
                        row.kind === 'income' ? row.amount : -row.amount,
                        currency,
                        locale,
                      )}
                    </Text>
                  }
                />
              ))}
            </View>
          </Card>

          <PrimaryButton
            label={t('csvImport.confirm', { count: plan.transactions.length })}
            disabled={busy || plan.transactions.length === 0}
            onPress={confirm}
          />
          <SecondaryButton label={t('csvImport.backToMapping')} onPress={() => setStep('map')} />
        </>
      ) : null}

      {step === 'done' && outcome !== null ? (
        <>
          <Card>
            <Text weight="medium">
              {t('csvImport.done', {
                imported: outcome.imported,
                skipped: outcome.skipped,
                errors: plan?.errors.length ?? 0,
              })}
            </Text>
          </Card>
          <PrimaryButton
            label={t('csvImport.seeTransactions')}
            onPress={() => router.replace('/(tabs)/transactions')}
          />
        </>
      ) : null}

      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === null ? '' : t(`csvImport.field_${editing}`)}
      >
        <ListRow title={t('csvImport.noColumn')} onPress={setColumn(null)} />
        {(file?.headers ?? []).map((header, index) => (
          <ListRow
            // biome-ignore lint/suspicious/noArrayIndexKey: the position is the identity — this is column N of the file, and the list never reorders.
            key={`${header}-${index}`}
            title={header === '' ? t('csvImport.unnamedColumn', { index: index + 1 }) : header}
            subtitle={file?.body[0]?.[index] ?? undefined}
            onPress={setColumn(index)}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
