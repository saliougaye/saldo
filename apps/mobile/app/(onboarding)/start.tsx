import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { useOnboarding } from '../../src/features/onboarding/state';
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
      <StepHeader title={t('onboarding.startTitle')} body={t('onboarding.startBody')} />
      <StepChunk>
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 4 }}>
            <View style={{ paddingVertical: 5 }}>
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
            </View>
            <View style={{ height: 1, backgroundColor: theme.palette.border }} />
            <View style={{ paddingVertical: 5 }}>
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
            </View>
            <View style={{ height: 1, backgroundColor: theme.palette.border }} />
            <View style={{ paddingVertical: 5 }}>
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
          </View>
        </Card>
      </StepChunk>
    </Screen>
  );
}
