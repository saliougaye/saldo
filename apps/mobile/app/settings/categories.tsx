import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { restoreCategory } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useCategories, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.9 / §5.11. Delete is deliberately not offered: archive, optionally moving the rows. */
export default function CategoriesAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const all = useCategories();
  const { today } = usePeriod();
  const rows = useTransactionsInRange('1970-01-01', today);
  const [showArchived, setShowArchived] = useState(false);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of rows) {
      if (tx.categoryId === null) continue;
      counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const archived = all.filter((category) => category.archivedAt !== null);
  const live = all.filter((category) => category.archivedAt === null);

  const section = (direction: 'expense' | 'income') => {
    const parents = live.filter(
      (category) => category.direction === direction && category.parentId === null,
    );
    return (
      <View key={direction}>
        <SectionLabel>
          {direction === 'expense' ? t('categories.expenses') : t('categories.income')}
        </SectionLabel>
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {parents.flatMap((parent) => [
              <ListRow
                key={parent.id}
                title={parent.name}
                subtitle={t('categories.uses', { count: usage.get(parent.id) ?? 0 })}
                leading={
                  <IconBox
                    name={parent.icon as IconName}
                    colour={theme.categoryColor(parent.colorIndex)}
                  />
                }
                onPress={() =>
                  router.push({ pathname: '/category/edit/[id]', params: { id: parent.id } })
                }
                chevron
              />,
              ...live
                .filter((child) => child.parentId === parent.id)
                .map((child) => (
                  <View key={child.id} style={{ paddingLeft: 32 }}>
                    <ListRow
                      title={child.name}
                      subtitle={t('categories.uses', { count: usage.get(child.id) ?? 0 })}
                      leading={
                        <IconBox
                          name={child.icon as IconName}
                          colour={theme.categoryColor(child.colorIndex)}
                          small
                        />
                      }
                      onPress={() =>
                        router.push({ pathname: '/category/edit/[id]', params: { id: child.id } })
                      }
                      chevron
                    />
                  </View>
                )),
            ])}
          </View>
        </Card>
      </View>
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('categories.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categories.newCategory')}
          hitSlop={10}
          onPress={() => router.push('/category/new')}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      {section('expense')}
      {section('income')}

      {archived.length === 0 ? null : (
        <Card padded={false}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowArchived(!showArchived)}
            style={{ padding: theme.layout.cardPadding }}
          >
            <Text color="textMuted">
              {`${t('categories.archivedSection')} · ${archived.length}`}
            </Text>
          </Pressable>
          {showArchived ? (
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
              {archived.map((category) => (
                <ListRow
                  key={category.id}
                  title={category.name}
                  leading={
                    <IconBox name={category.icon as IconName} colour={theme.palette.textFaint} />
                  }
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => restoreCategory(repos, category.id)}
                    >
                      <Text size="footnote" color="accent">
                        {t('accounts.restore')}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
