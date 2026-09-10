import { formatMoney } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { Sheet } from '../../components/Sheet';
import { useRepositories } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import type { BudgetView } from './useBudgetProgress';

export interface BudgetDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  view: BudgetView | null;
}

/** §6.17 / §5.8, plus the edit and delete actions the spec adds to the prototype. */
export function BudgetDetailSheet({ visible, onClose, view }: BudgetDetailSheetProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const repos = useRepositories();
  const currency = settings?.currency ?? 'EUR';

  if (view === null) return null;

  return (
    <Sheet visible={visible} onClose={onClose} title={view.budget.name}>
      <Text size="amountLg" weight="semibold" tracking="tighter" tabular>
        {formatMoney(view.spent, currency, locale)}
      </Text>
      <Text color="textMuted">
        {t('budgets.ofLimit', { amount: formatMoney(view.limitWithCarry, currency, locale) })}
      </Text>
      <View style={{ marginTop: 6 }}>
        <ProgressBar
          ratio={view.ratio}
          pace={view.open ? view.spent / Math.max(1, view.limitWithCarry) : undefined}
          overPace={view.overPace}
        />
      </View>
      <Text size="footnote" color="textMuted">
        {view.open ? t('budgets.daysLeft', { count: view.daysLeft }) : t('budgets.closed')}
      </Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        <PrimaryButton
          label={t('common.edit')}
          onPress={() => {
            onClose();
            router.push({ pathname: '/budget/[id]', params: { id: view.budget.id } });
          }}
        />
        <SecondaryButton
          label={t('budgets.deleteBudget')}
          onPress={() => {
            repos.budgets.remove(view.budget.id);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
