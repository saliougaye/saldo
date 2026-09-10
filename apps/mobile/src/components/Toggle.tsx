import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
}

/** §13: toggles expose `accessibilityRole="switch"` with their state. */
export function Toggle({ value, onChange, accessibilityLabel }: ToggleProps) {
  const theme = useTheme();
  const inset = (theme.layout.toggleHeight - theme.layout.toggleKnob) / 2;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={() => onChange(!value)}
      style={{
        width: theme.layout.toggleWidth,
        height: theme.layout.toggleHeight,
        borderRadius: theme.radii.toggle,
        backgroundColor: value ? theme.palette.accent : theme.palette.track,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: theme.layout.toggleKnob,
          height: theme.layout.toggleKnob,
          borderRadius: theme.radii.pill,
          backgroundColor: value ? theme.palette.onAccent : theme.palette.textFaint,
          marginLeft: value ? theme.layout.toggleWidth - theme.layout.toggleKnob - inset : inset,
        }}
      />
    </Pressable>
  );
}
