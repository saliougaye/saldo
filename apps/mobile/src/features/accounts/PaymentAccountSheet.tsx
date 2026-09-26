import type { Account } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { IconBox, ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';
import { InfoButton } from '../guide/InfoButton';

/**
 * "Addebitata su" (§6.22): the account a credit card is charged to, or none.
 *
 * Rows with the account's icon and colour, one check, as the account filter: one of a handful,
 * picked and closed. The caller passes the candidates (`paymentAccountCandidates`), so a card or
 * an archived account never shows up here.
 */
export function PaymentAccountSheet({
  visible,
  onClose,
  accounts,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  accounts: readonly Account[];
  selected: string | null;
  onSelect: (accountId: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const choose = (accountId: string | null) => () => {
    onSelect(accountId);
    onClose();
  };
  const check = (isSelected: boolean) =>
    isSelected ? <Icon name="check" size={16} color={theme.palette.accent} /> : undefined;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('accounts.creditPaymentAccount')}
      titleAccessory={<InfoButton concept="creditCard" />}
    >
      <View>
        <ListRow
          title={t('accounts.noPaymentAccount')}
          leading={<IconBox name="wallet" colour={theme.palette.textMuted} small />}
          trailing={check(selected === null)}
          selected={selected === null}
          onPress={choose(null)}
        />
        {accounts.map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            leading={
              <IconBox
                name={account.icon as IconName}
                colour={theme.categoryColor(account.colorIndex)}
                small
              />
            }
            trailing={check(selected === account.id)}
            selected={selected === account.id}
            onPress={choose(account.id)}
          />
        ))}
      </View>
    </Sheet>
  );
}
