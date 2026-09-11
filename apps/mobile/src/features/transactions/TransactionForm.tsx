import DateTimePicker from '@react-native-community/datetimepicker';
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { IconBox } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useRepositories } from '../../db/DatabaseProvider';
import {
  useAccounts,
  useCategories,
  useSettings,
  useTags,
  useTransactionsInRange,
} from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AttachmentStrip } from './AttachmentStrip';
import {
  canCreateTag,
  canSave,
  changeKind,
  dateChoices,
  type TransactionFormValues,
  tagSuggestions,
  topCategories,
} from './useTransactionForm';

export interface TransactionFormProps {
  /** Captured once by the caller so every screen agrees on the calendar day (§3.2). */
  today: string;
  /**
   * The id the transaction has or will have. Attachments need it before the row exists, so a new
   * transaction gets its id from the screen rather than from the repository (§10).
   */
  transactionId: string;
  values: TransactionFormValues;
  onChange: (values: TransactionFormValues) => void;
  /** Edit mode opens with the keypad closed and a full-width save button (§6.16). */
  mode: 'new' | 'edit';
  onSubmit: () => void;
  onDelete?: () => void;
  submitting?: boolean;
}

const KINDS = ['expense', 'income', 'transfer'] as const;

export function TransactionForm({
  today,
  transactionId,
  values,
  onChange,
  mode,
  onSubmit,
  onDelete,
  submitting = false,
}: TransactionFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const currency = settings?.currency ?? 'EUR';
  const { minorDigits } = getCurrency(currency);

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');

  // Usage counts come from the last year of rows, which is enough to rank categories and tags.
  const recent = useTransactionsInRange('1970-01-01', values.date);
  const grid = useMemo(
    () =>
      showAllCategories
        ? categories.filter(
            (category) =>
              category.direction === (values.kind === 'income' ? 'income' : 'expense') &&
              category.archivedAt === null,
          )
        : topCategories(categories, recent, values.kind),
    [categories, recent, values.kind, showAllCategories],
  );
  const suggestions = useMemo(
    () => tagSuggestions(tags, recent, tagQuery, values.tagIds),
    [tags, recent, tagQuery, values.tagIds],
  );

  const liveAccounts = accounts.filter((account) => account.archivedAt === null);
  const _amount = amountBufferToMinor(values.buffer, minorDigits);
  const ready = canSave(values, minorDigits);

  const set = (patch: Partial<TransactionFormValues>) => onChange({ ...values, ...patch });

  const accountRow = (label: string, selectedId: string | null, onSelect: (id: string) => void) => (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {liveAccounts.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            active={account.id === selectedId}
            onPress={() => onSelect(account.id)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton
            label={mode === 'new' ? t('txForm.create') : t('txForm.save')}
            disabled={!ready}
            loading={submitting}
            onPress={onSubmit}
          />
          {onDelete === undefined ? null : (
            <SecondaryButton label={t('common.delete')} onPress={onDelete} />
          )}
        </View>
      }
    >
      <ScreenHeader title={mode === 'new' ? t('txForm.newTitle') : t('txForm.editTitle')} />

      <Segmented
        accessibilityLabel={t('txForm.amount')}
        options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        value={values.kind}
        onChange={(kind) => onChange(changeKind(values, kind))}
      />

      <Card>
        <Text size="footnote" color="textMuted">
          {t('txForm.amount')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            buffer={values.buffer}
            onChange={(buffer: string) => set({ buffer })}
            currency={currency}
            locale={locale}
            autoFocus={mode === 'new'}
            doneLabel={t('common.done')}
          />
        </View>
      </Card>

      {values.kind === 'transfer' ? (
        <Card>
          <View style={{ gap: 14 }}>
            {accountRow(t('txForm.from'), values.accountId, (id) => set({ accountId: id }))}
            {accountRow(t('txForm.to'), values.toAccountId, (id) => set({ toAccountId: id }))}
          </View>
        </Card>
      ) : (
        <>
          <Card>
            <Text size="footnote" color="textMuted">
              {t('txForm.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {grid.map((category) => {
                const selected = category.id === values.categoryId;
                const colour = theme.categoryColor(category.colorIndex);
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={category.name}
                    onPress={() => set({ categoryId: category.id })}
                    style={{
                      width: '22%',
                      alignItems: 'center',
                      gap: 5,
                      paddingVertical: 10,
                      borderRadius: theme.radii.input,
                      borderWidth: 1,
                      borderColor: selected ? theme.palette.borderStrong : 'transparent',
                      backgroundColor: selected ? theme.tint(colour, 0.14) : 'transparent',
                    }}
                  >
                    <IconBox name={category.icon as IconName} colour={colour} small />
                    <Text size="caption" numberOfLines={1}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
              {showAllCategories ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllCategories(true)}
                  style={{
                    width: '22%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                  }}
                >
                  <Text size="caption" color="accent">
                    {t('txForm.otherCategory')}
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>
          <Card>
            {accountRow(t('txForm.account'), values.accountId, (id) => set({ accountId: id }))}
          </Card>
        </>
      )}

      <Card>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('txForm.date')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {dateChoices(today).map((choice) => (
                <Chip
                  key={choice.key}
                  label={t(`txForm.${choice.key}`)}
                  active={values.date === choice.date}
                  onPress={() => set({ date: choice.date })}
                />
              ))}
              <Chip
                label={formatLongDate(values.date, locale)}
                onPress={() => setDatePickerOpen(true)}
                chevron
              />
            </View>
          </View>
          <TextField
            label={t('txForm.description')}
            placeholder={
              values.kind === 'income'
                ? t('txForm.descriptionIncome')
                : t('txForm.descriptionExpense')
            }
            value={values.description}
            onChangeText={(description) => set({ description })}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <TextField
            label={t('transactions.tags')}
            placeholder={t('txForm.tagsPlaceholder')}
            value={tagQuery}
            onChangeText={setTagQuery}
          />
          {values.tagIds.length === 0 ? null : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {values.tagIds.map((id) => {
                const tag = tags.find((candidate) => candidate.id === id);
                return (
                  <Chip
                    key={id}
                    label={tag?.name ?? id}
                    active
                    onPress={() => set({ tagIds: values.tagIds.filter((value) => value !== id) })}
                  />
                );
              })}
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                onPress={() => {
                  set({ tagIds: [...values.tagIds, tag.id] });
                  setTagQuery('');
                }}
              />
            ))}
            {canCreateTag(tags, tagQuery) ? (
              <Chip
                label={t('txForm.createTag', { name: tagQuery.trim() })}
                onPress={() => {
                  const created = repos.tags.create({ name: tagQuery.trim() });
                  set({ tagIds: [...values.tagIds, created.id] });
                  setTagQuery('');
                }}
              />
            ) : null}
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <AttachmentStrip transactionId={transactionId} />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text>{t('txForm.repeat')}</Text>
            <Toggle
              value={values.repeat}
              onChange={(repeat) => set({ repeat })}
              accessibilityLabel={t('txForm.repeat')}
            />
          </View>
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{t('txForm.exclude')}</Text>
              <Toggle
                value={values.excludeFromTotals}
                onChange={(excludeFromTotals) => set({ excludeFromTotals })}
                accessibilityLabel={t('txForm.exclude')}
              />
            </View>
            <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
              {t('txForm.excludeNote')}
            </Text>
          </View>
        </View>
      </Card>

      {datePickerOpen ? (
        <DateTimePicker
          value={new Date(`${values.date}T12:00:00`)}
          mode="date"
          onChange={(_event, selected) => {
            setDatePickerOpen(false);
            if (selected === undefined) return;
            const year = selected.getFullYear();
            const month = String(selected.getMonth() + 1).padStart(2, '0');
            const day = String(selected.getDate()).padStart(2, '0');
            set({ date: `${year}-${month}-${day}` });
          }}
        />
      ) : null}
    </Screen>
  );
}
