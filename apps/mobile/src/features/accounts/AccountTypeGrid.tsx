import { ACCOUNT_TYPES, type AccountType } from '@saldo/core';
import { accountTypeIcons } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Onboarding step 2's type picker (§6.29): the prototype's three-column grid, icon over label.
 * Six types do not fit a segmented control on a phone, so each gets a tile and a label may wrap.
 */
export function AccountTypeGrid({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: AccountType;
  onChange: (type: AccountType) => void;
  accessibilityLabel?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
    >
      {ACCOUNT_TYPES.map((type) => {
        const selected = type === value;
        const label = t(`accountTypes.${type}`);
        return (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            onPress={() => onChange(type)}
            style={{
              width: '31%',
              minHeight: 70,
              padding: 10,
              gap: 9,
              borderRadius: theme.radii.input,
              borderWidth: 1,
              borderColor: selected ? theme.palette.accent : theme.palette.border,
              backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
            }}
          >
            <Icon
              name={accountTypeIcons[type]}
              size={18}
              color={selected ? theme.palette.onAccent : theme.palette.textMuted}
            />
            <Text size="caption" color={selected ? 'onAccent' : 'textMuted'} numberOfLines={2}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
