import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  loading?: boolean;
}

/** Filled action button. Disabled and loading both block presses (§13 accessibility). */
export function PrimaryButton({ label, loading = false, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled === true || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      {...rest}
      style={({ pressed }) => ({
        minHeight: theme.layout.minHitTarget,
        borderRadius: theme.radii.button,
        backgroundColor: theme.palette.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        opacity: inactive ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={theme.palette.onAccent} />
      ) : (
        <Text weight="medium" color="onAccent" size="headline" tracking="tight">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Outlined action button, used next to a primary one. */
export function SecondaryButton({ label, disabled, ...rest }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      {...rest}
      style={({ pressed }) => ({
        minHeight: theme.layout.minHitTarget,
        borderRadius: theme.radii.button,
        borderWidth: 1,
        borderColor: theme.palette.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        opacity: inactive ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <View>
        <Text weight="medium" size="headline" tracking="tight">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
