import { type Category, minorToAmountBuffer } from '@saldo/core';
import { categoryColors, categoryIconGroups, ICON_NAMES, type IconName } from '@saldo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface CategoryFormValues {
  name: string;
  direction: Category['direction'];
  icon: IconName;
  colorIndex: number;
  parentId: string | null;
  /** §6.19: a single-category cycle budget, created or updated on save. */
  budgetEnabled: boolean;
  budgetBuffer: string;
}

export function emptyCategoryForm(): CategoryFormValues {
  return {
    name: '',
    direction: 'expense',
    icon: 'tag',
    colorIndex: 0,
    parentId: null,
    budgetEnabled: false,
    budgetBuffer: '',
  };
}

export function categoryFormFrom(
  category: Category,
  budgetAmount: number | null,
  minorDigits: 0 | 2 | 3,
): CategoryFormValues {
  return {
    name: category.name,
    direction: category.direction,
    icon: category.icon as IconName,
    colorIndex: category.colorIndex,
    parentId: category.parentId,
    budgetEnabled: budgetAmount !== null,
    budgetBuffer: budgetAmount === null ? '' : minorToAmountBuffer(budgetAmount, minorDigits),
  };
}

export interface CategoryFormProps {
  values: CategoryFormValues;
  onChange: (values: CategoryFormValues) => void;
  mode: 'new' | 'edit';
  /** Excluded from the parent picker, and used to hide it when the category has children. */
  editingCategoryId?: string;
  onSubmit: () => void;
  onArchive?: () => void;
}

/** §6.19. */
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
  const [iconQuery, setIconQuery] = useState('');
  const set = (patch: Partial<CategoryFormValues>) => onChange({ ...values, ...patch });

  // A child cannot have children (§4), so the parent picker disappears once one exists.
  const hasChildren = categories.some((category) => category.parentId === editingCategoryId);
  const parents = categories.filter(
    (category) =>
      category.parentId === null &&
      category.direction === values.direction &&
      category.archivedAt === null &&
      category.id !== editingCategoryId,
  );

  const searchResults = useMemo(() => {
    const query = iconQuery.trim().toLowerCase();
    if (query.length === 0) return null;
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(query));
  }, [iconQuery]);

  const colour = theme.categoryColor(values.colorIndex);
  const ready = values.name.trim().length > 0;

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton label={t('common.save')} disabled={!ready} onPress={onSubmit} />
          {onArchive === undefined ? null : (
            <SecondaryButton label={t('categories.archive')} onPress={onArchive} />
          )}
        </View>
      }
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {mode === 'new' ? t('categories.newCategory') : t('categories.editCategory')}
      </Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBox name={values.icon} colour={colour} />
          <Text weight="medium" style={{ flex: 1 }} numberOfLines={1}>
            {values.name.length > 0 ? values.name : t('categories.name')}
          </Text>
        </View>
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

      <Card>
        <TextField
          label={t('categories.iconSearch')}
          value={iconQuery}
          onChangeText={setIconQuery}
        />
        {searchResults === null ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            {categoryIconGroups.map((group) => (
              <View key={group.key} style={{ gap: 6 }}>
                <Text size="caption" color="textFaint">
                  {t(`iconGroups.${group.key}`)}
                </Text>
                <IconGrid
                  names={group.icons}
                  selected={values.icon}
                  colour={colour}
                  onSelect={(icon) => set({ icon })}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <IconGrid
              names={searchResults}
              selected={values.icon}
              colour={colour}
              onSelect={(icon) => set({ icon })}
            />
          </View>
        )}
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('categories.colour')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {categoryColors.map((swatch, index) => (
            <Pressable
              key={swatch}
              accessibilityRole="button"
              accessibilityState={{ selected: index === values.colorIndex }}
              accessibilityLabel={swatch}
              onPress={() => set({ colorIndex: index })}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: swatch,
                borderWidth: index === values.colorIndex ? 2 : 0,
                borderColor: theme.palette.text,
              }}
            />
          ))}
        </View>
      </Card>

      {hasChildren ? null : (
        <Card>
          <Text size="footnote" color="textMuted">
            {t('categories.parent')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {[{ id: null, name: t('categories.noParent') }, ...parents].map((option) => {
              const selected = option.id === values.parentId;
              return (
                <Pressable
                  key={option.id ?? 'none'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => set({ parentId: option.id })}
                  style={{
                    paddingHorizontal: 10,
                    height: 30,
                    justifyContent: 'center',
                    borderRadius: theme.radii.chipSmall,
                    backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                  }}
                >
                  <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
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
                doneLabel={t('common.done')}
              />
            </View>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

function IconGrid({
  names,
  selected,
  colour,
  onSelect,
}: {
  names: readonly IconName[];
  selected: IconName;
  colour: string;
  onSelect: (name: IconName) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {names.map((name) => {
        const isSelected = name === selected;
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={name}
            onPress={() => onSelect(name)}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.iconBox,
              backgroundColor: isSelected ? theme.tint(colour, 0.18) : theme.palette.raised,
            }}
          >
            <Icon name={name} size={18} color={isSelected ? colour : theme.palette.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
