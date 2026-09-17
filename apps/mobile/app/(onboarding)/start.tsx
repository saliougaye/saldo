import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/**
 * §6.29, before step 1: where the data comes from. Asked first because the answer changes the
 * steps — an import brings its own accounts and categories, and a backup brings everything.
 */
export default function StartStep() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { setDraft } = useOnboarding();

  return (
    <Screen>
      <View style={{ paddingTop: 24, gap: 12 }}>
        <Text size="display" weight="semibold" tracking="tighter">
          {t('onboarding.startTitle')}
        </Text>
        <Text color="textMuted">{t('onboarding.startBody')}</Text>
      </View>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
          <ListRow
            testID="onboarding-start-fresh"
            title={t('onboarding.startFresh')}
            subtitle={t('onboarding.startFreshHint')}
            onPress={() => {
              setDraft({ path: 'fresh', importPlan: null });
              router.push('/period');
            }}
            chevron
          />
          <ListRow
            testID="onboarding-start-import"
            title={t('onboarding.startImport')}
            subtitle={t('onboarding.startImportHint')}
            subtitleLines={2}
            onPress={() => {
              setDraft({ path: 'import' });
              router.push('/period');
            }}
            chevron
          />
          <ListRow
            testID="onboarding-start-restore"
            title={t('onboarding.startRestore')}
            subtitle={t('onboarding.startRestoreHint')}
            subtitleLines={2}
            // The backup carries its own settings, so the boot router takes it to the tabs.
            onPress={() => router.push('/profile/restore')}
            chevron
          />
        </View>
      </Card>
    </Screen>
  );
}
