import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { tagUsage } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useTags } from '../../src/db/hooks';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.13 / §5.10. */
export default function TagsAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const usage = useMemo(() => tagUsage(repos), [repos]);

  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('tags.title')}
      </Text>
      <Text color="textMuted">{t('tags.footnote')}</Text>

      {tags.length === 0 ? (
        <Card>
          <Text color="textMuted">{t('tags.empty')}</Text>
        </Card>
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
