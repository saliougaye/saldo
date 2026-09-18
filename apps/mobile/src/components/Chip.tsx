import type { IconName } from '@saldo/ui';
import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Shown on the right when the chip opens a picker. */
  chevron?: boolean;
  /** Shown on the left: what the chip is about, at the stroke weight of its label (§13). */
  icon?: IconName;
  accessibilityLabel?: string;
  /** For the end-to-end flows in `apps/mobile/maestro`, whose labels are translated. */
  testID?: string;
}

/** Filter chip of §5.12: neutral when off, accent when a filter is applied. */
export function Chip({
  label,
  active = false,
  onPress,
  chevron = false,
  icon,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 30,
        paddingHorizontal: 10,
        borderRadius: theme.radii.chipSmall,
        backgroundColor: active ? theme.palette.accent : theme.palette.raised,
        opacity: pressed ? 0.7 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {icon === undefined ? null : (
        <Icon
          name={icon}
          size={13}
          color={active ? theme.palette.onAccent : theme.palette.textFaint}
        />
      )}
      <Text
        size="footnote"
        color={active ? 'onAccent' : 'textMuted'}
        weight={active ? 'medium' : 'regular'}
      >
        {label}
      </Text>
      {chevron ? (
        <View>
          <Icon
            name="chevD"
            size={12}
            color={active ? theme.palette.onAccent : theme.palette.textFaint}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
