import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { ImportWizard } from '../../src/features/import/ImportWizard';
import { useOnboarding } from '../../src/features/onboarding/state';
import { Text } from '../../src/theme/Text';

/** §6.29 import step 3: the §11.3 wizard, kept in the draft instead of written. */
export default function ImportFileStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, setDraft } = useOnboarding();

  return (
    <Screen>
      <BackButton />
      <ProgressBar ratio={3 / 4} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 3, total: 4 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.importFileTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.importFileBody')}</Text>

      <ImportWizard
        currency={draft.currency}
        // Nothing exists yet: every account, category and tag in the file is new.
        context={() => ({
          accounts: [],
          categories: [],
          tags: [],
          existingFingerprints: new Set(),
        })}
        confirmLabel={() => t('common.continue')}
        onConfirm={(importPlan) => {
          setDraft({ importPlan });
          router.push('/import-balances');
        }}
      />
    </Screen>
  );
}
