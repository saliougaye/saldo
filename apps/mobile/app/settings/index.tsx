import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useCategories, useSettings, useTags } from '../../src/db/hooks';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.7. */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const settings = useSettings();
  const categories = useCategories();
  const tags = useTags();

  return (
    <Screen>
      <BackButton />
      <Text size="display" weight="semibold" tracking="tighter">
        {t('settings.title')}
      </Text>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('settings.categories')}
            trailing={<Text color="textMuted">{String(categories.length)}</Text>}
            onPress={() => router.push('/settings/categories')}
            chevron
          />
          <ListRow
            title={t('settings.tags')}
            trailing={<Text color="textMuted">{String(tags.length)}</Text>}
            onPress={() => router.push('/settings/tags')}
            chevron
          />
          <ListRow
            title={t('settings.cycle')}
            trailing={
              <Text color="textMuted">
                {t('settings.cycleValue', { day: settings?.cycleStartDay ?? 27 })}
              </Text>
            }
            onPress={() => router.push('/profile')}
            chevron
          />
          <ListRow
            title={t('settings.currency')}
            trailing={<Text color="textMuted">{settings?.currency ?? 'EUR'}</Text>}
            onPress={() => router.push('/profile')}
            chevron
          />
          <ListRow
            title={t('settings.newAccount')}
            onPress={() => router.push('/account/new')}
            chevron
          />
          <ListRow
            title={t('settings.reviewOnboarding')}
            onPress={() => router.push('/cycle-day')}
            chevron
          />
        </View>
      </Card>
    </Screen>
  );
}
