import { Pressable, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

/** Segmented control used by the kind switch, period and alert pickers (§6.16, §6.18). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.palette.raised,
        borderRadius: theme.radii.input,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            // The segments are 36pt tall and sit shoulder to shoulder, so only the top and bottom
            // can grow; 4 each way reaches the floor without either one stealing its neighbour.
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.chipSmall,
              backgroundColor: selected ? theme.palette.accent : 'transparent',
            }}
          >
            <Text size="footnote" weight="medium" color={selected ? 'onAccent' : 'textMuted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
