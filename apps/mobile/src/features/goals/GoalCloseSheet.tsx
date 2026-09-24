import { mascot } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { MascotCelebrate } from '../../components/Mascot';
import { Sheet } from '../../components/Sheet';
import { Text } from '../../theme/Text';

export interface GoalCloseSheetProps {
  visible: boolean;
  onClose: () => void;
  /** A reached goal opens with Rocky celebrating (§6.38, D26); one closed early does not. */
  reached: boolean;
  /** The pocket's balance, formatted; null when it is empty. */
  balanceLabel: string | null;
  parentName: string;
  onRecordExpense: () => void;
  onReturn: () => void;
}

/** §6.38: what happened to the money; with an empty goal it only confirms. */
export function GoalCloseSheet({
  visible,
  onClose,
  reached,
  balanceLabel,
  parentName,
  onRecordExpense,
  onReturn,
}: GoalCloseSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('goals.close')}>
      <View style={{ gap: 12 }}>
        {reached ? <MascotCelebrate size={mascot.celebrateSize} /> : null}
        {balanceLabel === null ? (
          <>
            <Text color="textMuted">{t('goals.closeEmpty')}</Text>
            <PrimaryButton label={t('goals.confirmClose')} onPress={onReturn} />
          </>
        ) : (
          <>
            <Text weight="medium">{t('goals.closeTitle')}</Text>
            <Text color="textMuted">{t('goals.closeBody', { amount: balanceLabel })}</Text>
            <PrimaryButton label={t('goals.recordExpense')} onPress={onRecordExpense} />
            <SecondaryButton label={t('goals.returnTo', { name: parentName })} onPress={onReturn} />
          </>
        )}
      </View>
    </Sheet>
  );
}
