import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { SkeletonList } from '../../src/components/Skeleton';
import { useDelayed } from '../../src/components/useDelayed';
import { useTagsQuery, useTagUsage } from '../../src/db/hooks';
import { NewTagSheet } from '../../src/features/tags/NewTagSheet';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.13 / §5.10. */
export default function TagsAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { rows: tags, loaded } = useTagsQuery();
  const slow = useDelayed(!loaded);
  const usage = useTagUsage();
  const [creating, setCreating] = useState(false);

  return (
    <Screen refreshable>
      <BackButton />
      {/* "+" on the title row, where Categorie keeps its own (§6.9). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('tags.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tags.newTag')}
          hitSlop={10}
          onPress={() => setCreating(true)}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>
      <Text color="textMuted">{t('tags.footnote')}</Text>

      {!loaded ? (
        slow ? (
          <SkeletonList rows={4} label={t('common.loading')} />
        ) : null
      ) : tags.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="chips"
          title={t('tags.empty')}
          body={t('tags.emptyBody')}
          action={{ label: t('tags.newTag'), onPress: () => setCreating(true) }}
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

      <NewTagSheet visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );
}
