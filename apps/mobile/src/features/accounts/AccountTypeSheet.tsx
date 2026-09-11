import type { Account } from '@saldo/core';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../theme/Icon';
import { useTheme } from '../../theme/ThemeProvider';

export const ACCOUNT_TYPES = [
  'cash',
  'checking',
  'credit_card',
  'savings',
  'investment',
] as const satisfies readonly Account['type'][];

/** Five options, chosen and closed: a sheet. */
export function AccountTypeSheet({
  visible,
  onClose,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  value: Account['type'];
  onSelect: (type: Account['type']) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('accounts.type')}>
      <View>
        {ACCOUNT_TYPES.map((type) => (
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
