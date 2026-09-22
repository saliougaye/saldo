import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { ImportWizard } from '../../src/features/import/ImportWizard';
import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';
import { useOnboarding } from '../../src/features/onboarding/state';

/** §6.29 import step 3: the §11.3 wizard, kept in the draft instead of written. */
export default function ImportFileStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, setDraft } = useOnboarding();

  return (
    <Screen>
      <StepHeader
        step={{ current: 3, total: 4 }}
        title={t('onboarding.importFileTitle')}
        body={t('onboarding.importFileBody')}
      />
      <StepChunk>
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
      </StepChunk>
    </Screen>
  );
}
