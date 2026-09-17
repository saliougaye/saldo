import {
  type CurrencyCode,
  detectPreset,
  IMPORT_FIELDS,
  type ImportContext,
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { ListRow } from '../../components/ListRow';
import { SectionLabel } from '../../components/SectionLabel';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';

/** How many planned rows the preview shows (§11.3 step 4). */
const PREVIEW_ROWS = 20;

interface LoadedFile {
  name: string;
  headers: string[];
  body: string[][];
  preset: PresetName;
}

type Step = 'pick' | 'map' | 'preview';

export interface ImportWizardProps {
  currency: CurrencyCode;
  /** What already exists, read when the preview is built so it reflects the latest rows. */
  context: () => Omit<ImportContext, 'currency'>;
  confirmLabel: (plan: ImportPlan) => string;
  /** The user accepted the preview. Writing it — now, or at the end of onboarding — is the caller's call. */
  onConfirm: (plan: ImportPlan) => void;
  /** The caller is writing the plan. */
  confirming?: boolean;
}

/**
 * §11.3 steps 1–4 — file, preset, mapping, preview — as one component with three states rather than
 * routes: the parsed file lives in state, and a back button that dropped it would be worse than a
 * step that says where you are. Profile applies the plan straight away; onboarding keeps it until
 * "Inizia" (§6.29).
 */
export function ImportWizard({
  currency,
  context,
  confirmLabel,
  onConfirm,
  confirming = false,
}: ImportWizardProps) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
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
    if (file === null || mapping === null) return;
    setPlan(planImport(file.body, mapping, { currency, ...context() }));
    setStep('preview');
  };

  /** "1 conto, 3 categorie e 2 etichette": only what there is, and counted properly. */
  const willCreate = (current: ImportPlan): string | null => {
    const parts = [
      current.newAccounts.length > 0
        ? t('csvImport.willCreateAccounts', { count: current.newAccounts.length })
        : null,
      current.newCategories.length > 0
        ? t('csvImport.willCreateCategories', { count: current.newCategories.length })
        : null,
      current.newTags.length > 0
        ? t('csvImport.willCreateTags', { count: current.newTags.length })
        : null,
    ].filter((part): part is string => part !== null);
    if (parts.length === 0) return null;
    const last = parts.pop() ?? '';
    return parts.length === 0 ? last : `${parts.join(', ')} ${t('common.and')} ${last}`;
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
    <>
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
            {willCreate(plan) === null ? null : (
              <Text size="footnote" color="textMuted" style={{ marginTop: 8 }}>
                {t('csvImport.willCreate', { what: willCreate(plan) })}
              </Text>
            )}
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
            label={confirmLabel(plan)}
            disabled={busy || confirming || plan.transactions.length === 0}
            onPress={() => onConfirm(plan)}
          />
          <SecondaryButton label={t('csvImport.backToMapping')} onPress={() => setStep('map')} />
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
    </>
  );
}
