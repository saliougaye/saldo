import type { IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { IconBox, ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { useAccounts } from '../../db/hooks';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * One account, or all of them (§5.12).
 *
 * Rows rather than the chips the tag filter uses: an account carries an icon and a colour that
 * make it recognisable at a glance, and only one can be chosen — a row with a check says "one of
 * these" where a wall of chips says "as many as you like".
 *
 * Archived accounts are listed too: their transactions are still in the period, and filtering to
 * an account you no longer use is exactly when you would reach for this.
 */
export function AccountFilterSheet({
  visible,
  onClose,
  selected,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  selected: string | null;
  onChange: (accountId: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accounts = useAccounts();

  const choose = (accountId: string | null) => () => {
    onChange(accountId);
    onClose();
  };
  const check = (isSelected: boolean) =>
    isSelected ? <Icon name="check" size={16} color={theme.palette.accent} /> : undefined;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('transactions.account')}>
      <View>
        <ListRow
          title={t('transactions.allAccounts')}
          leading={<IconBox name="wallet" colour={theme.palette.textMuted} small />}
          trailing={check(selected === null)}
          onPress={choose(null)}
        />
        {accounts.map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            subtitle={account.archivedAt === null ? undefined : t('accounts.archivedBadge')}
            leading={
              <IconBox
                name={account.icon as IconName}
                colour={
                  account.archivedAt === null
                    ? theme.categoryColor(account.colorIndex)
                    : theme.palette.textFaint
                }
                small
              />
            }
            trailing={check(selected === account.id)}
            onPress={choose(account.id)}
          />
        ))}
      </View>
    </Sheet>
  );
}
