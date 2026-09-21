import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { tagUsage } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useTagsQuery } from '../../src/db/hooks';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.13 / §5.10. */
export default function TagsAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const { rows: tags, loaded } = useTagsQuery();
  const usage = useMemo(() => tagUsage(repos), [repos]);

  return (
    <Screen refreshable>
      <BackButton />
      <Text size="display" weight="semibold" tracking="tighter">
        {t('tags.title')}
      </Text>
      <Text color="textMuted">{t('tags.footnote')}</Text>

      {!loaded ? null : tags.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="chips"
          title={t('tags.empty')}
          body={t('tags.emptyBody')}
          // Tags have no screen of their own to be born on: they are typed into a transaction.
          action={{
            label: t('transactions.newTransaction'),
            onPress: () => router.push('/transaction/new'),
          }}
        />
      ) : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {tags.map((tag) => (
              <ListRow
                key={tag.id}
                title={tag.name}
                subtitle={t('tags.uses', { count: usage.get(tag.id) ?? 0 })}
                onPress={() => router.push({ pathname: '/tag/[id]', params: { id: tag.id } })}
                chevron
              />
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}
