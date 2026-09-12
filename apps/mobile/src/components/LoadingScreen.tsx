import { ActivityIndicator, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Full-screen spinner on the theme background. Used for the boot gaps — migrations, the i18n
 * bundle, the first settings read — and those happen before i18n exists, so `label` is optional
 * and the screen is wordless without it.
 *
 * Pass one wherever the wait can be long enough to look like a hang: a spinner that never says
 * what it is waiting for is indistinguishable from a spinner that is stuck.
 */
export function LoadingScreen({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: theme.palette.bg,
      }}
    >
      <ActivityIndicator color={theme.palette.textMuted} />
      {label === undefined ? null : (
        <Text size="footnote" color="textMuted">
          {label}
        </Text>
      )}
    </View>
  );
}
