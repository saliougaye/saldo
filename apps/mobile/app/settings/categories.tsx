import type { Category } from '@saldo/core';
import {
  childCategories,
  reorderSiblings,
  rollUpCategoryUsage,
  topLevelCategories,
} from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { SectionLabel } from '../../src/components/SectionLabel';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useCategories, useCategoryUsage } from '../../src/db/hooks';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { Icon } from '../../src/theme/Icon';
import { entering } from '../../src/theme/motion';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.9 / §5.11. Delete is deliberately not offered: archive, optionally moving the rows.
 *
 * **One row per top-level category, not a drawn tree.** Everywhere else in the app a row is a thing
 * and its depth is a screen; this was the only place that spent an indent and a second line of text
 * on every child, which made the list twice as long and filled half of it with "0 entries". The
 * children are now the parent's subtitle, and the parent's detail (§6.12) is where they are read
 * and edited — the same rule the accounts and the tags already follow.
 */
export default function CategoriesAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const all = useCategories();
  const direct = useCategoryUsage();
  const [reordering, setReordering] = useState(false);

  // §5.4: a parent id stands for its children too, so a parent never reads "0" above children
  // that carry the spending.
  const usage = useMemo(() => rollUpCategoryUsage(all, direct), [all, direct]);
  const archived = all.filter((category) => category.archivedAt !== null);

  const move = (siblings: readonly Category[], id: string, direction: -1 | 1) => {
    for (const write of reorderSiblings(siblings, id, direction)) {
      repos.categories.update(write.id, { sortOrder: write.sortOrder });
    }
  };

  const reorderButton = (
    siblings: readonly Category[],
    category: Category,
    direction: -1 | 1,
    index: number,
  ) => {
    const disabled = direction === -1 ? index === 0 : index === siblings.length - 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={t(direction === -1 ? 'categories.moveUp' : 'categories.moveDown', {
          name: category.name,
        })}
        disabled={disabled}
        onPress={() => move(siblings, category.id, direction)}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.chipSmall,
          backgroundColor: theme.palette.raised,
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <View style={direction === -1 ? { transform: [{ rotate: '180deg' }] } : undefined}>
          <Icon name="chevD" size={14} color={theme.palette.text} />
        </View>
      </Pressable>
    );
  };

  const row = (siblings: readonly Category[], category: Category, index: number) => {
    const children = childCategories(all, category.id);
    const uses = usage.get(category.id) ?? 0;
    return (
      <ListRow
        key={category.id}
        title={category.name}
        // The children, where the count used to sit: what a category contains is worth more than
        // a number that is zero on most rows. Counted *and* named, because a bare list of names in
        // the subtitle slot reads as a description — everywhere else here a subtitle is an
        // attribute of the row (a bank, a date, an account type), not the things inside it.
        subtitle={
          children.length === 0
            ? undefined
            : `${t('categories.subcategoriesCount', { count: children.length })} · ${children
                .map((child) => child.name)
                .join(', ')}`
        }
        subtitleLines={2}
        leading={
          <IconBox
            name={category.icon as IconName}
            colour={theme.categoryColor(category.colorIndex)}
          />
        }
        onPress={
          reordering
            ? undefined
            : () => router.push({ pathname: '/category/[id]', params: { id: category.id } })
        }
        chevron={!reordering}
        trailing={
          reordering ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {reorderButton(siblings, category, -1, index)}
              {reorderButton(siblings, category, 1, index)}
            </View>
          ) : uses === 0 ? undefined : (
            // Omitted at zero, as in the design: a column of "0" is noise, and an empty category
            // is already obvious from the row having nothing else on it.
            <Text size="footnote" color="textMuted" tabular>
              {String(uses)}
            </Text>
          )
        }
      />
    );
  };

  const section = (direction: 'expense' | 'income', index: number) => {
    const parents = topLevelCategories(all, direction);
    return (
      <Animated.View
        key={direction}
        entering={entering(index)}
        style={{ gap: theme.layout.cardGap }}
      >
        <SectionLabel>
          {direction === 'expense' ? t('categories.expenses') : t('categories.income')}
        </SectionLabel>
        {parents.length === 0 ? (
          <Card>
            <Text>{t('categories.empty')}</Text>
            <Text size="footnote" color="textMuted" style={{ marginTop: 4 }}>
              {t('categories.emptyNote')}
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
              {parents.map((parent, i) => row(parents, parent, i))}
            </View>
          </Card>
        )}
      </Animated.View>
    );
  };

  return (
    <SettingScreen
      title={t('categories.title')}
      subtitle={t('categories.subtitle')}
      card={false}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: reordering }}
            hitSlop={10}
            onPress={() => setReordering(!reordering)}
          >
            <Text size="footnote" color={reordering ? 'accent' : 'textMuted'}>
              {t(reordering ? 'common.done' : 'categories.reorder')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('categories.newCategory')}
            hitSlop={10}
            onPress={() => router.push('/category/new')}
          >
            <IconBox name="plus" colour={theme.palette.textMuted} small />
          </Pressable>
        </View>
      }
    >
      {section('expense', 0)}
      {section('income', 1)}

      {archived.length === 0 ? null : (
        // One door, not an accordion with no cue: the same row the Accounts tab uses.
        <Animated.View entering={entering(2)}>
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
              <ListRow
                title={t('categories.archived')}
                leading={<IconBox name="archive" colour={theme.palette.textFaint} small />}
                trailing={<Text color="textMuted">{String(archived.length)}</Text>}
                onPress={() => router.push('/settings/archived-categories')}
                chevron
              />
            </View>
          </Card>
        </Animated.View>
      )}
    </SettingScreen>
  );
}
