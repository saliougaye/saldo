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
  accessibilityLabel?: string;
}

/** Filter chip of §5.12: neutral when off, accent when a filter is applied. */
export function Chip({
  label,
  active = false,
  onPress,
  chevron = false,
  accessibilityLabel,
}: ChipProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 30,
        paddingHorizontal: 10,
        borderRadius: theme.radii.chipSmall,
        backgroundColor: active ? theme.palette.accent : theme.palette.raised,
      }}
    >
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
