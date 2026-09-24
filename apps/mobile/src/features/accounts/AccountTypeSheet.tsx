import { type Account, accountTypeSchema } from '@saldo/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';

/** A pocket is a goal (§5.14): made by the goal wizard, never picked as a type. */
export const ACCOUNT_TYPES = accountTypeSchema.options.filter((type) => type !== 'pocket');

/** A handful of options, chosen and closed: a sheet. */
export function AccountTypeSheet({
  visible,
  onClose,
  value,
  onSelect,
  types = ACCOUNT_TYPES,
}: {
  visible: boolean;
  onClose: () => void;
  value: Account['type'];
  onSelect: (type: Account['type']) => void;
  /** Narrower than every type when the account holds goals (§5.14). */
  types?: readonly Account['type'][];
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('accounts.type')}>
      <View>
        {types.map((type) => (
          <ListRow
            key={type}
            title={t(`accountTypes.${type}`)}
            trailing={
              type === value ? (
                <Icon name="check" size={16} color={theme.palette.accent} />
              ) : undefined
            }
            onPress={() => {
              onSelect(type);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
