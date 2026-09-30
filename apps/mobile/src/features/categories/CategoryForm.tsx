import {
  type CategoryFormValues,
  categoryMissingForSave,
  categoryParentCandidates,
} from '@saldo/core';
import { categoryIconGroups, type IconName } from '@saldo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { AppearanceSheet } from '../../components/AppearanceSheet';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBox, ListRow } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { ParentPickerSheet } from './ParentPickerSheet';

export interface CategoryFormProps {
  values: CategoryFormValues;
  onChange: (values: CategoryFormValues) => void;
  mode: 'new' | 'edit';
  /** Excluded from the parent picker, and used to hide it when the category has children. */
  editingCategoryId?: string;
  onSubmit: () => void;
  onArchive?: () => void;
}

/** §6.19. Same shape for new and edit: only `autoFocus` and the archive button differ. */
export function CategoryForm({
  values,
  onChange,
  mode,
  editingCategoryId,
  onSubmit,
  onArchive,
}: CategoryFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const currency = settings?.currency ?? 'EUR';
  const set = (patch: Partial<CategoryFormValues>) => onChange({ ...values, ...patch });

  const [sheet, setSheet] = useState<'none' | 'appearance' | 'parent'>('none');
  const close = () => setSheet('none');

  // A child cannot have children (§4), so the parent picker disappears once one exists.
  const hasChildren = categories.some((category) => category.parentId === editingCategoryId);
  const parents = categoryParentCandidates(categories, values.direction, editingCategoryId ?? null);
  const parentName =
    values.parentId === null
      ? t('categories.noParent')
      : (parents.find((category) => category.id === values.parentId)?.name ??
        t('categories.noParent'));

  const colour = theme.categoryColor(values.colorIndex);
  const missing = categoryMissingForSave(values);

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {missing === null ? null : (
            // Not an error — nothing is wrong yet — so it is a muted line, not a red one.
            <Text size="footnote" color="textMuted">
              {t(`categories.missing_${missing}`)}
            </Text>
          )}
          <PrimaryButton label={t('common.save')} disabled={missing !== null} onPress={onSubmit} />
          {onArchive === undefined ? null : (
            <SecondaryButton label={t('categories.archive')} onPress={onArchive} />
          )}
        </View>
      }
    >
      <ScreenHeader
        title={mode === 'new' ? t('categories.newCategory') : t('categories.editCategory')}
      />

      {/*
        The preview is the control. It already drew the result — the icon in its colour next to the
        name — so it is the obvious thing to tap for it, and tapping it is what keeps the whole icon
        library (six groups plus a search field, the tallest block in the app) off a form that also
        has to hold a colour, a parent and a budget. Those three used to sit under it, unseen.
      */}
      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.appearance')}
          onPress={() => setSheet('appearance')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: theme.layout.minHitTarget,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <IconBox name={values.icon as IconName} colour={colour} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="medium" numberOfLines={1}>
              {values.name.length > 0 ? values.name : t('categories.name')}
            </Text>
            <Text size="footnote" color="textMuted">
              {t('common.appearance')}
            </Text>
          </View>
          <Icon name="chevR" size={16} color={theme.palette.textFaint} />
        </Pressable>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('categories.name')}
            value={values.name}
            onChangeText={(name) => set({ name })}
            autoFocus={mode === 'new'}
          />
          {mode === 'new' ? (
            <Segmented
              accessibilityLabel={t('categories.title')}
              options={[
                { value: 'expense', label: t('categories.expenses') },
                { value: 'income', label: t('categories.income') },
              ]}
              value={values.direction}
              onChange={(direction) => set({ direction, parentId: null })}
            />
          ) : null}
        </View>
      </Card>

      {hasChildren ? null : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            <ListRow
              title={t('categories.parent')}
              subtitle={parentName}
              onPress={() => setSheet('parent')}
              chevron
            />
          </View>
        </Card>
      )}

      {values.direction === 'income' ? null : (
        <Card>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ flex: 1 }}>{t('categories.monthlyBudget')}</Text>
            <Toggle
              value={values.budgetEnabled}
              onChange={(budgetEnabled) => set({ budgetEnabled })}
              accessibilityLabel={t('categories.monthlyBudget')}
            />
          </View>
          {values.budgetEnabled ? (
            <View style={{ marginTop: 10 }}>
              <AmountInput
                buffer={values.budgetBuffer}
                onChange={(budgetBuffer) => set({ budgetBuffer })}
                currency={currency}
                locale={locale}
                label={t('categories.monthlyBudget')}
                doneLabel={t('common.done')}
              />
            </View>
          ) : null}
        </Card>
      )}

      <AppearanceSheet
        visible={sheet === 'appearance'}
        onClose={close}
        colorIndex={values.colorIndex}
        icon={values.icon as IconName}
        groups={categoryIconGroups}
        searchable
        onChange={({ colorIndex, icon }) => set({ colorIndex, icon })}
      />

      <ParentPickerSheet
        visible={sheet === 'parent'}
        onClose={close}
        parents={parents}
        selectedId={values.parentId}
        onSelect={(parentId) => set({ parentId })}
      />
    </Screen>
  );
}
