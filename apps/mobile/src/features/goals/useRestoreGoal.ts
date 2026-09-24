import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast';
import { useRepositories } from '../../db/DatabaseProvider';
import { restoreGoal } from '../../db/goalService';
import { usePeriod } from '../period/PeriodProvider';

/** Ripristina on a closed goal (§5.14): from today, or a toast when its account is archived. */
export function useRestoreGoal(): (goalId: string) => void {
  const { t } = useTranslation();
  const toast = useToast();
  const repos = useRepositories();
  const { today } = usePeriod();
  return (goalId) => {
    try {
      restoreGoal(repos, goalId, today);
    } catch {
      toast.show(t('goals.parentArchived'));
    }
  };
}
