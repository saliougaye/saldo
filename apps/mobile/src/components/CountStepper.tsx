import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface CountStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** What the number is: "Ogni", "Numero di volte". Read out with the value. */
  accessibilityLabel: string;
  decrementLabel: string;
  incrementLabel: string;
}

/** `−  N  +`, for small integers a keyboard would be overkill for (§6.16 "Personalizzato"). */
export function CountStepper({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
  decrementLabel,
  incrementLabel,
}: CountStepperProps) {
  const theme = useTheme();
  const key = (name: 'minus' | 'plus', label: string, disabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => onChange(next)}
      style={({ pressed }) => ({
        width: 40,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={name} size={14} color={theme.palette.textMuted} />
    </Pressable>
  );
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.palette.raised,
        borderRadius: theme.radii.input,
      }}
    >
      {key('minus', decrementLabel, value <= min, value - 1)}
      <Text weight="medium" tabular style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </Text>
      {key('plus', incrementLabel, value >= max, value + 1)}
    </View>
  );
}
